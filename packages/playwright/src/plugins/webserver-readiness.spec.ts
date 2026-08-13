import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _setChildEval,
  _setWorkerScriptPath,
  getProbeEnvDivergence,
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

  it('projects `wait` and `env` to booleans and drops run-only fields like cwd', () => {
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
        hasEnv: true,
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

  it('sets hasEnv only for a non-empty env', () => {
    const normalized = (server: object) =>
      normalizeWebServers({ command: 'x', ...server })[0].hasEnv;
    expect(normalized({ env: { PORT: '4300' } })).toBe(true);
    expect(normalized({ env: {} })).toBeUndefined();
    expect(normalized({})).toBeUndefined();
  });
});

describe('getProbeEnvDivergence', () => {
  const httpUrl = { url: 'http://localhost:4200' };
  const httpsUrl = { url: 'https://localhost:4200' };

  it('reports nothing for port-only servers', () => {
    expect(
      getProbeEnvDivergence(
        [{}],
        { HTTP_PROXY: 'http://proxy.example:8080' },
        {}
      )
    ).toEqual([]);
  });

  it('names a no_proxy exclusion that reroutes the probe', () => {
    const ambient = { HTTP_PROXY: 'http://proxy.example:8080' };
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ...ambient, NO_PROXY: 'localhost' },
        ambient
      )
    ).toEqual(['NO_PROXY']);
  });

  it('reports nothing when no_proxy differs but no proxy is configured', () => {
    // The routing decision is direct on both sides; the raw difference cannot
    // change how the server is probed.
    expect(
      getProbeEnvDivergence([httpUrl], { NO_PROXY: 'localhost' }, {})
    ).toEqual([]);
  });

  it('names a proxy the task env adds', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { http_proxy: 'http://proxy.example:8080' },
        {}
      )
    ).toEqual(['http_proxy']);
  });

  it('names the all_proxy fallback when it drives the decision', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ALL_PROXY: 'http://proxy.example:8080' },
        {}
      )
    ).toEqual(['ALL_PROXY']);
  });

  it('ignores a proxy variable for a protocol the url does not use', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { HTTPS_PROXY: 'http://proxy.example:8080' },
        {}
      )
    ).toEqual([]);
  });

  it('names TLS material for a verifying https probe only', () => {
    const taskEnv = { NODE_EXTRA_CA_CERTS: '/certs/ca.pem' };
    expect(getProbeEnvDivergence([httpsUrl], taskEnv, {})).toEqual([
      'NODE_EXTRA_CA_CERTS',
    ]);
    expect(getProbeEnvDivergence([httpUrl], taskEnv, {})).toEqual([]);
    expect(
      getProbeEnvDivergence(
        [{ ...httpsUrl, ignoreHTTPSErrors: true }],
        taskEnv,
        {}
      )
    ).toEqual([]);
  });

  it('names NODE_TLS_REJECT_UNAUTHORIZED for an https probe', () => {
    expect(
      getProbeEnvDivergence(
        [httpsUrl],
        { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
        {}
      )
    ).toEqual(['NODE_TLS_REJECT_UNAUTHORIZED']);
  });

  it('ignores a malformed url', () => {
    expect(
      getProbeEnvDivergence(
        [{ url: 'not a url' }],
        { HTTP_PROXY: 'http://proxy.example:8080' },
        {}
      )
    ).toEqual([]);
  });

  it('accumulates sorted names across servers', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl, httpsUrl],
        {
          http_proxy: 'http://proxy.example:8080',
          NODE_EXTRA_CA_CERTS: '/certs/ca.pem',
        },
        {}
      )
    ).toEqual(['NODE_EXTRA_CA_CERTS', 'http_proxy']);
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
    // Guards the fork's reject contract: an empty error string must not read
    // as a successful (empty) result.
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

  it('kills a hung worker and rejects when the evaluation times out', async () => {
    jest.useFakeTimers();
    try {
      // Holds the event loop open and never reports, like a config stuck in a
      // busy loop or awaiting something that never resolves.
      _setWorkerScriptPath(
        writeWorker('hang.js', `setInterval(() => {}, 1000);`)
      );
      const evaluation = resolveWebServersUnderEnv('config.ts', 'root', {});
      // Attach the rejection expectation before firing the timer so the
      // rejection is never unhandled.
      const assertion = expect(evaluation).rejects.toThrow(
        'Timed out evaluating the Playwright config'
      );
      jest.advanceTimersByTime(30_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
