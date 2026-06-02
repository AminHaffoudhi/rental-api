import { BookingStatus } from "@prisma/client";

export type BookingStateConfigEntry = {
  label: string;
  color: string;
  allowedTransitions: BookingStatus[];
};

/** Simplified happy path: Pending → Pay → Active → Completed */
export const BookingStateConfig: Record<BookingStatus, BookingStateConfigEntry> = {
  [BookingStatus.PENDING]: {
    label: "Pending",
    color: "amber",
    allowedTransitions: [
      BookingStatus.PAYMENT_PENDING,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
    ],
  },
  [BookingStatus.CONFIRMED]: {
    label: "Confirmed",
    color: "blue",
    allowedTransitions: [BookingStatus.PAYMENT_PENDING, BookingStatus.CANCELLED],
  },
  [BookingStatus.PAYMENT_PENDING]: {
    label: "Payment pending",
    color: "orange",
    allowedTransitions: [BookingStatus.PAID, BookingStatus.ACTIVE, BookingStatus.CANCELLED],
  },
  [BookingStatus.PAID]: {
    label: "Paid",
    color: "green",
    allowedTransitions: [BookingStatus.ACTIVE],
  },
  [BookingStatus.PICKUP_SCHEDULED]: {
    label: "Pickup scheduled",
    color: "cyan",
    allowedTransitions: [BookingStatus.ACTIVE, BookingStatus.IN_TRANSIT],
  },
  [BookingStatus.IN_TRANSIT]: {
    label: "In transit",
    color: "teal",
    allowedTransitions: [BookingStatus.ACTIVE],
  },
  [BookingStatus.ACTIVE]: {
    label: "Active",
    color: "emerald",
    allowedTransitions: [BookingStatus.COMPLETED, BookingStatus.DISPUTED],
  },
  [BookingStatus.RETURN_SCHEDULED]: {
    label: "Return scheduled",
    color: "indigo",
    allowedTransitions: [BookingStatus.COMPLETED, BookingStatus.RETURNING],
  },
  [BookingStatus.RETURNING]: {
    label: "Returning",
    color: "violet",
    allowedTransitions: [BookingStatus.COMPLETED, BookingStatus.INSPECTING],
  },
  [BookingStatus.INSPECTING]: {
    label: "Inspecting",
    color: "slate",
    allowedTransitions: [BookingStatus.COMPLETED, BookingStatus.DISPUTED],
  },
  [BookingStatus.COMPLETED]: {
    label: "Completed",
    color: "green",
    allowedTransitions: [],
  },
  [BookingStatus.DISPUTED]: {
    label: "Disputed",
    color: "red",
    allowedTransitions: [BookingStatus.COMPLETED, BookingStatus.REFUNDED],
  },
  [BookingStatus.REJECTED]: {
    label: "Rejected",
    color: "rose",
    allowedTransitions: [],
  },
  [BookingStatus.CANCELLED]: {
    label: "Cancelled",
    color: "gray",
    allowedTransitions: [],
  },
  [BookingStatus.REFUNDED]: {
    label: "Refunded",
    color: "zinc",
    allowedTransitions: [],
  },
};
