import { createConfiguration, DefaultApi, FilterExpression, Notification } from "@onesignal/node-onesignal";
import logger from "@/lib/logger";

const configuration = createConfiguration({
  restApiKey: process.env.ONESIGNAL_REST_API_KEY ?? "",
});

const client = new DefaultApi(configuration);
const APP_ID = process.env.ONESIGNAL_APP_ID ?? "";

export interface NotificationPayload {
  title: string;
  message: string;
  url?: string;
  icon?: string;
  data?: Record<string, unknown>;
}

export async function sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
  if (!APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    logger.warn("OneSignal not configured — skipping push notification", { userId });
    return;
  }

  try {
    const notification = new Notification();
    notification.app_id = APP_ID;
    notification.include_aliases = { external_id: [userId] };
    notification.target_channel = "push";
    notification.headings = { en: payload.title };
    notification.contents = { en: payload.message };
    if (payload.url) {
      notification.url = payload.url;
    }
    if (payload.icon) {
      notification.chrome_web_icon = payload.icon;
    }
    if (payload.data) {
      notification.data = payload.data;
    }
    const base = (process.env.CLIENT_URL ?? "").replace(/\/+$/, "");
    if (base) {
      notification.chrome_web_badge = `${base}/favicon.ico`;
    }
    await client.createNotification(notification);
    logger.debug("Push notification sent", { userId, title: payload.title });
  } catch (err) {
    logger.warn("Push notification failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendToAdmins(payload: NotificationPayload): Promise<void> {
  if (!APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    return;
  }

  try {
    const notification = new Notification();
    notification.app_id = APP_ID;
    notification.target_channel = "push";
    const tagFilter = new FilterExpression();
    tagFilter.field = "tag";
    tagFilter.key = "role";
    tagFilter.relation = "=";
    tagFilter.value = "ADMIN";
    notification.filters = [tagFilter];
    notification.headings = { en: payload.title };
    notification.contents = { en: payload.message };
    if (payload.url) {
      notification.url = payload.url;
    }
    if (payload.data) {
      notification.data = payload.data;
    }
    await client.createNotification(notification);
    logger.debug("Push notification sent to admins", { title: payload.title });
  } catch (err) {
    logger.warn("Push notification to admins failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendToUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
  if (!userIds.length) {
    return;
  }
  await Promise.allSettled(userIds.map((id) => sendToUser(id, payload)));
}
