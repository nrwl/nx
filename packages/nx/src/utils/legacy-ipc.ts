/**
 * `NX_LEGACY_IPC=true` restores the task IPC that predates the string table:
 * JSON channels to task workers, a task graph serialized per fork, and no
 * string tables on any socket.
 */
export function isLegacyIpc(): boolean {
  return process.env.NX_LEGACY_IPC === 'true';
}

export function workerSerialization(): 'advanced' | 'json' {
  return isLegacyIpc() ? 'json' : 'advanced';
}
