/** Trim and collapse whitespace; empty input becomes null. */
export function normalizePhone(phone: string | undefined | null): string | null {
  const trimmed = phone?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\s+/g, " ");
}
