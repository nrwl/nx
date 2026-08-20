import { isCI } from 'nx/src/devkit-internals';

/**
 * Whether a generator may prompt at all. Requires a TTY, not CI, and the
 * caller having opted in via NX_INTERACTIVE.
 */
function isInteractive(): boolean {
  return (
    !isCI() && !!process.stdout.isTTY && process.env.NX_INTERACTIVE === 'true'
  );
}

/**
 * Ask only when prompting is possible, otherwise take the default.
 *
 * The prompt is a callback so callers reach for whichever typed helper fits
 * (`selectPrompt`, `textPrompt`, ...) rather than describing a question
 * through one union type.
 */
export async function whenInteractive<T>(
  defaultValue: T,
  ask: () => Promise<T>
): Promise<T> {
  return isInteractive() ? ask() : defaultValue;
}
