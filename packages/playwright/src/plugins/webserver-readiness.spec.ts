import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _setChildEval,
  _setWorkerScriptPath,
  getProbeEnvDivergence,
  loadConfigWithProbeEnv,
  normalizeWebServers,
  pickProbeEnv,
  resolveWebServersUnderEnv,
  taskEnvDivergesFromAmbient,
  type ConfigEvaluation,
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

  it('names a no_proxy exclusion for a proxy that only routes another protocol', () => {
    // A redirect to https would be routed through https_proxy; the exclusion
    // decides that hop.
    const ambient = { HTTPS_PROXY: 'http://proxy.example:8080' };
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ...ambient, NO_PROXY: 'localhost' },
        ambient
      )
    ).toEqual(['NO_PROXY']);
  });

  it('reports nothing when no_proxy differs but neither env configures a proxy', () => {
    // Every hop is direct on both sides.
    expect(
      getProbeEnvDivergence([httpUrl], { NO_PROXY: 'localhost' }, {})
    ).toEqual([]);
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { NO_PROXY: 'localhost', HTTP_PROXY: '' },
        {}
      )
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

  it('names the all_proxy fallback', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ALL_PROXY: 'http://proxy.example:8080' },
        {}
      )
    ).toEqual(['ALL_PROXY']);
  });

  it('names a proxy variable for a protocol the configured url does not use', () => {
    // An http url can redirect to https, where https_proxy decides the route.
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { HTTPS_PROXY: 'http://proxy.example:8080' },
        {}
      )
    ).toEqual(['HTTPS_PROXY']);
  });

  it('reports nothing for a differing case-variant with the same effective value', () => {
    // The probe reads the lowercase name first, so an uppercase value it never
    // reads is not a difference.
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        {
          http_proxy: 'http://proxy.example:8080',
          HTTP_PROXY: 'http://other.example:8080',
        },
        { http_proxy: 'http://proxy.example:8080' }
      )
    ).toEqual([]);
  });

  it('reports nothing for an empty value against an unset one', () => {
    // The probe treats an empty value as unset.
    expect(getProbeEnvDivergence([httpUrl], { HTTP_PROXY: '' }, {})).toEqual(
      []
    );
  });

  it('reports nothing for a proxy that no_proxy=* masks on both sides', () => {
    // Every hop is direct on both sides, whatever the proxy variables say.
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { HTTP_PROXY: 'http://a.example:8080', NO_PROXY: '*' },
        { HTTP_PROXY: 'http://b.example:8080', NO_PROXY: '*' }
      )
    ).toEqual([]);
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { HTTP_PROXY: 'http://a.example:8080', NO_PROXY: '*' },
        {}
      )
    ).toEqual([]);
  });

  it('reports nothing when a * entry among others excludes every host on both sides', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { HTTP_PROXY: 'http://a.example:8080', NO_PROXY: 'localhost,*' },
        { HTTP_PROXY: 'http://b.example:8080', NO_PROXY: '*,other.example' }
      )
    ).toEqual([]);
  });

  it('names a no_proxy=* that turns a configured proxy off on one side only', () => {
    const proxy = { HTTP_PROXY: 'http://proxy.example:8080' };
    expect(
      getProbeEnvDivergence([httpUrl], { ...proxy, NO_PROXY: '*' }, proxy)
    ).toEqual(['NO_PROXY']);
  });

  it('reports nothing for an all_proxy that explicit protocol proxies mask', () => {
    const explicit = {
      http_proxy: 'http://proxy.example:8080',
      https_proxy: 'http://proxy.example:8080',
    };
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ...explicit, ALL_PROXY: 'http://a.example:8080' },
        { ...explicit, ALL_PROXY: 'http://b.example:8080' }
      )
    ).toEqual([]);
  });

  it('names an all_proxy that decides the route for the other protocol', () => {
    const explicit = { http_proxy: 'http://proxy.example:8080' };
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ...explicit, ALL_PROXY: 'http://a.example:8080' },
        explicit
      )
    ).toEqual(['ALL_PROXY']);
  });

  it('compares no_proxy case-insensitively, as the probe reads it', () => {
    const proxy = { HTTP_PROXY: 'http://proxy.example:8080' };
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ...proxy, NO_PROXY: 'LOCALHOST' },
        { ...proxy, NO_PROXY: 'localhost' }
      )
    ).toEqual([]);
  });

  it('reports nothing for proxy values that normalize to the same url', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { HTTP_PROXY: 'proxy.example:8080' },
        { HTTP_PROXY: 'http://proxy.example:8080/' }
      )
    ).toEqual([]);
  });

  it('names a scheme-less all_proxy that dials https through a different scheme', () => {
    // Without a scheme the value takes the target protocol, so the https route
    // becomes an https proxy on one side and an http proxy on the other.
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ALL_PROXY: 'proxy.example:8080' },
        { ALL_PROXY: 'http://proxy.example:8080' }
      )
    ).toEqual(['ALL_PROXY']);
  });

  it('names a no_proxy suffix entry against an exact-host one', () => {
    // `*example.com` excludes every host ending in example.com; `example.com`
    // only that host.
    const proxy = { HTTP_PROXY: 'http://proxy.example:8080' };
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ...proxy, NO_PROXY: '*example.com' },
        { ...proxy, NO_PROXY: 'example.com' }
      )
    ).toEqual(['NO_PROXY']);
  });

  it('reports nothing for no_proxy entries that differ only in order, separators, or a *. prefix', () => {
    const proxy = { HTTP_PROXY: 'http://proxy.example:8080' };
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { ...proxy, NO_PROXY: 'localhost,*.example.com' },
        { ...proxy, NO_PROXY: '.example.com, localhost' }
      )
    ).toEqual([]);
  });

  it('names only the case-variant that carries the differing value', () => {
    expect(
      getProbeEnvDivergence(
        [httpUrl],
        { http_proxy: 'http://a.example:8080', HTTP_PROXY: 'same' },
        { http_proxy: 'http://b.example:8080', HTTP_PROXY: 'same' }
      )
    ).toEqual(['http_proxy']);
  });

  it('names TLS material for any url probe unless every url server ignores HTTPS errors', () => {
    const taskEnv = { NODE_EXTRA_CA_CERTS: '/certs/ca.pem' };
    expect(getProbeEnvDivergence([httpsUrl], taskEnv, {})).toEqual([
      'NODE_EXTRA_CA_CERTS',
    ]);
    // An http url can redirect to https, where the certificate is verified.
    expect(getProbeEnvDivergence([httpUrl], taskEnv, {})).toEqual([
      'NODE_EXTRA_CA_CERTS',
    ]);
    expect(
      getProbeEnvDivergence(
        [{ ...httpsUrl, ignoreHTTPSErrors: true }],
        taskEnv,
        {}
      )
    ).toEqual([]);
    expect(
      getProbeEnvDivergence(
        [{ ...httpUrl, ignoreHTTPSErrors: true }, httpsUrl],
        taskEnv,
        {}
      )
    ).toEqual(['NODE_EXTRA_CA_CERTS']);
  });

  it('names TLS material behind an https proxy tunnel even when every server ignores HTTPS errors', () => {
    const proxy = { HTTPS_PROXY: 'https://proxy.example:8443' };
    // The tunnel to the proxy is verified with the process defaults, which
    // `ignoreHTTPSErrors` does not reach.
    expect(
      getProbeEnvDivergence(
        [{ ...httpsUrl, ignoreHTTPSErrors: true }],
        { ...proxy, NODE_EXTRA_CA_CERTS: '/certs/proxy-ca.pem' },
        proxy
      )
    ).toEqual(['NODE_EXTRA_CA_CERTS']);
    // An http url can redirect to https and take that tunnel.
    expect(
      getProbeEnvDivergence(
        [{ ...httpUrl, ignoreHTTPSErrors: true }],
        { ...proxy, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
        proxy
      )
    ).toEqual(['NODE_TLS_REJECT_UNAUTHORIZED']);
    // An http proxy needs no TLS, and an https proxy on the http route only is
    // dialled with the request's own `rejectUnauthorized`.
    expect(
      getProbeEnvDivergence(
        [{ ...httpsUrl, ignoreHTTPSErrors: true }],
        {
          HTTPS_PROXY: 'http://proxy.example:8080',
          NODE_EXTRA_CA_CERTS: '/certs/proxy-ca.pem',
        },
        { HTTPS_PROXY: 'http://proxy.example:8080' }
      )
    ).toEqual([]);
    expect(
      getProbeEnvDivergence(
        [{ ...httpsUrl, ignoreHTTPSErrors: true }],
        {
          HTTP_PROXY: 'https://proxy.example:8443',
          NODE_EXTRA_CA_CERTS: '/certs/proxy-ca.pem',
        },
        { HTTP_PROXY: 'https://proxy.example:8443' }
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

const emptyEvaluation: ConfigEvaluation = { webServers: [], probeEnv: {} };

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
            resolve(emptyEvaluation);
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
            resolve(emptyEvaluation);
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
        : Promise.resolve(emptyEvaluation)
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

describe('loadConfigWithProbeEnv', () => {
  let dir: string;
  let originalProbeEnv: Record<string, string>;
  // A config that stands in for the daemon delivering a client env while the
  // load is in flight: it applies one itself, through the same call the
  // plugin worker makes.
  const applyClientEnv = `require(${JSON.stringify(
    require.resolve('@nx/devkit/internal')
  )}).applyDaemonEnvFromClient`;

  const writeConfig = (name: string, body: string): string => {
    const path = join(dir, name);
    writeFileSync(path, body);
    return path;
  };

  beforeAll(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'pw-load-probe-env-')));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  beforeEach(() => {
    // Start from no probe variables at all: the host (a sandbox, a corporate
    // shell) may set some, and the assertions below are absolute.
    originalProbeEnv = pickProbeEnv(process.env);
    for (const variable of Object.keys(originalProbeEnv)) {
      delete process.env[variable];
    }
  });
  afterEach(() => {
    for (const variable of ['NO_PROXY', 'HTTP_PROXY', 'PROXY_HOST']) {
      delete process.env[variable];
    }
    Object.assign(process.env, originalProbeEnv);
  });

  it('returns the config with the probe env its evaluation wrote, then restores the variables', async () => {
    const path = writeConfig(
      'writes.cjs',
      `process.env.NO_PROXY = 'localhost';
module.exports = { webServer: { command: 'x' } };`
    );

    const { config, probeEnv } = await loadConfigWithProbeEnv<{
      webServer: { command: string };
    }>(path);

    expect(config.webServer.command).toBe('x');
    expect(probeEnv).toEqual({ NO_PROXY: 'localhost' });
    expect(process.env.NO_PROXY).toBeUndefined();
  });

  it("serializes concurrent loads so one config's writes never reach another's probe env", async () => {
    // Without the lock the first config's write lands before the second load
    // snapshots, so the second load reads it as its own and restores to it.
    const writes = writeConfig(
      'writes-first.cjs',
      `process.env.NO_PROXY = 'localhost';
module.exports = {};`
    );
    const reads = writeConfig('reads.cjs', `module.exports = {};`);

    const [writesResult, readsResult] = await Promise.all([
      loadConfigWithProbeEnv(writes),
      loadConfigWithProbeEnv(reads),
    ]);

    expect(writesResult.probeEnv).toEqual({ NO_PROXY: 'localhost' });
    expect(readsResult.probeEnv).toEqual({});
    expect(process.env.NO_PROXY).toBeUndefined();
  });

  it('restores every variable the config wrote, not only the probe ones', async () => {
    // The task and gate dotenv files expand against process.env, so a helper
    // variable left behind would resolve a reference in them at graph time
    // that the task's own process never sees.
    const path = writeConfig(
      'writes-helper.cjs',
      `process.env.PROXY_HOST = 'proxy.example';
module.exports = {};`
    );

    await loadConfigWithProbeEnv(path);

    expect(process.env.PROXY_HOST).toBeUndefined();
  });

  it('re-applies the client env applied mid-load over the pre-load values', async () => {
    // A restore to the pre-load values alone would revert the client's env;
    // the config's writes go, but the client's stay.
    const path = writeConfig(
      'writes-under-swap.cjs',
      `${applyClientEnv}({ ...process.env, HTTP_PROXY: 'http://client.example:8080' });
process.env.NO_PROXY = 'localhost';
process.env.HTTP_PROXY = 'http://config.example:8080';
module.exports = {};`
    );

    const { probeEnv } = await loadConfigWithProbeEnv(path);

    expect(probeEnv).toEqual({
      NO_PROXY: 'localhost',
      HTTP_PROXY: 'http://config.example:8080',
    });
    expect(process.env.NO_PROXY).toBeUndefined();
    expect(process.env.HTTP_PROXY).toBe('http://client.example:8080');
  });

  it('re-applies a mid-load client env whose values the config had already written', async () => {
    // Such an apply changes nothing at the time, so nothing but the apply
    // sequence records it; a restore keyed on changed values would then delete
    // the client's variable along with the config's copy of it.
    const path = writeConfig(
      'writes-then-client-matches.cjs',
      `process.env.NO_PROXY = 'localhost';
${applyClientEnv}({ ...process.env });
module.exports = {};`
    );

    await loadConfigWithProbeEnv(path);

    expect(process.env.NO_PROXY).toBe('localhost');
  });

  it('restores the variables when the load throws', async () => {
    const path = writeConfig(
      'throws.cjs',
      `process.env.NO_PROXY = 'localhost';
throw new Error('config boom');`
    );

    await expect(loadConfigWithProbeEnv(path)).rejects.toThrow('config boom');
    expect(process.env.NO_PROXY).toBeUndefined();
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
    // Resolved so the child's cwd (as getcwd reports it) compares equal.
    fixtureDir = realpathSync(
      mkdtempSync(join(tmpdir(), 'pw-webserver-readiness-'))
    );
  });
  afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));
  afterEach(() => _setWorkerScriptPath(null));

  it('resolves with the result message the worker sends', async () => {
    _setWorkerScriptPath(
      writeWorker(
        'ok.js',
        `process.send({ type: 'webserver-config-result', webServers: [{ command: 'x', url: 'http://localhost:4301' }], probeEnv: { NO_PROXY: 'localhost' } }, () => process.exit(0));`
      )
    );
    await expect(
      resolveWebServersUnderEnv('config.ts', fixtureDir, {})
    ).resolves.toEqual({
      webServers: [{ command: 'x', url: 'http://localhost:4301' }],
      probeEnv: { NO_PROXY: 'localhost' },
    });
  });

  it('runs the worker from the project root, not the parent cwd', async () => {
    // Without plugin isolation the parent is the nx CLI process, whose cwd is
    // wherever nx was invoked; the inferred task runs from the project root.
    _setWorkerScriptPath(
      writeWorker(
        'cwd.js',
        `process.send({ type: 'webserver-config-result', webServers: [{ command: process.cwd() }], probeEnv: {} }, () => process.exit(0));`
      )
    );
    const projectRoot = join(fixtureDir, 'apps', 'e2e');
    mkdirSync(projectRoot, { recursive: true });
    expect(projectRoot).not.toBe(process.cwd());
    await expect(
      resolveWebServersUnderEnv('apps/e2e/playwright.config.ts', fixtureDir, {})
    ).resolves.toEqual({
      webServers: [{ command: projectRoot }],
      probeEnv: {},
    });
  });

  it('ignores messages without the worker tag or the result shape', async () => {
    // The evaluated config runs arbitrary user code that can call process.send
    // itself. A primitive, an untagged object or a tagged object missing a
    // field must neither settle nor crash the resolution; only the full result
    // does.
    _setWorkerScriptPath(
      writeWorker(
        'chatty.js',
        `process.send('ready');
process.send({ event: 'progress' });
process.send({ type: 'webserver-config-result', webServers: [] });
process.send({ type: 'webserver-config-result', webServers: [{ command: 'x', url: 'http://localhost:4301' }], probeEnv: {} }, () => process.exit(0));`
      )
    );
    await expect(
      resolveWebServersUnderEnv('config.ts', fixtureDir, {})
    ).resolves.toEqual({
      webServers: [{ command: 'x', url: 'http://localhost:4301' }],
      probeEnv: {},
    });
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
      resolveWebServersUnderEnv('config.ts', fixtureDir, {})
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
      resolveWebServersUnderEnv('config.ts', fixtureDir, {})
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
      const evaluation = resolveWebServersUnderEnv('config.ts', fixtureDir, {});
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
