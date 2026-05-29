import Stripe from "stripe";
import { STRIPE_SECRET_KEY, isStripeConfigured } from "@/config/env";
import { BusinessError } from "@/lib/errors";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new BusinessError("Online payment is not configured. Contact support.");
  }
  if (!client) {
    client = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return client;
}
