import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as paymentService from "@/services/payment.service";
import { success } from "@/utils/apiResponse";
import { pathParam } from "@/utils/pathParam";

export async function getByBooking(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const payment = await paymentService.getPaymentByBooking(
    pathParam(req.params.bookingId),
    req.user.id
  );
  success(res, payment);
}
