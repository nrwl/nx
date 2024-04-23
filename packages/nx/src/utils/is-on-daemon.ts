export function isOnDaemon() {
  return !!process.env.NX_ON_DAEMON_PROCESS;
}
