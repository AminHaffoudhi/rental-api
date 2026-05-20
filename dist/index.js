"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("@/config/env");
const app_1 = require("@/app");
const scheduler_1 = require("@/jobs/scheduler");
(0, scheduler_1.startScheduler)();
app_1.app.listen(env_1.PORT, () => {
    console.log(`🚀 rental-api running on port ${env_1.PORT}`);
});
