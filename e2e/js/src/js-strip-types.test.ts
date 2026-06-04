import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  removeFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

const TEN_MINS_MS = 600_000;
const GRAPH_FILE = 'tmp-graph.json';

// `nx graph --file=...` writes the file even when the project graph is partial
// (a plugin threw), so we assert BOTH that the file exists AND that stdout
// does not contain plugin-failure markers. We key off the NX-prefixed
// `augmentLoadFailure` text ("under Node's native TypeScript stripping") and
// the partial-graph warning - both are unique to actual loader failures.
// Note: Node itself emits `process.emitWarning("Failed to load the ES
// module:...")` while the fallback is recovering; that warning is not a
// failure and is deliberately not matched here.
function runGraph(opts: Parameters<typeof runCLI>[1] = {}): {
  result: string;
  graph: any;
} {
  const result = runCLI(`graph --file=${GRAPH_FILE}`, opts);
  checkFilesExist(GRAPH_FILE);
  const graph = readJson(GRAPH_FILE);
  expect(result).not.toContain("under Node's native TypeScript stripping");
  expect(result).not.toContain('occured while processing the project graph');
  return { result, graph };
}

// Native Node.js TypeScript support is on by default in v23 - no env var needed.
// NX_PREFER_NODE_STRIP_TYPES=false is the opt-out.
describe('native Node.js TypeScript support', () => {
  beforeAll(() => {
    newProject({
      name: uniq('strip-types'),
      packages: [
        '@nx/js',
        '@nx/react',
        '@nx/playwright',
        '@nx/cypress',
        '@nx/web',
      ],
    });
  });

  afterAll(() => cleanupProject());

  describe('project graph computation with TypeScript configs', () => {
    it(
      'should compute project graph when loading jest.config.cts',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );
        checkFilesExist(`${lib}/jest.config.cts`);

        const { graph } = runGraph();

        expect(graph.graph.nodes[lib]).toBeDefined();
      },
      TEN_MINS_MS
    );

    it(
      'should compute project graph when loading cypress.config.ts',
      () => {
        const app = uniq('app');
        runCLI(
          `generate @nx/react:app apps/${app} --e2eTestRunner=cypress --linter=eslint --no-interactive`
        );
        checkFilesExist(`apps/${app}-e2e/cypress.config.ts`);

        const { graph } = runGraph();

        expect(graph.graph.nodes[`${app}-e2e`]).toBeDefined();
      },
      TEN_MINS_MS
    );

    it(
      'should compute project graph when loading playwright.config.mts',
      () => {
        // The playwright generator emits a `.mts` config (ESM-only:
        // top-level `import`, `import.meta.dirname`, `export default`).
        // Node forces `.mts` to ESM regardless of workspace `type`, so this
        // exercises Nx's native strip path for `.mts` configs via
        // `loadTsFile`. The full generator output is snapshotted in
        // `packages/playwright/.../configuration.spec.ts`; here we only
        // care that the loader can read it end-to-end.
        const app = uniq('app');
        runCLI(
          `generate @nx/web:app ${app} --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
        );
        runCLI(
          `generate @nx/playwright:configuration --project ${app} --webServerCommand="echo test" --webServerAddress="http://localhost:4200"`
        );
        checkFilesExist(`${app}/playwright.config.mts`);

        const { graph } = runGraph();

        expect(graph.graph.nodes[app]).toBeDefined();
      },
      TEN_MINS_MS
    );
  });

  describe('fallback to swc/ts-node when native strip cannot handle a config', () => {
    // The workspace is shared across tests (one `newProject` in `beforeAll`),
    // so libs accumulate. Each test must restore its broken config file(s)
    // BEFORE assertions so a later test doesn't see two broken configs at
    // once - the plugin worker registers the swc-node CJS hook on the first
    // broken file it processes, and subsequent broken files silently skip
    // logging, which would make per-test assertions flaky based on
    // `uniq()`-randomized lib ordering. Each test does its own cleanup
    // between graph capture and assertions.
    //
    // Each test must also `nx reset` BEFORE writing its broken config:
    // `runCLI` defaults to NX_DAEMON=true, so the generate call leaves a
    // daemon watching. If the broken config is written while it's alive, the
    // daemon recomputes the graph, executes the config in its (detached)
    // plugin worker, and persists the plugin cache keyed on the broken
    // content. Resetting after the write doesn't help: reset's daemon stop
    // doesn't wait for the worker, so its cache write can land after the
    // wipe. The daemon-less assert run then gets a warm cache hit, never
    // executes the config, and the fallback log it asserts on is never
    // emitted. Killing the daemon before the broken config exists makes the
    // assert run the only process that ever executes it.

    it(
      'should fall back to swc/ts-node when a TS config uses an enum',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // Kill the daemon before writing the broken config (see block comment).
        runCLI('reset');

        // enum is not supported by Node native type stripping - must trigger fallback
        updateFile(
          `${lib}/jest.config.cts`,
          `enum Mode { Standard = 'standard' }
const mode: Mode = Mode.Standard;
module.exports = { displayName: '${lib}', mode };
`
        );

        // Daemon owns project graph load - disable so fallback log lands in CLI stderr
        // instead of .nx/workspace-data/d/daemon.log. redirectStderr merges stderr
        // into the captured result.
        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

        // Restore valid CJS so later tests see a clean workspace.
        updateFile(
          `${lib}/jest.config.cts`,
          `module.exports = { displayName: '${lib}' };\n`
        );

        expect(result).toContain('Native Node.js TypeScript stripping failed');
        expect(graph.graph.nodes[lib]).toBeDefined();
      },
      TEN_MINS_MS
    );

    it(
      'should fall back to swc/ts-node when a TS config uses an extensionless relative import',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // Kill the daemon before writing the broken config (see block comment).
        runCLI('reset');

        // `.cts` + `require()`: keeps the file valid CJS (no SyntaxError, so
        // `isCjsSyntaxError` doesn't short-circuit) but the CJS resolver
        // can't find `./jest-helpers` because Node only tries .js/.json/etc
        // - never .ts. MODULE_NOT_FOUND -> tsconfig-paths fallback (no alias
        // -> still MODULE_NOT_FOUND) -> escalate to swc-node, whose CJS
        // hook adds `.ts` to the extension search and resolves the file.
        //
        // We avoid `.ts` + top-level `import` here: Node syntax-detects ESM
        // from the import statement and caches that decision, so even after
        // we register swc-node's CJS Module._extensions hook, the retry
        // still goes through the ESM loader and hits MODULE_NOT_FOUND
        // again. That ESM-extensionless case is fundamentally not
        // recoverable via the CJS fallback chain - it would need
        // Module.register on an ESM loader.
        updateFile(
          `${lib}/jest-helpers.ts`,
          `module.exports = { displayName: '${lib}' };\n`
        );
        updateFile(
          `${lib}/jest.config.cts`,
          `const { displayName } = require('./jest-helpers');
module.exports = { displayName };
`
        );

        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

        // Restore valid CJS + drop the helper so later tests see a clean workspace.
        updateFile(
          `${lib}/jest.config.cts`,
          `module.exports = { displayName: '${lib}' };\n`
        );
        removeFile(`${lib}/jest-helpers.ts`);

        expect(result).toContain(
          'Module not found after tsconfig-paths; falling back to swc/ts-node'
        );
        expect(graph.graph.nodes[lib]).toBeDefined();
      },
      TEN_MINS_MS
    );

    it(
      'should fall back to swc/ts-node when a .cts config uses ESM `export` syntax',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // Kill the daemon before writing the broken config (see block comment).
        runCLI('reset');

        // .cts is forced CJS by Node's native loader, so top-level `export`
        // is a SyntaxError. Pre-v23 this worked because swc-node's hook
        // compiled ESM->CJS regardless of extension; the loader's
        // isCjsSyntaxError fallback restores that behavior by escalating to
        // swc-node when a .cts file fails to parse.
        updateFile(
          `${lib}/jest.config.cts`,
          `export default { displayName: '${lib}' };\n`
        );

        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

        // Restore valid CJS so later tests see a clean workspace.
        updateFile(
          `${lib}/jest.config.cts`,
          `module.exports = { displayName: '${lib}' };\n`
        );

        expect(result).toContain(
          'ESM syntax in forced-CJS file; falling back to swc/ts-node'
        );
        expect(graph.graph.nodes[lib]).toBeDefined();
      },
      TEN_MINS_MS
    );

    it(
      'should fall back to swc/ts-node when a .mts config uses an enum',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // Kill the daemon before writing the broken config (see block comment).
        runCLI('reset');

        // .mts with an enum: Node 22.12+ require()s sync ESM, native strip
        // throws ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX, loadTsFile registers
        // swc-node (which hooks .mts), retry succeeds.
        updateFile(
          `${lib}/jest.config.mts`,
          `enum Mode { Standard = 'standard' }
const mode: Mode = Mode.Standard;
export default { displayName: '${lib}', mode };
`
        );

        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

        // Drop the .mts so the .cts default takes over for later tests.
        removeFile(`${lib}/jest.config.mts`);

        expect(result).toContain('Native Node.js TypeScript stripping failed');
        expect(graph.graph.nodes[lib]).toBeDefined();
      },
      TEN_MINS_MS
    );

    it(
      'should recover via Module.register when a .mts config combines top-level await and unsupported TS syntax',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // TLA forces dynamic import(); enum forces native strip to fail.
        // swc-node's CJS Module._extensions hook can't intercept dynamic
        // imports, so the lazy fallback in config-utils calls
        // Module.register on @swc-node/register/esm (or ts-node/esm) and
        // retries via loadESM. Note: this permanently switches the
        // process's ESM resolution to the registered loader.
        //
        // Downstream success depends on ts-node/swc-node actually loading
        // the file - that path is fragile (ts-node/esm has known issues
        // with TLA+enum) and exit code can be non-zero. We only assert that
        // the registration log fires, which proves the fallback machinery
        // ran. Use `silenceError: true` + raw runCLI (not runGraph) because
        // the graph file may not be written when ts-node/esm rejects the
        // module.
        updateFile(
          `${lib}/jest.config.mts`,
          `enum Mode { Standard = 'standard' }
const config = await Promise.resolve({ displayName: '${lib}', mode: Mode.Standard });
export default config;
`
        );

        const result = runCLI(`graph --file=${GRAPH_FILE}`, {
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
          silenceError: true,
        });

        // Drop the .mts so the .cts default takes over for later tests.
        removeFile(`${lib}/jest.config.mts`);

        expect(result).toContain('Registering ESM TypeScript loader');
      },
      TEN_MINS_MS
    );
  });
});
