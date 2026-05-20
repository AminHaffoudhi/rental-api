import cors from "cors";
import { isOriginAllowed } from "@/lib/corsOrigins";

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, origin ?? true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
});
