import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NG_RSPACK_SYMBOL_NAME } from '../models';
import {
  ExtractLicensesPlugin,
  extractLicenses,
} from './extract-licenses-plugin';

describe('extractLicenses', () => {
  let root: string;

  const addPackage = async (
    name: string,
    version: string,
    license: string,
    licenseFile?: { name: string; content: string }
  ) => {
    const packageDir = join(root, 'node_modules', name);
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({ name, version, license })
    );
    if (licenseFile) {
      await writeFile(join(packageDir, licenseFile.name), licenseFile.content);
    }
  };

  const metafileFor = (...inputPaths: string[]) => ({
    outputs: {
      0: {
        inputs: Object.fromEntries(
          inputPaths.map((p) => [p, { bytesInOutput: 1 }])
        ),
      },
    },
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'extract-licenses-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('should extract the license of a package with a LICENSE file', async () => {
    await addPackage('foo', '1.0.0', 'MIT', {
      name: 'LICENSE',
      content: 'FOO LICENSE TEXT',
    });

    const content = await extractLicenses(
      metafileFor(join('node_modules', 'foo', 'index.js')),
      root
    );

    expect(content).toContain('Package: foo');
    expect(content).toContain('License: "MIT"');
    expect(content).toContain('FOO LICENSE TEXT');
  });

  it('should extract the license of a scoped package', async () => {
    await addPackage('@scope/bar', '2.0.0', 'Apache-2.0', {
      name: 'LICENSE.md',
      content: 'BAR LICENSE TEXT',
    });

    const content = await extractLicenses(
      metafileFor(join('node_modules', '@scope', 'bar', 'main.js')),
      root
    );

    expect(content).toContain('Package: @scope/bar');
    expect(content).toContain('License: "Apache-2.0"');
    expect(content).toContain('BAR LICENSE TEXT');
  });

  it('should skip paths that are not part of a package', async () => {
    const content = await extractLicenses(
      metafileFor(join('src', 'main.ts')),
      root
    );

    expect(content).not.toContain('Package:');
  });

  it('should skip packages without a package.json', async () => {
    const content = await extractLicenses(
      metafileFor(join('node_modules', 'missing', 'index.js')),
      root
    );

    expect(content).not.toContain('Package:');
  });

  it('should list a package only once for multiple input files', async () => {
    await addPackage('foo', '1.0.0', 'MIT', {
      name: 'LICENSE',
      content: 'FOO LICENSE TEXT',
    });

    const content = await extractLicenses(
      metafileFor(
        join('node_modules', 'foo', 'index.js'),
        join('node_modules', 'foo', 'other.js')
      ),
      root
    );

    expect(content.match(/Package: foo/g)).toHaveLength(1);
  });

  it('should emit an entry without license text when no license file exists', async () => {
    await addPackage('foo', '1.0.0', 'MIT');

    const content = await extractLicenses(
      metafileFor(join('node_modules', 'foo', 'index.js')),
      root
    );

    expect(content).toContain('Package: foo');
    expect(content).toContain('License: "MIT"');
  });
});

