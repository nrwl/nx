/**
 * Returns an array of CallSite objects representing the current call stack.
 *
 * NOTE: The returned CallSite[] does not include the frame for getCallSites itself,
 * but will include the function that called getCallSites. If you are checking for
 * things like recursion, you need to make sure to account for that.
 *
 * The behavior should match node:util.getCallSites, introduced in Node.js v22.0.0.
 *
 * The returned call sites are deduplicated to normalize differences between
 * runtimes (e.g. Bun produces duplicate consecutive frames for async functions).
 *
 * @todo(@AgentEnder) Move this to node:util when we remove support for Node.js versions < 22, around Nx 24
 *
 * @returns {NodeJS.CallSite[]} An array of CallSite objects.
 */
export function getCallSites() {
  const prepareStackTraceBackup = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stackTraces: NodeJS.CallSite[]) => {
    return stackTraces;
  };

  const errorObject = {};
  Error.captureStackTrace(errorObject);
  const trace = (errorObject as any).stack as NodeJS.CallSite[];
  Error.prepareStackTrace = prepareStackTraceBackup;

  // Remove all leading frames for getCallSites itself.
  // In Node, there is exactly one such frame. In Bun, async function
  // boundaries may produce duplicate consecutive frames, so we remove
  // all leading frames with the getCallSites function name.
  while (trace.length > 0 && trace[0].getFunctionName() === 'getCallSites') {
    trace.shift();
  }

  return deduplicateCallSites(trace);
}

/**
 * Removes consecutive duplicate call sites that have the same function name
 * and file name. Some runtimes (e.g. Bun) produce duplicate consecutive
 * frames for async function boundaries, which can cause incorrect behavior
 * when analyzing the call stack (e.g. false-positive loop detection).
 *
 * This only removes *consecutive* duplicates to preserve legitimate recursion
 * patterns where the same function appears non-consecutively in the stack.
 */
export function deduplicateCallSites(
  callSites: NodeJS.CallSite[]
): NodeJS.CallSite[] {
  if (callSites.length <= 1) {
    return callSites;
  }

  const result: NodeJS.CallSite[] = [callSites[0]];
  for (let i = 1; i < callSites.length; i++) {
    const prev = callSites[i - 1];
    const curr = callSites[i];
    if (
      curr.getFunctionName() === prev.getFunctionName() &&
      curr.getFileName() === prev.getFileName()
    ) {
      continue;
    }
    result.push(curr);
  }
  return result;
}
