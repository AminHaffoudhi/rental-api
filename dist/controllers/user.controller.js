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
exports.getById = getById;
exports.updateMe = updateMe;
exports.uploadKyc = uploadKyc;
const userService = __importStar(require("@/services/user.service"));
const apiResponse_1 = require("@/utils/apiResponse");
const pathParam_1 = require("@/utils/pathParam");
async function getById(req, res) {
    const profile = await userService.getUserById((0, pathParam_1.pathParam)(req.params.id));
    (0, apiResponse_1.success)(res, profile);
}
async function updateMe(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const user = await userService.updateUser(req.user.id, req.body);
    (0, apiResponse_1.success)(res, user);
}
async function uploadKyc(req, res) {
    if (!req.user) {
        throw new Error("Unauthorized");
    }
    const user = await userService.uploadKyc(req.user.id, req.body.documentUrl);
    (0, apiResponse_1.success)(res, user);
}
