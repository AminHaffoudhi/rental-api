import type { Request, Response } from "express";
import { UnauthorizedError } from "@/lib/errors";
import * as bookingService from "@/services/booking.service";
import { success } from "@/utils/apiResponse";
import { pathParam } from "@/utils/pathParam";

export async function listMine(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const data = await bookingService.getMyBookings(req.user.id);
  success(res, data);
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.createBooking(req.user.id, req.body);
  success(res, booking, 201);
}

export async function getById(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.getBookingById(pathParam(req.params.id), req.user.id);
  success(res, booking);
}

export async function approve(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.approveBooking(pathParam(req.params.id), req.user.id);
  success(res, booking);
}

export async function reject(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.rejectBooking(
    pathParam(req.params.id),
    req.user.id,
    req.body.reason
  );
  success(res, booking);
}

export async function cancel(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.cancelBooking(pathParam(req.params.id), req.user.id);
  success(res, booking);
}

export async function confirmDelivery(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.confirmDelivery(pathParam(req.params.id), req.user.id);
  success(res, booking);
}

export async function ownerHandover(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.ownerHandoverToRenter(
    pathParam(req.params.id),
    req.user.id
  );
  success(res, booking);
}

export async function ownerCompleteReturn(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.ownerConfirmReturnComplete(
    pathParam(req.params.id),
    req.user.id
  );
  success(res, booking);
}

export async function completeRental(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.completeRental(pathParam(req.params.id), req.user.id);
  success(res, booking);
}

export async function requestReturn(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.requestReturn(pathParam(req.params.id), req.user.id);
  success(res, booking);
}

export async function dispute(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  const booking = await bookingService.raiseDispute(
    pathParam(req.params.id),
    req.user.id,
    req.body.reason,
    req.body.evidence ?? []
  );
  success(res, booking);
}
