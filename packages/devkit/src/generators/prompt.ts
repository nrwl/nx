import { isCI } from 'nx/src/devkit-internals';

/**
 * `@clack/prompts` is ESM-only; `module: nodenext` preserves this dynamic
 * import through CommonJS emit.
 *
 * Imported directly rather than through `nx/src/devkit-internals`: this file
 * ships to external plugins under devkit's +/- 1 major tolerance, so it cannot
 * rely on symbols added to a newer `nx` than the one installed.
 */
async function prompts() {
  return await import('@clack/prompts');
}

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
 * (`selectPrompt`, `textPrompt`, ...) rather than describing a question through one
 * union type.
 */
export async function whenInteractive<T>(
  defaultValue: T,
  ask: () => Promise<T>
): Promise<T> {
  return isInteractive() ? ask() : defaultValue;
}

/**
 * Free-text prompt for devkit's own generators.
 *
 * devkit keeps its own rather than importing the shared helper from
 * `nx/src/devkit-internals`: this file ships under the +/- 1 major tolerance,
 * so it cannot depend on symbols added to a newer `nx`. First-party plugins
 * have no such constraint and should use `@nx/devkit/internal`.
 */
export async function textPrompt(options: {
  message: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
}): Promise<string> {
  const { text, isCancel } = await prompts();
  const answer = await text(options);
  if (isCancel(answer)) {
    process.exit(130);
  }
  return answer as string;
}
