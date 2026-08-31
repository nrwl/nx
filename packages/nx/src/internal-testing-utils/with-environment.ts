/**
 * Runs `callback` with `env` applied, then puts the environment back.
 *
 * A falsy value unsets the variable for the duration, which is how a test says
 * "as if this were never set".
 */
export function withEnvironmentVariables<T>(
  env: Record<string, string | false | null | undefined>,
  callback: () => T
): T {
  const originalValues: Record<string, string | undefined> = {};
  for (const key in env) {
    originalValues[key] = process.env[key];
    const value = env[key];
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
  const cleanup = () => {
    for (const key in env) {
      const original = originalValues[key];
      // Deleted rather than assigned back. `process.env.X = undefined` stores
      // the STRING "undefined", which is truthy, so restoring a variable that
      // was never set used to leave every later test in the file seeing it as
      // set — and the failure surfaced somewhere unrelated.
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  };
  const p = callback();
  if (p instanceof Promise) {
    return p.finally(cleanup) as T;
  } else {
    cleanup();
    return p;
  }
}
