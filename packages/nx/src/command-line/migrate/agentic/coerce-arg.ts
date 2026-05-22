/**
 * Normalizes the raw yargs value for `--agentic` to the shape downstream code
 * expects. Validation of agent-id strings happens upstream in the yargs
 * `.check()` chain, so this function only handles shape.
 *
 * Lives in its own file so the yargs command-object can import it without
 * dragging in the rest of the agentic chain (enquirer, which, native bindings,
 * agent definitions, runner) on every `nx <anything>` CLI startup.
 */
export function coerceAgenticArg(value: unknown): string | boolean | undefined {
  if (value === undefined) return undefined;
  // yargs collects repeated occurrences of the same option into an array.
  // Rather than silently picking last/first, error so the user knows the
  // flag conflicts. `--agentic` is a single-value option by intent.
  if (Array.isArray(value)) {
    throw new Error(
      'Error: --agentic was passed more than once. Specify --agentic at most one time.'
    );
  }
  if (value === true || value === '' || value === 'true' || value === 'yes') {
    return true;
  }
  if (value === false || value === 'false' || value === 'no') {
    return false;
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}
