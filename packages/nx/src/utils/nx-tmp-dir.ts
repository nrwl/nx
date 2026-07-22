import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Fixed root for Nx runtime artifacts that must live in a machine-wide tmp
 * location (unix sockets, the native binary file cache). A literal /tmp path
 * is used instead of os.tmpdir() because tmpdir() honors $TMPDIR, which is
 * per-user on macOS, rewritten per-session by sandboxes, and stripped from the
 * daemon's environment — a literal path stays identical across machines,
 * processes and contexts, so it can live in committed, shared config files
 * (e.g. the sandbox allowances written by `nx configure-ai-agents`).
 *
 * This module must stay dependency-free (node builtins only): it is consumed
 * by the native binding loader, which runs before anything else in Nx.
 */
export const NX_TMP_DIR_POSIX = '/tmp/.nx';

/**
 * Windows has no /tmp, named pipes are not subject to filesystem sandboxing,
 * and per-user temp dirs are stable there, so the OS temp dir is fine.
 */
export const NX_TMP_DIR =
  platform() === 'win32' ? join(tmpdir(), '.nx') : NX_TMP_DIR_POSIX;
