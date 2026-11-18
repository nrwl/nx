/**
 * EACCES and EPERM are the two errnos that mean the operating system refused
 * us, rather than that nothing was there or nothing was listening. What they
 * call for differs by what was being opened -- a socket owned by another user,
 * a sandbox denying a bind, a settings file the agent harness protects -- but
 * they share the property that retrying cannot change the answer.
 *
 * Deliberately import-free: the plugin worker entry point and the daemon client
 * both reach this, and neither can afford to pull a module graph in for it.
 */
export function isPermissionDenied(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EACCES' || code === 'EPERM';
}
