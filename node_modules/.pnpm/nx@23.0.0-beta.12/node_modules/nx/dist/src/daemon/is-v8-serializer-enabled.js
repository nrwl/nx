"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isV8SerializerEnabled = isV8SerializerEnabled;
/**
 * Check if v8 serializer is enabled for daemon communication.
 * V8 serializer is enabled by default unless explicitly disabled.
 */
function isV8SerializerEnabled() {
    return process.env.NX_USE_V8_SERIALIZER === 'true';
}
