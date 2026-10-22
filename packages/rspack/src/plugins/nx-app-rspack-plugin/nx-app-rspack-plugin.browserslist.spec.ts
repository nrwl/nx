import { rspack, type Configuration } from '@rspack/core';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NxAppRspackPlugin } from './nx-app-rspack-plugin';

vi.mock('../utils/plugins/normalize-options', () => ({
  normalizeOptions: (options) => options,
}));

describe('NxAppRspackPlugin browserslist support', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-rspack-browserslist-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(
      join(root, 'src/main.ts'),
      `import './styles.css';\nconsole.log(Number(globalThis.x) ** 2);\n`
    );
    writeFileSync(join(root, 'src/styles.css'), '.a { user-select: none; }\n');
    mkdirSync(join(root, 'node_modules/browserslist-config-test'), {
      recursive: true,
    });
    writeFileSync(
      join(root, 'node_modules/browserslist-config-test/index.js'),
      `module.exports = ['last 1 chrome version'];`
    );
    global.NX_GRAPH_CREATION = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.NX_GRAPH_CREATION;
    rmSync(root, { recursive: true, force: true });
  });

  async function build(target: Configuration['target']) {
    const compiler = rspack({
      mode: 'production',
      target,
      output: { path: join(root, 'dist') },
      plugins: [
        new NxAppRspackPlugin({
          root,
          projectRoot: '.',
          main: 'src/main.ts',
          index: 'src/index.html',
          mode: 'production',
          optimization: true,
          outputHashing: 'none',
          externalDependencies: 'none',
          generateIndexHtml: false,
          typeCheckOptions: false,
          useTsconfigPaths: false,
          progress: false,
        } as ConstructorParameters<typeof NxAppRspackPlugin>[0]),
      ],
    });
    await new Promise<void>((resolve, reject) =>
      compiler.run((err, stats) =>
        compiler.close((closeErr) => {
          if (err || closeErr) {
            reject(err ?? closeErr);
          } else if (stats.hasErrors()) {
            reject(new Error(stats.toString({ errors: true, all: false })));
          } else {
            resolve();
          }
        })
      )
    );
  }

  it.each([
    {
      name: 'the default targets without a browserslist config',
      browserslist: null,
      script: 'Math.pow(',
      style: '-webkit-user-select:none',
    },
    {
      name: 'the browsers in a browserslist query',
      browserslist: 'last 1 chrome version',
      script: '**2',
      style: '.a{user-select:none}',
    },
    {
      name: 'the browsers in an extended browserslist config',
      browserslist: 'extends browserslist-config-test',
      script: '**2',
      style: '.a{user-select:none}',
    },
    {
      name: 'Safari Technology Preview',
      browserslist: 'safari TP',
      script: '**2',
      style: '.a{user-select:none}',
    },
    {
      name: 'the browsers in a browserslist config with the browserslist target',
      browserslist: 'last 1 chrome version',
      target: 'browserslist' as const,
      script: '**2',
      style: '.a{user-select:none}',
    },
    {
      name: 'the browsers in a browserslist target query',
      browserslist: null,
      target: 'browserslist:last 1 chrome version' as const,
      script: '**2',
      style: '.a{user-select:none}',
    },
  ])(
    'builds web apps for $name',
    async ({ browserslist, target = 'web' as const, script, style }) => {
      if (browserslist) {
        writeFileSync(join(root, '.browserslistrc'), browserslist);
      }

      await build(target);

      expect(readFileSync(join(root, 'dist/main.js'), 'utf8')).toContain(
        script
      );
      expect(readFileSync(join(root, 'dist/main.css'), 'utf8')).toContain(
        style
      );
    }
  );

  it.each([
    {
      name: 'the default browserslist query',
      browserslist: 'defaults',
      script: '**2',
    },
    {
      name: 'the oldest version of browsers that share a swc name',
      browserslist: 'op_mob 12.1, opera 100',
      script: 'Math.pow(',
    },
  ])('compiles scripts for $name', async ({ browserslist, script }) => {
    writeFileSync(join(root, '.browserslistrc'), browserslist);

    await build('web');

    expect(readFileSync(join(root, 'dist/main.js'), 'utf8')).toContain(script);
  });

  it('builds web apps when rspack returns nothing from its defaults', async () => {
    const applyDefaults = rspack.config.applyRspackOptionsDefaults;
    vi.spyOn(rspack.config, 'applyRspackOptionsDefaults').mockImplementation(
      (options) => {
        applyDefaults(options);
        // Rspack 1.6 and earlier return nothing.
        return undefined;
      }
    );

    await build('web');

    expect(readFileSync(join(root, 'dist/main.css'), 'utf8')).toContain(
      'user-select:none'
    );
  });

  it('writes the rspack runtime for the browsers in a browserslist config', async () => {
    writeFileSync(join(root, '.browserslistrc'), 'ie 11');

    await build('web');

    expect(readFileSync(join(root, 'dist/runtime.js'), 'utf8')).not.toContain(
      '=>'
    );
  });

  it('does not apply a browserslist config to node builds', async () => {
    writeFileSync(
      join(root, 'src/main.ts'),
      'console.log(Number(globalThis.x) ** 2);\n'
    );
    writeFileSync(join(root, '.browserslistrc'), 'last 1 chrome version');

    await build('node');

    expect(readFileSync(join(root, 'dist/main.js'), 'utf8')).toContain(
      'Math.pow('
    );
  });
});
