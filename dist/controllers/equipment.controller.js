"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = search;
exports.create = create;
exports.getById = getById;
exports.update = update;
exports.remove = remove;
exports.availability = availability;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const equipmentService = __importStar(require("@/services/equipment.service"));
const apiResponse_1 = require("@/utils/apiResponse");
const pathParam_1 = require("@/utils/pathParam");
const searchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    category: zod_1.z.nativeEnum(client_1.Category).optional(),
    minPrice: zod_1.z.coerce.number().optional(),
    maxPrice: zod_1.z.coerce.number().optional(),
    location: zod_1.z.string().optional(),
});
async function search(req, res) {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        throw parsed.error;
    }
    const items = await equipmentService.searchEquipment(parsed.data);
    (0, apiResponse_1.success)(res, items);
}
async function create(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const item = await equipmentService.createEquipment(req.user.id, req.body);
    (0, apiResponse_1.success)(res, item, 201);
}
async function getById(req, res) {
    const item = await equipmentService.getEquipmentById((0, pathParam_1.pathParam)(req.params.id));
    (0, apiResponse_1.success)(res, item);
}
async function update(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const item = await equipmentService.updateEquipment((0, pathParam_1.pathParam)(req.params.id), req.user.id, req.body);
    (0, apiResponse_1.success)(res, item);
}
async function remove(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    await equipmentService.deleteEquipment((0, pathParam_1.pathParam)(req.params.id), req.user.id);
    (0, apiResponse_1.success)(res, { ok: true });
}
async function availability(req, res) {
    const month = typeof req.query.month === "string" ? req.query.month : "";
    const data = await equipmentService.getAvailability((0, pathParam_1.pathParam)(req.params.id), month);
    (0, apiResponse_1.success)(res, data);
}
