"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAiAgent = detectAiAgent;
const native_1 = require("../native");
const utils_1 = require("./utils");
function detectAiAgent() {
    const detected = (0, native_1.detectAiAgent)();
    if (detected && utils_1.supportedAgents.includes(detected)) {
        return detected;
    }
    return null;
}
