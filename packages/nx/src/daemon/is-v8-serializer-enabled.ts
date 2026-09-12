/**
 * Off by default; set `NX_USE_V8_SERIALIZER=true` to opt in. Picks v8 over
 * JSON on every Nx socket channel (daemon client and server, plugin workers,
 * pseudo-IPC) for payloads not sent as a string table; see `serializeWithFallback`.
 */
export function isV8SerializerEnabled(): boolean {
  return process.env.NX_USE_V8_SERIALIZER === 'true';
}
