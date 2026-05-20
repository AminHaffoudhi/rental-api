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
const express_1 = require("express");
const bookingController = __importStar(require("@/controllers/booking.controller"));
const auth_middleware_1 = require("@/middleware/auth.middleware");
const validate_middleware_1 = require("@/middleware/validate.middleware");
const asyncHandler_1 = require("@/utils/asyncHandler");
const booking_validator_1 = require("@/validators/booking.validator");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", (0, asyncHandler_1.asyncHandler)(bookingController.listMine));
router.post("/", (0, validate_middleware_1.validate)(booking_validator_1.createBookingSchema), (0, asyncHandler_1.asyncHandler)(bookingController.create));
router.get("/:id", (0, asyncHandler_1.asyncHandler)(bookingController.getById));
router.post("/:id/approve", (0, asyncHandler_1.asyncHandler)(bookingController.approve));
router.post("/:id/reject", (0, validate_middleware_1.validate)(booking_validator_1.rejectBookingSchema), (0, asyncHandler_1.asyncHandler)(bookingController.reject));
router.post("/:id/cancel", (0, asyncHandler_1.asyncHandler)(bookingController.cancel));
router.post("/:id/confirm-delivery", (0, asyncHandler_1.asyncHandler)(bookingController.confirmDelivery));
router.post("/:id/return-request", (0, asyncHandler_1.asyncHandler)(bookingController.requestReturn));
router.post("/:id/dispute", (0, validate_middleware_1.validate)(booking_validator_1.raiseDisputeSchema), (0, asyncHandler_1.asyncHandler)(bookingController.dispute));
exports.default = router;
