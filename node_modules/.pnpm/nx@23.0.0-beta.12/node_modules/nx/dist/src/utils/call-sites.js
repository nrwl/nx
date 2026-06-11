"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCallSites = getCallSites;
/**
 * Returns an array of CallSite objects representing the current call stack.
 *
 * NOTE: The returned CallSite[] does not include the frame for getCallSites itself,
 * but will include the function that called getCallSites. If you are checking for
 * things like recursion, you need to make sure to account for that.
 *
 * The behavior should match node:util.getCallSites, introduced in Node.js v22.0.0.
 *
 * @todo(@AgentEnder) Move this to node:util when we remove support for Node.js versions < 22, around Nx 24
 *
 * @returns {NodeJS.CallSite[]} An array of CallSite objects.
 */
function getCallSites() {
    const prepareStackTraceBackup = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stackTraces) => {
        return stackTraces;
    };
    const errorObject = {};
    Error.captureStackTrace(errorObject);
    const trace = errorObject.stack;
    Error.prepareStackTrace = prepareStackTraceBackup;
    trace.shift(); // remove getCallSites
    return trace; // return stack up to what called getCallSites
}
