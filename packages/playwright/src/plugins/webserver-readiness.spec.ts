import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _setChildEval,
  _setWorkerScriptPath,
  normalizeWebServers,
  resolveWebServersUnderEnv,
  taskEnvDivergesFromAmbient,
} from './webserver-readiness';

// Mirrors the module's own cap so the concurrency assertions don't depend on
// the host's core count.
const MAX_CONCURRENT_EVALS = Math.max(1, Math.min(cpus().length, 8));

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('normalizeWebServers', () => {
  it('returns [] when there is no web server', () => {
    expect(normalizeWebServers(undefined)).toEqual([]);
  });

  it('normalizes a single web server and an array the same way', () => {
    const server = {
      command: 'nx serve app',
      url: 'http://localhost:4300',
      port: 4300,
      reuseExistingServer: true,
      ignoreHTTPSErrors: true,
      timeout: 1000,
    };
    expect(normalizeWebServers(server)).toEqual([server]);
    expect(normalizeWebServers([server])).toEqual([server]);
  });

  it('projects `wait` to a boolean and drops run-only fields like cwd and env', () => {
    expect(
      normalizeWebServers({
        command: 'nx serve app',
        url: 'http://localhost:4300',
        reuseExistingServer: true,
        cwd: '/tmp/app',
        env: { FOO: 'bar' },
        wait: { stdout: /ready/ },
      })
    ).toEqual([
      {
        command: 'nx serve app',
        url: 'http://localhost:4300',
        reuseExistingServer: true,
        waitsForOutput: true,
      },
    ]);
  });

  it('sets waitsForOutput for either stdio regex and not for an empty wait', () => {
    const normalized = (wait: object) =>
      normalizeWebServers({ command: 'x', wait })[0].waitsForOutput;
    expect(normalized({ stdout: /ready/ })).toBe(true);
    expect(normalized({ stderr: /ready/ })).toBe(true);
    expect(normalized({})).toBeUndefined();
  });
});

describe('taskEnvDivergesFromAmbient', () => {
  it('is false for an env identical to process.env', () => {
    expect(taskEnvDivergesFromAmbient({ ...process.env })).toBe(false);
  });

  it('is true when a key is added, changed, or removed', () => {
    expect(taskEnvDivergesFromAmbient({ ...process.env, NX_TEST: '1' })).toBe(
      true
    );
    const withoutOne = { ...process.env };
    const [firstKey] = Object.keys(withoutOne);
    if (firstKey) {
      delete withoutOne[firstKey];
      expect(taskEnvDivergesFromAmbient(withoutOne)).toBe(true);
    }
  });
});

