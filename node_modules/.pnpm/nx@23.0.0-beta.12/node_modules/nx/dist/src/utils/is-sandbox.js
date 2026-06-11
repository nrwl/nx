"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSandbox = isSandbox;
function isSandbox() {
    return (!!process.env.SANDBOX_RUNTIME ||
        !!process.env.GEMINI_SANDBOX ||
        !!process.env.CODEX_SANDBOX ||
        !!process.env.CURSOR_SANDBOX);
}
