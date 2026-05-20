import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "@/config/env";

export type JwtPayload = {
  id: string;
  role: string;
  email: string;
  canList?: boolean;
};

export function signToken(payload: {
  id: string;
  role: string;
  email: string;
  canList: boolean;
}): string {
  return jwt.sign(payload, JWT_SECRET as Secret, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET as Secret);
  if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }
  const { id, role, email, canList } = decoded as Record<string, unknown>;
  if (typeof id !== "string" || typeof role !== "string" || typeof email !== "string") {
    throw new Error("Invalid token payload shape");
  }
  return {
    id,
    role,
    email,
    canList: typeof canList === "boolean" ? canList : undefined,
  };
}
