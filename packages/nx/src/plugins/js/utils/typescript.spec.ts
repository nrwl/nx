import { readTsConfigOptions } from './typescript';
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
  it('should handle extends', async () => {
    await fs.createFiles({
      'a.json': JSON.stringify({ extends: './b.json' }),
      'b.json': JSON.stringify({ compilerOptions: { strict: true } }),
    });

    expect(readTsConfigOptions(join(fs.tempDir, 'a.json'))).toEqual({
      configFilePath: undefined,
      strict: true,
    });
  });
});
