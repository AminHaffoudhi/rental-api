import Redis from "ioredis";
import { REDIS_HOST, REDIS_PORT } from "@/config/env";
import logger from "@/lib/logger";

const port = Number.parseInt(REDIS_PORT, 10);
const redisPort = Number.isNaN(port) ? 6379 : port;

const redis = new Redis({
  host: REDIS_HOST,
  port: redisPort,
  password: process.env.REDIS_PASSWORD?.trim() || undefined,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.warn("Redis unavailable after 3 retries — continuing without cache");
      return null;
    }
    return Math.min(times * 200, 1000);
  },
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.warn("Redis error", { error: err.message }));

export default redis;
export const isRedisAvailable = (): boolean => redis.status === "ready";
