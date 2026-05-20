import express from "express";
import helmet from "helmet";
import { corsMiddleware } from "@/middleware/cors.middleware";
import { errorMiddleware } from "@/middleware/error.middleware";
import { httpLoggerMiddleware } from "@/middleware/httpLogger.middleware";
import { requestIdMiddleware } from "@/middleware/requestId.middleware";
import routes from "@/routes/index";
import uploadDirectRoutes from "@/routes/upload.direct.routes";

export const app = express();

app.use(requestIdMiddleware);
app.use(helmet());
app.use(corsMiddleware);
app.use(httpLoggerMiddleware);
/** Raw body upload — must be registered before express.json() */
app.use("/api/upload", uploadDirectRoutes);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} does not exist.`,
    requestId: req.requestId,
  });
});

app.use(errorMiddleware);
