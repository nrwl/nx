import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';
import ts = require('typescript');
import { oxcDeclarations } from '../../oxc-declarations';

describe('oxcDeclarations', () => {
  let root: string;
  let config: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-rollup-'));
    config = join(root, 'tsconfig.json');
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'entry.js'), 'export const entry = true;');
    writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          isolatedDeclarations: true,
          declaration: true,
          emitDeclarationOnly: true,
          rootDir: 'src',
          outDir: 'dist',
          module: 'nodenext',
          jsx: 'preserve',
          types: [],
        },
        include: ['src/**/*'],
        exclude: ['src/excluded.ts'],
      })
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const build = () =>
    rollup({
      input: join(root, 'entry.js'),
      plugins: [oxcDeclarations({ tsConfig: config })],
    });

  it('matches TypeScript declaration paths, including type-only modules', async () => {
    for (const ext of ['ts', 'tsx', 'mts', 'cts']) {
      writeFileSync(
        join(root, 'src', 'file-' + ext + '.' + ext),
        'export interface Value { id: number }'
      );
    }
    writeFileSync(
      join(root, 'src/excluded.ts'),
      'export interface Excluded {}'
    );
    const parsed = ts.getParsedCommandLineOfConfigFile(
      config,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: () => {
          throw Error('Invalid fixture');
        },
      }
    );
    const reference = ts.createProgram(parsed.fileNames, parsed.options).emit();
    expect(reference.emitSkipped).toBe(false);
    const expected = readdirSync(join(root, 'dist')).sort();
    expect(expected).toEqual([
      'file-cts.d.cts',
      'file-mts.d.mts',
      'file-ts.d.ts',
      'file-tsx.d.ts',
    ]);
    const bundle = await build();
    try {
      const { output } = await bundle.generate({
        format: 'es',
        dir: join(root, 'dist'),
      });
      const assets = output.filter((asset) => asset.type === 'asset');
      expect(assets.map((asset) => asset.fileName).sort()).toEqual(expected);
      for (const asset of assets)
        expect(asset.source).toContain('interface Value');
    } finally {
      await bundle.close();
    }
  });

  it('resolves declaration maps relative to the Rollup output', async () => {
    const json = JSON.parse(readFileSync(config, 'utf8'));
    json.compilerOptions.declarationMap = true;
    writeFileSync(config, JSON.stringify(json));
    writeFileSync(
      join(root, 'src/index.ts'),
      'export const value: number = 1;'
    );
    const bundle = await build();
    try {
      const dir = join(root, 'bundle', 'types');
      await bundle.write({ format: 'es', dir });
      const map = JSON.parse(readFileSync(join(dir, 'index.d.ts.map'), 'utf8'));
      expect(map.sources).toEqual(['../../src/index.ts']);
      expect(readFileSync(join(dir, 'index.d.ts'), 'utf8')).toContain(
        'sourceMappingURL=index.d.ts.map'
      );
    } finally {
      await bundle.close();
    }
  });

  it('fails the build on an isolated declaration diagnostic', async () => {
    writeFileSync(
      join(root, 'src/index.ts'),
      'export const value = Math.random();'
    );
    await expect(build()).rejects.toThrow(/index\.ts/);
  });
  it('requires isolatedDeclarations', async () => {
    const json = JSON.parse(readFileSync(config, 'utf8'));
    json.compilerOptions.isolatedDeclarations = false;
    writeFileSync(config, JSON.stringify(json));
    writeFileSync(
      join(root, 'src/index.ts'),
      'export const value: number = 1;'
    );
    await expect(build()).rejects.toThrow('Enable isolatedDeclarations');
  });
});
