/**
 * Check if v8 serializer is enabled for daemon communication.
 * V8 serializer is enabled by default unless explicitly disabled.
 */
export function isV8SerializerEnabled(): boolean {
  return process.env.NX_USE_V8_SERIALIZER !== 'false';
}
