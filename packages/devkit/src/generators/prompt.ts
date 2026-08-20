import {
  confirmationPrompt as promptForConfirmation,
  isCI,
  selectPrompt as promptForSelection,
  textPrompt as promptForText,
} from 'nx/src/devkit-internals';

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
 * Generators cannot always ask, so every prompt below takes the answer to
 * assume when asking is impossible. `fallback` widens the return type, which
 * is how a generator that has no sensible default gets `undefined` back
 * without asserting it.
 */
type Fallback<F> = { fallback: F };

export async function textPromptIfInteractive<F = never>(
  options: Parameters<typeof promptForText>[0] & Fallback<F>
): Promise<string | F> {
  return isInteractive() ? promptForText(options) : options.fallback;
}

// Let both parameters infer from the arguments. Naming `T` at a call site
// pins `F` to `never`, since TypeScript cannot infer a type argument partially.
export async function selectPromptIfInteractive<T extends string, F = never>(
  options: Parameters<typeof promptForSelection<T>>[0] & Fallback<F>
): Promise<T | F> {
  return isInteractive() ? promptForSelection<T>(options) : options.fallback;
}

export async function confirmationPromptIfInteractive<F = never>(
  options: Parameters<typeof promptForConfirmation>[0] & Fallback<F>
): Promise<boolean | F> {
  return isInteractive() ? promptForConfirmation(options) : options.fallback;
}
