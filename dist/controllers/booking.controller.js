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
exports.listMine = listMine;
exports.create = create;
exports.getById = getById;
exports.approve = approve;
exports.reject = reject;
exports.cancel = cancel;
exports.confirmDelivery = confirmDelivery;
exports.requestReturn = requestReturn;
exports.dispute = dispute;
const bookingService = __importStar(require("@/services/booking.service"));
const apiResponse_1 = require("@/utils/apiResponse");
const pathParam_1 = require("@/utils/pathParam");
async function listMine(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const data = await bookingService.getMyBookings(req.user.id);
    (0, apiResponse_1.success)(res, data);
}
async function create(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.createBooking(req.user.id, req.body);
    (0, apiResponse_1.success)(res, booking, 201);
}
async function getById(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.getBookingById((0, pathParam_1.pathParam)(req.params.id), req.user.id);
    (0, apiResponse_1.success)(res, booking);
}
async function approve(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.approveBooking((0, pathParam_1.pathParam)(req.params.id), req.user.id);
    (0, apiResponse_1.success)(res, booking);
}
async function reject(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.rejectBooking((0, pathParam_1.pathParam)(req.params.id), req.user.id, req.body.reason);
    (0, apiResponse_1.success)(res, booking);
}
async function cancel(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.cancelBooking((0, pathParam_1.pathParam)(req.params.id), req.user.id);
    (0, apiResponse_1.success)(res, booking);
}
async function confirmDelivery(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.confirmDelivery((0, pathParam_1.pathParam)(req.params.id), req.user.id);
    (0, apiResponse_1.success)(res, booking);
}
async function requestReturn(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.requestReturn((0, pathParam_1.pathParam)(req.params.id), req.user.id);
    (0, apiResponse_1.success)(res, booking);
}
async function dispute(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const booking = await bookingService.raiseDispute((0, pathParam_1.pathParam)(req.params.id), req.user.id, req.body.reason, req.body.evidence ?? []);
    (0, apiResponse_1.success)(res, booking);
}
