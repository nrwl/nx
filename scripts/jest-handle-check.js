// Jest globalTeardown that asserts no unwanted open handles remain after the
// test run. This is a focused replacement for `--detectOpenHandles`.
//
// Why we're not using `--detectOpenHandles`:
//   napi-rs v3 spawns a "CustomGC" ThreadSafeFunction for the lifetime of the
//   loaded native binding (it drives the GC integration thread). It has no
//   public shutdown API and is intentionally held until process exit. Because
//   most nx specs transitively load `@nx/nx-<platform>` (via `analytics.ts`
//   -> `loaded-nx-plugin` and friends), `--detectOpenHandles` printed an
//   unactionable warning on every test run.
//
// Instead, we use Node's private `process._getActiveHandles()` /
// `process._getActiveRequests()` and allowlist handles whose constructor name
// matches a small set of known-benign cases. Anything else fails the run.

const ALLOWED_HANDLE_CONSTRUCTORS = new Set([
  // napi-rs CustomGC ThreadSafeFunction (held for binding lifetime by design).
  // The constructor name varies across napi-rs versions / platforms.
  'ThreadSafeFunction',
  'ThreadsafeFunction',
  'CustomGC',
  // Node intrinsic handles for the parent process's stdio. Jest's worker
  // model can leave these attached briefly during teardown.
  'WriteStream',
  'ReadStream',
  'Pipe',
  'TTY',
  // Benign timer/microtask leftovers.
  'Timeout',
  'Immediate',
  'TickObject',
]);

const ALLOWED_REQUEST_CONSTRUCTORS = new Set([
  // No async requests are expected at teardown; keep this strict.
]);

function describe(handle) {
  if (handle == null) return String(handle);
  const ctor = handle.constructor && handle.constructor.name;
  return ctor || Object.prototype.toString.call(handle);
}

// On Windows, the parent process's stdio is delivered as a `Socket` (not a
// `WriteStream` / `Pipe`). Nothing in production should leave a real network
// socket open at teardown, so we tolerate sockets only when they're bound to
// the standard fds 0 / 1 / 2 — those are stdin / stdout / stderr.
function isStdioSocket(handle) {
  if (!handle || handle.constructor?.name !== 'Socket') return false;
  const fd = handle.fd ?? handle._handle?.fd;
  return fd === 0 || fd === 1 || fd === 2;
}

module.exports = async function jestHandleCheck() {
  // These APIs are private/undocumented but stable enough that jest itself
  // uses them for `--detectOpenHandles`.
  const getHandles = process._getActiveHandles;
  const getRequests = process._getActiveRequests;

  if (typeof getHandles !== 'function' || typeof getRequests !== 'function') {
    // Older/newer Node without the private accessors — skip rather than fail.
    return;
  }

  const handles = getHandles.call(process) || [];
  const requests = getRequests.call(process) || [];

  const unexpectedHandles = handles.filter(
    (h) => !ALLOWED_HANDLE_CONSTRUCTORS.has(describe(h)) && !isStdioSocket(h)
  );
  const unexpectedRequests = requests.filter(
    (r) => !ALLOWED_REQUEST_CONSTRUCTORS.has(describe(r))
  );

  if (unexpectedHandles.length === 0 && unexpectedRequests.length === 0) {
    return;
  }

  const lines = ['[jest-handle-check] Unexpected open handles after tests:'];
  for (const h of unexpectedHandles) {
    let detail = '';
    try {
      detail = ` ${JSON.stringify({
        readable: h.readable,
        writable: h.writable,
        destroyed: h.destroyed,
        fd: h.fd ?? h._handle?.fd,
        path: h.path,
        remoteAddress: h.remoteAddress,
        remotePort: h.remotePort,
        localAddress: h.localAddress,
        localPort: h.localPort,
      })}`;
    } catch (_) {}
    lines.push(`  - handle: ${describe(h)}${detail}`);
  }
  for (const r of unexpectedRequests) {
    lines.push(`  - request: ${describe(r)}`);
  }
  lines.push(
    'If a handle is benign (e.g. a new napi-rs internal), add its constructor name to ALLOWED_HANDLE_CONSTRUCTORS in scripts/jest-handle-check.js.'
  );

  // eslint-disable-next-line no-console
  console.error(lines.join('\n'));
  process.exit(1);
};
