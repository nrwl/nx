export function isOnDaemon() {
  return !!global.NX_DAEMON;
}

/**
 * Feature flag for gradual rollout of delegating database operations to the daemon.
 */
export function shouldDelegateDbToDaemon(): boolean {
  return process.env.NX_DELEGATE_DB_TO_DAEMON === 'true';
}