describe('ExtractLicensesPlugin', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'extract-licenses-plugin-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const setupFakeCompiler = () => {
    let processAssetsFn: (() => Promise<void>) | undefined;
    const emitAsset = vi.fn();
    const chunks: unknown[] = [];
    const chunkModules = new Map<unknown, unknown[]>();
    const compilation = {
      chunks,
      chunkGraph: {
        getChunkModulesIterable: (chunk: unknown) =>
          chunkModules.get(chunk) ?? [],
      },
      hooks: {
        processAssets: {
          tapPromise: (_opts: unknown, fn: () => Promise<void>) => {
            processAssetsFn = fn;
          },
        },
      },
      emitAsset,
    };
    const compiler = {
      hooks: {
        thisCompilation: {
          tap: (_name: string, fn: (compilation: unknown) => void) =>
            fn(compilation),
        },
      },
      rspack: {
        Compilation: { PROCESS_ASSETS_STAGE_REPORT: 5000 },
        sources: {
          RawSource: class {
            constructor(public source: string) {}
          },
        },
      },
    };
    return {
      compiler,
      compilation,
      chunks,
      chunkModules,
      emitAsset,
      runProcessAssets: () => {
        if (!processAssetsFn) {
          throw new Error('processAssets was not tapped');
        }
        return processAssetsFn();
      },
    };
  };

  const addPackage = async (name: string, version: string, license: string) => {
    const packageDir = join(root, 'node_modules', name);
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({ name, version, license })
    );
    await writeFile(join(packageDir, 'LICENSE'), `${name} LICENSE TEXT`);
  };

  it('should emit a licenses asset for the packages in the chunk graph', async () => {
    await addPackage('foo', '1.0.0', 'MIT');
    const { compiler, chunks, chunkModules, emitAsset, runProcessAssets } =
      setupFakeCompiler();
    const chunk = {};
    chunks.push(chunk);
    chunkModules.set(chunk, [
      {
        nameForCondition: () => join(root, 'node_modules', 'foo', 'index.js'),
      },
      { nameForCondition: () => join(root, 'src', 'main.ts') },
      { nameForCondition: () => undefined },
    ]);

    new ExtractLicensesPlugin({
      outputFilename: '../3rdpartylicenses.txt',
      rootDirectory: root,
    }).apply(compiler as never);
    await runProcessAssets();

    expect(emitAsset).toHaveBeenCalledTimes(1);
    const [assetName, source] = emitAsset.mock.calls[0];
    expect(assetName).toBe('../3rdpartylicenses.txt');
    expect(source.source).toContain('Package: foo');
    expect(source.source).toContain('foo LICENSE TEXT');
  });

  it('should include packages from concatenated module inner modules', async () => {
    await addPackage('bar', '1.0.0', 'MIT');
    const { compiler, chunks, chunkModules, emitAsset, runProcessAssets } =
      setupFakeCompiler();
    const chunk = {};
    chunks.push(chunk);
    chunkModules.set(chunk, [
      {
        nameForCondition: () => join(root, 'src', 'main.ts'),
        modules: [
          {
            nameForCondition: () =>
              join(root, 'node_modules', 'bar', 'index.js'),
          },
        ],
      },
    ]);

    new ExtractLicensesPlugin({
      outputFilename: '../3rdpartylicenses.txt',
      rootDirectory: root,
    }).apply(compiler as never);
    await runProcessAssets();

    const [, source] = emitAsset.mock.calls[0];
    expect(source.source).toContain('Package: bar');
  });

  it('should include packages bundled into component stylesheets', async () => {
    await addPackage('css-pkg', '1.0.0', 'MIT');
    const { compiler, compilation, emitAsset, runProcessAssets } =
      setupFakeCompiler();
    (compilation as Record<string, unknown>)[NG_RSPACK_SYMBOL_NAME] = () => ({
      stylesheetMetafileInputs: {
        [join('node_modules', 'css-pkg', 'styles.css')]: { bytesInOutput: 10 },
      },
    });

    new ExtractLicensesPlugin({
      outputFilename: '../3rdpartylicenses.txt',
      rootDirectory: root,
    }).apply(compiler as never);
    await runProcessAssets();

    const [, source] = emitAsset.mock.calls[0];
    expect(source.source).toContain('Package: css-pkg');
  });

  it('should emit the union of the inputs shared across compilers', async () => {
    await addPackage('browser-pkg', '1.0.0', 'MIT');
    await addPackage('server-pkg', '1.0.0', 'MIT');
    const sharedInputs = new Map();

    const browser = setupFakeCompiler();
    const browserChunk = {};
    browser.chunks.push(browserChunk);
    browser.chunkModules.set(browserChunk, [
      {
        nameForCondition: () =>
          join(root, 'node_modules', 'browser-pkg', 'index.js'),
      },
    ]);
    new ExtractLicensesPlugin({
      outputFilename: '../3rdpartylicenses.txt',
      rootDirectory: root,
      sharedInputs,
    }).apply(browser.compiler as never);
    await browser.runProcessAssets();

    const server = setupFakeCompiler();
    const serverChunk = {};
    server.chunks.push(serverChunk);
    server.chunkModules.set(serverChunk, [
      {
        nameForCondition: () =>
          join(root, 'node_modules', 'server-pkg', 'index.js'),
      },
    ]);
    new ExtractLicensesPlugin({
      outputFilename: '../3rdpartylicenses.txt',
      rootDirectory: root,
      sharedInputs,
    }).apply(server.compiler as never);
    await server.runProcessAssets();

    // The browser compiler ran first with only its own inputs; the server
    // compiler runs after it and emits the union of both.
    const [, browserSource] = browser.emitAsset.mock.calls[0];
    expect(browserSource.source).toContain('Package: browser-pkg');
    const [, serverSource] = server.emitAsset.mock.calls[0];
    expect(serverSource.source).toContain('Package: browser-pkg');
    expect(serverSource.source).toContain('Package: server-pkg');
  });
});
