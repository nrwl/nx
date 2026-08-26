import {
  getDaemonResolveConditionNodeArgs,
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

describe('getDaemonResolveConditionNodeArgs', () => {
  it('uses process conditions only when registerHooks is unavailable', async () => {
    const fs = new TempFs('daemon-conditions');
    await fs.createFiles({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { customConditions: ['source'] },
      }),
    });
    const nodeModule = require('node:module') as typeof import('node:module');
    const registerHooks = nodeModule.registerHooks;

    try {
      (nodeModule as any).registerHooks = jest.fn();
      expect(getDaemonResolveConditionNodeArgs(fs.tempDir)).toEqual([]);

      (nodeModule as any).registerHooks = undefined;
      expect(getDaemonResolveConditionNodeArgs(fs.tempDir)).toEqual([
        '--conditions',
        'source',
        '--conditions',
        'development',
      ]);
    } finally {
      (nodeModule as any).registerHooks = registerHooks;
      fs.cleanup();
    }
  });
});
