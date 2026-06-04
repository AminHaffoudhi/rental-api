import type { User } from "@prisma/client";
import { HttpError } from "@/utils/httpError";

export function assertUserNotBlocked(user: Pick<User, "blockedAt">): void {
  if (user.blockedAt) {
    throw new HttpError(
      403,
      "Your account has been suspended. Please contact support if you believe this is a mistake.",
      "ACCOUNT_BLOCKED"
    );
  }
}
