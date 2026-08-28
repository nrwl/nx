import {
  clearRootTsConfigCustomConditionsCache,
  getDaemonResolveConditionNodeArgs,
  getRootTsConfigCustomConditions,
  readTsConfigOptions,
} from './typescript';
import { join } from 'path';
import { TempFs } from '../../../internal-testing-utils/temp-fs';

describe('readTsConfigOptions', () => {
  let fs: TempFs;
  beforeEach(() => {
    fs = new TempFs('Workspaces');
  });
  afterEach(() => {
    fs.cleanup();
  });

  it('should handle extending local configs', async () => {
    await fs.createFiles({
      'a.json': JSON.stringify({ extends: './b.json' }),
      'b.json': JSON.stringify({ compilerOptions: { strict: true } }),
    });

    expect(readTsConfigOptions(join(fs.tempDir, 'a.json'))).toEqual({
      configFilePath: undefined,
      strict: true,
    });
  });

  it('should handle extending third-party configs', async () => {
    await fs.createFiles({
      'tsconfig.json': JSON.stringify({
        extends: '@fake-third-party/some-package/tsconfig.json',
      }),
      'node_modules/@fake-third-party/some-package/tsconfig.json':
        JSON.stringify({ compilerOptions: { strict: true } }),
    });

    expect(readTsConfigOptions(join(fs.tempDir, 'tsconfig.json'))).toEqual({
      configFilePath: undefined,
      strict: true,
    });
  });
});

describe('getRootTsConfigCustomConditions', () => {
  let fs: TempFs;
  beforeEach(() => {
    fs = new TempFs('custom-conditions');
    clearRootTsConfigCustomConditionsCache();
  });
  afterEach(() => {
    fs.cleanup();
    clearRootTsConfigCustomConditionsCache();
  });

  it('caches conditions per root until explicitly cleared', async () => {
    await fs.createFiles({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { customConditions: ['source'] },
      }),
    });

    expect(getRootTsConfigCustomConditions(fs.tempDir)).toEqual(['source']);

    fs.writeFile(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { customConditions: ['updated'] } })
    );

    // The change is invisible until the cache is invalidated.
    expect(getRootTsConfigCustomConditions(fs.tempDir)).toEqual(['source']);

    clearRootTsConfigCustomConditionsCache();
    expect(getRootTsConfigCustomConditions(fs.tempDir)).toEqual(['updated']);
  });
});

describe('getDaemonResolveConditionNodeArgs', () => {
  it('does not pass plugin conditions to the daemon', async () => {
    const fs = new TempFs('daemon-conditions');
    await fs.createFiles({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { customConditions: ['source'] },
      }),
    });

    expect(getDaemonResolveConditionNodeArgs()).toEqual([]);
    fs.cleanup();
  });
});
