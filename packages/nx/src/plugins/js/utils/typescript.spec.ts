import { readTsConfigInputs, readTsConfigOptions } from './typescript';
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

describe('readTsConfigInputs', () => {
  let fs: TempFs;
  beforeEach(() => {
    fs = new TempFs('ts-config-inputs');
  });
  afterEach(() => {
    fs.cleanup();
  });

  it('includes every config the extends chain reaches', async () => {
    await fs.createFiles({
      'tsconfig.base.json': JSON.stringify({
        extends: './tsconfig.shared.json',
      }),
      'tsconfig.shared.json': JSON.stringify({
        extends: './tsconfig.conditions.json',
      }),
      'tsconfig.conditions.json': JSON.stringify({
        compilerOptions: { customConditions: ['development'] },
      }),
      'tsconfig.unrelated.json': JSON.stringify({}),
    });

    expect(
      readTsConfigInputs(join(fs.tempDir, 'tsconfig.base.json')).sort()
    ).toEqual(
      [
        'tsconfig.base.json',
        'tsconfig.conditions.json',
        'tsconfig.shared.json',
      ].map((name) => join(fs.tempDir, name))
    );
  });

  it('includes a config extended from a package', async () => {
    await fs.createFiles({
      'tsconfig.base.json': JSON.stringify({
        extends: '@acme/tsconfig/base.json',
      }),
      'node_modules/@acme/tsconfig/package.json': JSON.stringify({
        name: '@acme/tsconfig',
      }),
      'node_modules/@acme/tsconfig/base.json': JSON.stringify({
        compilerOptions: { customConditions: ['development'] },
      }),
    });

    expect(
      readTsConfigInputs(join(fs.tempDir, 'tsconfig.base.json'))
    ).toContain(join(fs.tempDir, 'node_modules/@acme/tsconfig/base.json'));
  });
});