describe('resolveWebServersUnderEnv concurrency', () => {
  afterEach(() => _setChildEval(null));

  it('never exceeds the cap and drains the queue in submission order', async () => {
    let active = 0;
    let peak = 0;
    const startOrder: string[] = [];
    const releasers: Array<() => void> = [];
    _setChildEval(
      (configFilePath) =>
        new Promise((resolve) => {
          active++;
          peak = Math.max(peak, active);
          startOrder.push(configFilePath);
          releasers.push(() => {
            active--;
            resolve([]);
          });
        })
    );

    const total = MAX_CONCURRENT_EVALS + 3;
    const ids = Array.from({ length: total }, (_, i) => String(i));
    const all = ids.map((id) => resolveWebServersUnderEnv(id, 'root', {}));

    await flush();
    // Only the cap started; the rest are queued and have not called childEval.
    expect(active).toBe(MAX_CONCURRENT_EVALS);

    for (let i = 0; i < total; i++) {
      while (releasers.length === 0) {
        await flush();
      }
      releasers.shift()!();
      await flush();
    }

    await Promise.all(all);
    expect(peak).toBe(MAX_CONCURRENT_EVALS);
    // A LIFO queue (pop instead of shift) would start the queued evals in
    // reverse submission order.
    expect(startOrder).toEqual(ids);
  });

  it('keeps the cap when a new caller barges in between a release and the woken waiter', async () => {
    let active = 0;
    let peak = 0;
    const releasers: Array<() => void> = [];
    _setChildEval(
      () =>
        new Promise((resolve) => {
          active++;
          peak = Math.max(peak, active);
          releasers.push(() => {
            active--;
            resolve([]);
          });
        })
    );

    const all: Array<Promise<unknown>> = [];
    for (let i = 0; i < MAX_CONCURRENT_EVALS + 1; i++) {
      all.push(resolveWebServersUnderEnv(String(i), 'root', {}));
    }
    await flush();
    expect(active).toBe(MAX_CONCURRENT_EVALS);

    // Free a slot, then queue a new call as a microtask so it runs after the
    // release's continuation but before the woken waiter resumes; without the
    // waiter's re-check both would claim the single free slot.
    releasers.shift()!();
    await new Promise<void>((resolve) =>
      queueMicrotask(() => {
        all.push(resolveWebServersUnderEnv('barge', 'root', {}));
        resolve();
      })
    );

    let done = false;
    void Promise.all(all).then(() => (done = true));
    while (!done) {
      await flush();
      while (releasers.length > 0) {
        releasers.shift()!();
      }
    }
    expect(peak).toBe(MAX_CONCURRENT_EVALS);
  });

  it('releases the slot when an evaluation rejects', async () => {
    _setChildEval((configFilePath) =>
      configFilePath === 'reject'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve([])
    );

    const results = await Promise.allSettled([
      ...Array.from({ length: MAX_CONCURRENT_EVALS }, () =>
        resolveWebServersUnderEnv('reject', 'root', {})
      ),
      resolveWebServersUnderEnv('ok', 'root', {}),
    ]);

    // The final call is queued behind the cap; it only runs if the rejected
    // evaluations release their slots.
    expect(results[MAX_CONCURRENT_EVALS].status).toBe('fulfilled');
  });
});

describe('forkChildEval (real fork)', () => {
  let fixtureDir: string;

  const writeWorker = (name: string, body: string): string => {
    const path = join(fixtureDir, name);
    writeFileSync(path, body);
    return path;
  };

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), 'pw-webserver-readiness-'));
  });
  afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));
  afterEach(() => _setWorkerScriptPath(null));

  it('resolves with the result message the worker sends', async () => {
    _setWorkerScriptPath(
      writeWorker(
        'ok.js',
        `process.send({ type: 'webserver-config-result', webServers: [{ command: 'x', url: 'http://localhost:4301' }] }, () => process.exit(0));`
      )
    );
    await expect(
      resolveWebServersUnderEnv('config.ts', 'root', {})
    ).resolves.toEqual([{ command: 'x', url: 'http://localhost:4301' }]);
  });

  it('ignores messages without the worker tag', async () => {
    // The evaluated config runs arbitrary user code that can call process.send
    // itself. A primitive or an untagged object must neither settle nor crash
    // the resolution; only the tagged result does.
    _setWorkerScriptPath(
      writeWorker(
        'chatty.js',
        `process.send('ready');
process.send({ event: 'progress' });
process.send({ type: 'webserver-config-result', webServers: [{ command: 'x', url: 'http://localhost:4301' }] }, () => process.exit(0));`
      )
    );
    await expect(
      resolveWebServersUnderEnv('config.ts', 'root', {})
    ).resolves.toEqual([{ command: 'x', url: 'http://localhost:4301' }]);
  });

  it('rejects a tagged error message even when the string is empty', async () => {
    // Guards the throw-don't-fall-back design: an empty error string must not
    // read as a successful (empty) result.
    _setWorkerScriptPath(
      writeWorker(
        'empty-error.js',
        `process.send({ type: 'webserver-config-error', error: '' }, () => process.exit(0));`
      )
    );
    await expect(
      resolveWebServersUnderEnv('config.ts', 'root', {})
    ).rejects.toThrow();
  });

  it('folds the worker stderr into a nonzero-exit rejection', async () => {
    _setWorkerScriptPath(
      writeWorker(
        'crash.js',
        `process.stderr.write('boom-detail', () => process.exit(3));`
      )
    );
    await expect(
      resolveWebServersUnderEnv('config.ts', 'root', {})
    ).rejects.toThrow(/exited with code 3[\s\S]*boom-detail/);
  });
});
