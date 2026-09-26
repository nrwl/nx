/**
 * Exit code a process uses when the operating system refused the unix socket it
 * tried to bind, as distinct from every other way it can die.
 *
 * A process that cannot bind leaves its parent holding only "it exited", which
 * an OOM kill and a broken install produce just as well, and the errno itself
 * never crosses the process boundary. Both the Nx daemon and the plugin worker
 * bind in a child whose stderr the parent may never see, so this code is how
 * each one's parent learns it was a refusal and can degrade on proof rather than
 * on an environment guess. 78 is sysexits' EX_CONFIG, outside the range Node
 * uses for its own fatal exits.
 *
 * Deliberately import-free: both producers read it on their startup path.
 */
export const SOCKET_REFUSED_EXIT_CODE = 78;
