import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as paymentService from "@/services/payment.service";
import * as stripePaymentService from "@/services/stripePayment.service";
import { STRIPE_CURRENCY, isStripeConfigured } from "@/config/env";
import { success } from "@/utils/apiResponse";
import { pathParam } from "@/utils/pathParam";

export async function getByBooking(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const payment = await paymentService.getPaymentByBooking(
    pathParam(req.params.bookingId),
    req.user.id
  );
  success(res, payment);
}

export async function getStripeConfig(_req: Request, res: Response): Promise<void> {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim() || "";
  success(res, {
    enabled: isStripeConfigured(),
    publishableKey: isStripeConfigured() && publishableKey ? publishableKey : null,
    currency: STRIPE_CURRENCY,
  });
}

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const data = await stripePaymentService.createStripeCheckoutSession(
    pathParam(req.params.bookingId),
    req.user.id
  );
  success(res, data);
}

export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"];
  const rawBody = req.body as Buffer;
  await stripePaymentService.handleStripeWebhook(rawBody, typeof signature === "string" ? signature : undefined);
  res.status(200).json({ received: true });
}
