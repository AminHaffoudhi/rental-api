import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { requestContext } from "@/lib/requestContext";

const { combine, timestamp, printf, json, errors } = winston.format;

const isDev = process.env.NODE_ENV !== "production";
const SERVICE_NAME = process.env.SERVICE_NAME || "rental-api";

const logsDir = path.join(process.cwd(), "logs");
fs.mkdirSync(logsDir, { recursive: true });

const devFormat = printf((info) => {
  const level = String(info.level);
  const message = String(info.message ?? "");
  const stack = info.stack ? String(info.stack) : "";
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(info)) {
    if (["level", "message", "timestamp", "stack", "splat"].includes(k)) continue;
    meta[k] = v;
  }
  const rid = requestContext.getStore()?.requestId;
  const levelColors: Record<string, (s: string) => string> = {
    error: chalk.red.bold,
    warn: chalk.yellow.bold,
    info: chalk.green,
    http: chalk.cyan,
    debug: chalk.gray,
  };
  const colorFn = levelColors[level] ?? chalk.white;
  const ts = chalk.dim(String(info.timestamp).slice(11, 19));
  const svc = chalk.dim(`[${SERVICE_NAME}]`);
  const ridStr = rid ? chalk.magenta(`[${rid.slice(0, 8)}]`) : "";
  const metaKeys = Object.keys(meta).filter((k) => !k.startsWith("splat"));
  const metaStr =
    metaKeys.length > 0
      ? chalk.dim("\n  " + JSON.stringify(Object.fromEntries(metaKeys.map((k) => [k, meta[k]])), null, 2).split("\n").join("\n  "))
      : "";
  const stackStr = stack ? chalk.red("\n" + stack) : "";
  return `${ts} ${svc} ${ridStr} ${colorFn(level.toUpperCase().padEnd(5))} ${message}${metaStr}${stackStr}`;
});

const prodFormat = combine(errors({ stack: true }), timestamp(), json());

const fileTransportError = new DailyRotateFile({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxFiles: "14d",
  maxSize: "20m",
  zippedArchive: true,
});

const fileTransportCombined = new DailyRotateFile({
  filename: path.join(logsDir, "combined-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "7d",
  maxSize: "20m",
  zippedArchive: true,
});

const logger = winston.createLogger({
  level: isDev ? "debug" : "info",
  defaultMeta: { service: SERVICE_NAME, env: process.env.NODE_ENV },
  format: isDev ? combine(errors({ stack: true }), timestamp(), devFormat) : prodFormat,
  transports: [new winston.transports.Console(), fileTransportError, fileTransportCombined],
  exceptionHandlers: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: path.join(logsDir, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: path.join(logsDir, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
  exitOnError: false,
});

export default logger;

export const log = {
  info: (msg: string, meta?: object) => logger.info(msg, meta),
  warn: (msg: string, meta?: object) => logger.warn(msg, meta),
  error: (msg: string, meta?: object) => logger.error(msg, meta),
  debug: (msg: string, meta?: object) => logger.debug(msg, meta),
  http: (msg: string, meta?: object) => logger.http(msg, meta),
};
