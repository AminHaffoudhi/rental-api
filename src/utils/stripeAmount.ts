import { STRIPE_CURRENCY, STRIPE_TND_PER_CHECKOUT_UNIT } from "@/config/env";
import { formatCurrency } from "@/utils/currency";

/** Platform listing/booking amounts are always stored in TND. */
export const PLATFORM_CURRENCY = "tnd";

const STRIPE_CODE = STRIPE_CURRENCY.toUpperCase();

/**
 * Converts a TND amount to the currency used for Stripe Checkout.
 * When checkout currency is TND, returns the amount unchanged (requires Stripe TND support on the account).
 */
export function tndToStripeChargeAmount(tndAmount: number): number {
  const code = STRIPE_CURRENCY.toLowerCase();
  if (code === PLATFORM_CURRENCY) {
    return tndAmount;
  }
  const converted = tndAmount / STRIPE_TND_PER_CHECKOUT_UNIT;
  return Math.round(converted * 100) / 100;
}

/** Shown on Stripe Checkout line items (TND is the platform price). */
export function stripeLineItemDescription(tndAmount: number, detail: string): string {
  const tnd = formatCurrency(tndAmount);
  if (STRIPE_CURRENCY === PLATFORM_CURRENCY) {
    return `${tnd} — ${detail}`;
  }
  const charged = tndToStripeChargeAmount(tndAmount);
  return `${tnd} — ${detail} (charged as ${charged.toFixed(2)} ${STRIPE_CODE})`;
}

/** Message near the Pay button on Stripe Checkout. */
export function stripeCheckoutSubmitMessage(totalTnd: number): string {
  const tnd = formatCurrency(totalTnd);
  if (STRIPE_CURRENCY === PLATFORM_CURRENCY) {
    return `Ekri platform total: ${tnd}.`;
  }
  const charged = tndToStripeChargeAmount(totalTnd);
  return `Ekri prices are in Tunisian dinar. Platform total: ${tnd} (≈ ${charged.toFixed(2)} ${STRIPE_CODE} charged below).`;
}
