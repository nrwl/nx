import { isCI } from 'nx/src/devkit-internals';

/**
 * Whether a generator may prompt at all. Requires a TTY, not CI, and the
 * caller having opted in via NX_INTERACTIVE.
 *
 * Generators that cannot ask still need an answer, so callers pair this with
 * the value to assume:
 *
 *     options.name = isInteractive() ? await textPrompt({ ... }) : undefined;
 */
export function isInteractive(): boolean {
  return (
    !isCI() && !!process.stdout.isTTY && process.env.NX_INTERACTIVE === 'true'
  );
}
