import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
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
      'should compute project graph when loading playwright.config.cts',
      () => {
        // Regression: the playwright generator emits `playwright.config.cts`
        // (CJS-shape: `require()`, `module.exports`, `__filename`) so the
        // file is forced to CommonJS regardless of workspace `type:
        // "module"`. A `.ts` config with ESM syntax (top-level `import` +
        // `import.meta.dirname`) loads fine via Nx's native strip ESM
        // detection but blows up in Playwright's pirates loader, which
        // compiles to CJS-shape (`exports.X = ...`) yet leaves
        // `import.meta` intact - Node then re-detects ESM from the
        // compiled output and errors on
        // "exports is not defined in ES module scope". `.cts` sidesteps
        // both: pirates forces CJS, Node honors the extension.
        const app = uniq('app');
        runCLI(
          `generate @nx/web:app ${app} --unitTestRunner=none --bundler=vite --e2eTestRunner=none --style=css --no-interactive`
        );
        runCLI(
          `generate @nx/playwright:configuration --project ${app} --webServerCommand="echo test" --webServerAddress="http://localhost:4200"`
        );
        checkFilesExist(`${app}/playwright.config.cts`);

        // Confirm the generator chose `.cts` and CJS shape. (`import.meta`
        // appears literally in the template's doc comment explaining the
        // .cts choice, so we check for the expression form instead.)
        const cfg = readFile(`${app}/playwright.config.cts`);
        expect(cfg).toContain('module.exports = defineConfig');
        expect(cfg).toContain('__filename');
        expect(cfg).not.toContain('import.meta.dirname');
        expect(cfg).not.toContain('export default');

        const { graph } = runGraph();

        expect(graph.graph.nodes[app]).toBeDefined();
      },
      TEN_MINS_MS
    );
  });

  describe('fallback to swc/ts-node when native strip cannot handle a config', () => {
    // Plugin workers register the swc-node CJS hook the first time a file
    // fails native strip. Subsequent file loads in the SAME worker hit the
    // hook directly and skip the fallback path, so only the first broken
    // file logs a fallback message. To keep each test's assertion meaningful,
    // every test registers its broken config(s) here and afterEach restores
    // each to valid CJS so the next test sees a clean workspace.
    const broken: string[] = [];

    afterEach(() => {
      for (const filePath of broken) {
        const lib = filePath.split('/')[0];
        // `.cts` is the default jest config extension for jest 30+, so keep
        // a valid CJS config in place. Other extensions are test-only - just
        // remove them so the .cts default takes over.
        if (filePath.endsWith('.cts')) {
          updateFile(filePath, `module.exports = { displayName: '${lib}' };\n`);
        } else {
          removeFile(filePath);
        }
      }
      broken.length = 0;
    });

    it(
      'should fall back to swc/ts-node when a TS config uses an enum',
      () => {
        const lib = uniq('lib');
        runCLI(
          `generate @nx/js:lib ${lib} --unitTestRunner=jest --no-interactive`
        );

        // enum is not supported by Node native type stripping - must trigger fallback
        updateFile(
          `${lib}/jest.config.cts`,
          `enum Mode { Standard = 'standard' }
const mode: Mode = Mode.Standard;
module.exports = { displayName: '${lib}', mode };
`
        );
        broken.push(`${lib}/jest.config.cts`);

        // Daemon owns project graph load - disable so fallback log lands in CLI stderr
        // instead of .nx/workspace-data/d/daemon.log. redirectStderr merges stderr
        // into the captured result.
        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

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
        broken.push(`${lib}/jest.config.cts`, `${lib}/jest-helpers.ts`);

        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

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

        // .cts is forced CJS by Node's native loader, so top-level `export`
        // is a SyntaxError. Pre-v23 this worked because swc-node's hook
        // compiled ESM->CJS regardless of extension; the loader's
        // isCjsSyntaxError fallback restores that behavior by escalating to
        // swc-node when a .cts file fails to parse.
        updateFile(
          `${lib}/jest.config.cts`,
          `export default { displayName: '${lib}' };\n`
        );
        broken.push(`${lib}/jest.config.cts`);

        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

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
        broken.push(`${lib}/jest.config.mts`);

        const { result, graph } = runGraph({
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
        });

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
        broken.push(`${lib}/jest.config.mts`);

        const result = runCLI(`graph --file=${GRAPH_FILE}`, {
          env: { NX_VERBOSE_LOGGING: 'true' },
          daemon: false,
          redirectStderr: true,
          silenceError: true,
        });

        expect(result).toContain('Registering ESM TypeScript loader');
      },
      TEN_MINS_MS
    );
  });
});
