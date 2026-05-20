"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDaysBetween = getDaysBetween;
exports.formatDate = formatDate;
exports.addDays = addDays;
exports.startOfDay = startOfDay;
exports.endOfDay = endOfDay;
/** Inclusive calendar days from start day through end day (both normalized to local start of day). */
function getDaysBetween(start, end) {
    const s = startOfDay(start).getTime();
    const e = startOfDay(end).getTime();
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
}
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}
