import cron from "node-cron";
import logger from "@/lib/logger";
import { autoCompleteBookings } from "@/jobs/autoCompleteBookings";
import { sendReturnReminders } from "@/jobs/sendReturnReminders";

export function startScheduler(): void {
  cron.schedule("0 8 * * *", () => {
    void sendReturnReminders().catch((err: unknown) =>
      logger.error("sendReturnReminders failed", { error: String(err) })
    );
  });

  cron.schedule("0 0 * * *", () => {
    void autoCompleteBookings().catch((err: unknown) =>
      logger.error("autoCompleteBookings failed", { error: String(err) })
    );
  });
}
