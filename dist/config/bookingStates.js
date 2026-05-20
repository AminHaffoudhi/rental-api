"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingStateConfig = void 0;
const client_1 = require("@prisma/client");
exports.BookingStateConfig = {
    [client_1.BookingStatus.PENDING]: {
        label: "Pending",
        color: "amber",
        allowedTransitions: [
            client_1.BookingStatus.CONFIRMED,
            client_1.BookingStatus.REJECTED,
            client_1.BookingStatus.CANCELLED,
        ],
    },
    [client_1.BookingStatus.CONFIRMED]: {
        label: "Confirmed",
        color: "blue",
        allowedTransitions: [client_1.BookingStatus.PAYMENT_PENDING, client_1.BookingStatus.CANCELLED],
    },
    [client_1.BookingStatus.PAYMENT_PENDING]: {
        label: "Payment pending",
        color: "orange",
        allowedTransitions: [client_1.BookingStatus.PAID],
    },
    [client_1.BookingStatus.PAID]: {
        label: "Paid",
        color: "green",
        allowedTransitions: [client_1.BookingStatus.PICKUP_SCHEDULED],
    },
    [client_1.BookingStatus.PICKUP_SCHEDULED]: {
        label: "Pickup scheduled",
        color: "cyan",
        allowedTransitions: [client_1.BookingStatus.IN_TRANSIT],
    },
    [client_1.BookingStatus.IN_TRANSIT]: {
        label: "In transit",
        color: "teal",
        allowedTransitions: [client_1.BookingStatus.ACTIVE],
    },
    [client_1.BookingStatus.ACTIVE]: {
        label: "Active",
        color: "emerald",
        allowedTransitions: [client_1.BookingStatus.RETURN_SCHEDULED],
    },
    [client_1.BookingStatus.RETURN_SCHEDULED]: {
        label: "Return scheduled",
        color: "indigo",
        allowedTransitions: [client_1.BookingStatus.RETURNING],
    },
    [client_1.BookingStatus.RETURNING]: {
        label: "Returning",
        color: "violet",
        allowedTransitions: [client_1.BookingStatus.INSPECTING],
    },
    [client_1.BookingStatus.INSPECTING]: {
        label: "Inspecting",
        color: "slate",
        allowedTransitions: [client_1.BookingStatus.COMPLETED, client_1.BookingStatus.DISPUTED],
    },
    [client_1.BookingStatus.COMPLETED]: {
        label: "Completed",
        color: "green",
        allowedTransitions: [],
    },
    [client_1.BookingStatus.DISPUTED]: {
        label: "Disputed",
        color: "red",
        allowedTransitions: [client_1.BookingStatus.COMPLETED, client_1.BookingStatus.REFUNDED],
    },
    [client_1.BookingStatus.REJECTED]: {
        label: "Rejected",
        color: "rose",
        allowedTransitions: [],
    },
    [client_1.BookingStatus.CANCELLED]: {
        label: "Cancelled",
        color: "gray",
        allowedTransitions: [],
    },
    [client_1.BookingStatus.REFUNDED]: {
        label: "Refunded",
        color: "zinc",
        allowedTransitions: [],
    },
};
