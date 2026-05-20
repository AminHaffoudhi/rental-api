import { PORT } from "@/config/env";
import * as Sentry from "@sentry/node";
import { app } from "@/app";
import { initStorage } from "@/lib/storage";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { startScheduler } from "@/jobs/scheduler";
import { seedAdmin } from "@/seed/adminSeed";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"),
  });
}

startScheduler();

const server = app.listen(PORT, () => {
  logger.info(`🚀 ${process.env.SERVICE_NAME ?? "rental-api"} listening`, {
    port: PORT,
    env: process.env.NODE_ENV,
    pid: process.pid,
  });
  void (async () => {
    await initStorage();
    await seedAdmin();
  })();
});

async function shutdown(signal: string): Promise<void> {
  logger.warn(`${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  clearTimeout(forceExit);
  logger.info("HTTP server closed");

  await prisma.$disconnect();
  logger.info("Database disconnected");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
  process.exit(1);
});
