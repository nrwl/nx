import { join } from 'node:path';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import type { ResolvedConfig } from 'vite';
import { collectSetupFileInputs } from './setup-file-inputs';

describe('collectSetupFileInputs', () => {
  let tempFs: TempFs;
  let workspaceRoot: string;

  beforeEach(() => {
    tempFs = new TempFs('vitest-setup-file-inputs');
    workspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  const config = (test: Record<string, unknown>) =>
    ({
      root: join(workspaceRoot, 'packages/lib'),
      test,
    }) as unknown as ResolvedConfig;

  const collect = (
    test: Record<string, unknown>,
    projectRoot = 'packages/lib'
  ) => collectSetupFileInputs(config(test), projectRoot, workspaceRoot);

  it('should declare a setup file that lives outside the project root', async () => {
    await tempFs.createFiles({ 'tools/vitest/setup.mts': '' });

    expect(
      collect({ setupFiles: ['../../tools/vitest/setup.mts'] }).files
    ).toEqual(['tools/vitest/setup.mts']);
  });

  it('should declare the tsconfig vite resolves for the setup file and its extends chain', async () => {
    await tempFs.createFiles({
      'tools/vitest/setup.mts': '',
      'tools/vitest/tsconfig.json': JSON.stringify({
        extends: '../../tsconfig.shared.json',
      }),
      'tsconfig.shared.json': JSON.stringify({ compilerOptions: {} }),
    });

    expect(
      collect({ setupFiles: ['../../tools/vitest/setup.mts'] }).tsconfigs
    ).toEqual(['tools/vitest/tsconfig.json', 'tsconfig.shared.json']);
  });

  it('should walk up to the nearest tsconfig when the setup file has no sibling one', async () => {
    await tempFs.createFiles({
      'tools/vitest/nested/setup.mts': '',
      'tools/tsconfig.json': JSON.stringify({ compilerOptions: {} }),
    });

    expect(
      collect({ setupFiles: ['../../tools/vitest/nested/setup.mts'] }).tsconfigs
    ).toEqual(['tools/tsconfig.json']);
  });

  it('should declare globalSetup, including the single-string form', async () => {
    await tempFs.createFiles({ 'tools/vitest/global.mts': '' });

    expect(
      collect({ globalSetup: '../../tools/vitest/global.mts' }).files
    ).toEqual(['tools/vitest/global.mts']);
  });

  it('should accept an absolute path', async () => {
    await tempFs.createFiles({ 'tools/vitest/setup.mts': '' });

    expect(
      collect({
        setupFiles: [join(workspaceRoot, 'tools/vitest/setup.mts')],
      }).files
    ).toEqual(['tools/vitest/setup.mts']);
  });

  it('should not declare a setup file inside the project root, which `default` already covers', async () => {
    await tempFs.createFiles({ 'packages/lib/setup.ts': '' });

    expect(collect({ setupFiles: ['./setup.ts'] })).toEqual({
      files: [],
      tsconfigs: [],
    });
  });

  it('should not declare a setup file from node_modules, which the lockfile already covers', async () => {
    await tempFs.createFiles({ 'node_modules/pkg/setup.js': '' });

    expect(
      collect({ setupFiles: ['../../node_modules/pkg/setup.js'] })
    ).toEqual({
      files: [],
      tsconfigs: [],
    });
  });

  it('should skip an entry that does not exist', () => {
    expect(collect({ setupFiles: ['../../tools/vitest/missing.mts'] })).toEqual(
      {
        files: [],
        tsconfigs: [],
      }
    );
  });

  it('should declare nothing for a root project, where `default` covers the workspace', async () => {
    await tempFs.createFiles({ 'tools/vitest/setup.mts': '' });

    expect(
      collect({ setupFiles: ['../../tools/vitest/setup.mts'] }, '.')
    ).toEqual({ files: [], tsconfigs: [] });
  });

  it('should declare nothing when the config has no setup entries', () => {
    expect(collect({})).toEqual({ files: [], tsconfigs: [] });
  });
});
