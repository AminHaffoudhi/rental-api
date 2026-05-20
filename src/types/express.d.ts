import type { Role } from "@prisma/client";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: Role; email: string; canList: boolean };
    requestId: string;
  }

  interface Response {
    requestId: string;
  }
}

export {};
