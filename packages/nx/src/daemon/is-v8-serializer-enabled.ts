/**
 * Off by default; set `NX_USE_V8_SERIALIZER=true` to opt in. Governs every Nx
 * socket channel: the daemon client and server, plugin workers, and pseudo-IPC.
 */
export function isV8SerializerEnabled(): boolean {
  return process.env.NX_USE_V8_SERIALIZER === 'true';
}
