"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raiseDisputeSchema = exports.rejectBookingSchema = exports.createBookingSchema = void 0;
const zod_1 = require("zod");
exports.createBookingSchema = zod_1.z.object({
    equipmentId: zod_1.z.string().min(1),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    notes: zod_1.z.string().optional(),
});
exports.rejectBookingSchema = zod_1.z.object({
    reason: zod_1.z.string().optional(),
});
exports.raiseDisputeSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1),
    evidence: zod_1.z.array(zod_1.z.string().url()).optional(),
});
