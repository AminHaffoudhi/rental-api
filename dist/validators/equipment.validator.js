"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEquipmentSchema = exports.createEquipmentSchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
exports.createEquipmentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    category: zod_1.z.nativeEnum(client_1.Category),
    dailyRate: zod_1.z.number().positive(),
    weeklyRate: zod_1.z.number().positive().optional(),
    depositAmount: zod_1.z.number().nonnegative(),
    deliveryFee: zod_1.z.number().nonnegative(),
    location: zod_1.z.string().min(1),
    images: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.updateEquipmentSchema = exports.createEquipmentSchema.partial();
