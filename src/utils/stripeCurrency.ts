import { ValidationError } from "@/lib/errors";

/** Stripe amounts for these ISO codes use 1/1000 of the main unit (e.g. millimes for TND). */
const THREE_DECIMAL_CURRENCIES = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export function toStripeMinorUnits(amount: number, currency: string): number {
  const code = currency.toLowerCase();
  const factor = THREE_DECIMAL_CURRENCIES.has(code) ? 1000 : 100;
  const minor = Math.round(amount * factor);
  if (minor < 1) {
    throw new ValidationError("Payment amount is too small");
  }
  return minor;
}
