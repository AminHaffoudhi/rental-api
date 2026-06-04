import { BookingStatus, PaymentStatus } from "@prisma/client";
import type Stripe from "stripe";
import { CLIENT_URL, STRIPE_CURRENCY, STRIPE_WEBHOOK_SECRET, isStripeConfigured } from "@/config/env";
import { BusinessError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { activateRentalAfterPayment } from "@/services/booking.service";
import { formatCurrency } from "@/utils/currency";
import {
  stripeCheckoutSubmitMessage,
  stripeLineItemDescription,
  tndToStripeChargeAmount,
} from "@/utils/stripeAmount";
import { toStripeMinorUnits } from "@/utils/stripeCurrency";

export async function confirmBookingPaymentFromStripe(
  bookingId: string,
  stripeIds: { sessionId?: string; paymentIntentId?: string }
) {
  return activateRentalAfterPayment(bookingId, {
    confirmedBy: "stripe",
    stripeCheckoutSessionId: stripeIds.sessionId,
    stripePaymentIntentId: stripeIds.paymentIntentId,
  });
}

export async function createStripeCheckoutSession(
  bookingId: string,
  renterId: string
): Promise<{ url: string; sessionId: string }> {
  if (!isStripeConfigured()) {
    throw new BusinessError("Stripe is not configured on the server");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      equipment: { select: { title: true } },
      renter: { select: { email: true, name: true } },
    },
  });
  if (!booking || !booking.payment) {
    throw new NotFoundError("Booking");
  }
  if (booking.renterId !== renterId) {
    throw new ForbiddenError();
  }
  if (booking.status !== BookingStatus.PAYMENT_PENDING) {
    throw new BusinessError("This booking is not awaiting payment");
  }
  if (booking.payment.status !== PaymentStatus.PENDING) {
    throw new BusinessError("Payment has already been processed");
  }

  const stripe = getStripe();
  const currency = STRIPE_CURRENCY;
  const rentalMinor = toStripeMinorUnits(
    tndToStripeChargeAmount(booking.payment.amount),
    currency
  );
  const depositMinor = toStripeMinorUnits(
    tndToStripeChargeAmount(booking.payment.depositAmount),
    currency
  );

  const rentalTnd = booking.payment.amount;
  const depositTnd = booking.payment.depositAmount;
  const totalTnd = rentalTnd + depositTnd;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency,
        unit_amount: rentalMinor,
        product_data: {
          name: `Rental — ${booking.equipment.title}`,
          description: stripeLineItemDescription(
            rentalTnd,
            `Booking ${booking.id.slice(0, 8)}… · rent + fees`
          ),
        },
      },
    },
  ];

  if (depositMinor > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: depositMinor,
        product_data: {
          name: `Security deposit — ${booking.equipment.title}`,
          description: stripeLineItemDescription(
            depositTnd,
            "Refundable after return inspection"
          ),
        },
      },
    });
  }

  const successUrl = `${CLIENT_URL.replace(/\/+$/, "")}/bookings/${bookingId}?payment=success`;
  const cancelUrl = `${CLIENT_URL.replace(/\/+$/, "")}/bookings/${bookingId}?payment=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.renter.email,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    custom_text: {
      submit: {
        message: stripeCheckoutSubmitMessage(totalTnd),
      },
    },
    metadata: {
      bookingId: booking.id,
      renterId: booking.renterId,
      totalTnd: String(totalTnd),
    },
    payment_intent_data: {
      description: `Ekri booking ${booking.id.slice(0, 8)} — ${formatCurrency(totalTnd)}`,
      metadata: {
        bookingId: booking.id,
        renterId: booking.renterId,
        totalTnd: String(totalTnd),
      },
    },
  });

  if (!session.url) {
    throw new BusinessError("Could not start Stripe checkout");
  }

  await prisma.payment.update({
    where: { bookingId },
    data: { stripeCheckoutSessionId: session.id },
  });

  return { url: session.url, sessionId: session.id };
}

/** Called when returning from Stripe Checkout (webhook may be delayed or missing in local dev). */
export async function verifyStripeCheckoutAfterReturn(
  bookingId: string,
  userId: string
): Promise<{ activated: boolean }> {
  if (!isStripeConfigured()) {
    throw new BusinessError("Stripe is not configured on the server");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
  });
  if (!booking || !booking.payment) {
    throw new NotFoundError("Booking");
  }
  if (booking.renterId !== userId && booking.ownerId !== userId) {
    throw new ForbiddenError();
  }

  if (
    booking.status === BookingStatus.ACTIVE &&
    booking.payment.status === PaymentStatus.CONFIRMED
  ) {
    return { activated: false };
  }

  const sessionId = booking.payment.stripeCheckoutSessionId;
  if (!sessionId) {
    throw new BusinessError("No Stripe checkout session found for this booking");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    throw new BusinessError("Stripe payment is not complete yet");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  await confirmBookingPaymentFromStripe(bookingId, {
    sessionId: session.id,
    paymentIntentId: paymentIntentId ?? undefined,
  });

  return { activated: true };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new BusinessError("Stripe webhook secret is not configured");
  }
  if (!signature) {
    throw new ValidationError("Missing Stripe signature");
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new ValidationError("Invalid Stripe webhook signature");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      return;
    }
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    await confirmBookingPaymentFromStripe(bookingId, {
      sessionId: session.id,
      paymentIntentId: paymentIntentId ?? undefined,
    });
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const bookingId = intent.metadata?.bookingId;
    if (!bookingId) {
      return;
    }
    await confirmBookingPaymentFromStripe(bookingId, {
      paymentIntentId: intent.id,
    });
  }
}
