import { ValidationError } from "@/lib/errors";

export function pathParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ValidationError("Invalid path parameter");
  }
  return raw;
}
