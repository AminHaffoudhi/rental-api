import { BookingStatus, DeliveryStatus, PaymentStatus, type Booking } from "@prisma/client";
import type Stripe from "stripe";
import { CLIENT_URL, STRIPE_CURRENCY, STRIPE_WEBHOOK_SECRET, isStripeConfigured } from "@/config/env";
import { BusinessError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { notifyPaymentConfirmed } from "@/services/notification.service";

function toMinorUnits(amount: number): number {
  const minor = Math.round(amount * 100);
  if (minor < 1) {
    throw new ValidationError("Payment amount is too small");
  }
  return minor;
}

export async function confirmBookingPaymentFromStripe(
  bookingId: string,
  stripeIds: { sessionId?: string; paymentIntentId?: string }
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      delivery: true,
      equipment: { select: { title: true } },
      renter: { select: { id: true, email: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });
  if (!booking || !booking.payment) {
    throw new NotFoundError("Booking");
  }

  if (booking.payment.status === PaymentStatus.CONFIRMED && booking.status === BookingStatus.PAID) {
    return booking;
  }

  if (booking.status !== BookingStatus.PAYMENT_PENDING) {
    throw new BusinessError("Booking is not awaiting payment");
  }
  if (booking.payment.status !== PaymentStatus.PENDING) {
    throw new BusinessError("Payment is not pending");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { bookingId },
      data: {
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedBy: "stripe",
        ...(stripeIds.sessionId ? { stripeCheckoutSessionId: stripeIds.sessionId } : {}),
        ...(stripeIds.paymentIntentId ? { stripePaymentIntentId: stripeIds.paymentIntentId } : {}),
      },
    });

    const existingDelivery = await tx.delivery.findUnique({ where: { bookingId } });
    if (!existingDelivery) {
      await tx.delivery.create({
        data: {
          bookingId,
          status: DeliveryStatus.SCHEDULED,
          pickupPhotos: [],
          returnPhotos: [],
        },
      });
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.PAID },
      include: {
        equipment: true,
        renter: true,
        owner: true,
        payment: true,
        delivery: true,
      },
    });
  });

  void notifyPaymentConfirmed(
    updated.renterId,
    updated.ownerId,
    updated.equipment.title,
    updated.id
  ).catch(() => undefined);

  return updated;
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
  const rentalMinor = toMinorUnits(booking.payment.amount);
  const depositMinor = toMinorUnits(booking.payment.depositAmount);
  const currency = STRIPE_CURRENCY;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency,
        unit_amount: rentalMinor,
        product_data: {
          name: `Rental — ${booking.equipment.title}`,
          description: `Booking ${booking.id.slice(0, 8)}… (rent + fees)`,
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
          description: "Refundable after return inspection",
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
    metadata: {
      bookingId: booking.id,
      renterId: booking.renterId,
    },
    payment_intent_data: {
      metadata: {
        bookingId: booking.id,
        renterId: booking.renterId,
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
