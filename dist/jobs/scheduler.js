"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const autoCompleteBookings_1 = require("@/jobs/autoCompleteBookings");
const sendReturnReminders_1 = require("@/jobs/sendReturnReminders");
function startScheduler() {
    node_cron_1.default.schedule("0 8 * * *", () => {
        void (0, sendReturnReminders_1.sendReturnReminders)().catch((err) => console.error("sendReturnReminders failed", err));
    });
    node_cron_1.default.schedule("0 0 * * *", () => {
        void (0, autoCompleteBookings_1.autoCompleteBookings)().catch((err) => console.error("autoCompleteBookings failed", err));
    });
}
