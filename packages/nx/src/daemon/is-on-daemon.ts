declare global {
  var NX_DAEMON: boolean | undefined;
}

export function isOnDaemon() {
  return !!global.NX_DAEMON;
}
