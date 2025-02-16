import { readTsConfigOptions } from './typescript';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe.only('readTsConfigOptions', () => {
  it('should handle extends', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'typescript.spec'));
    await writeFile(
      join(dir, 'a.json'),
      JSON.stringify({ extends: './b.json' })
    );
    await writeFile(
      join(dir, 'b.json'),
      JSON.stringify({ compilerOptions: { strict: true } })
    );

    expect(readTsConfigOptions(join(dir, 'a.json'))).toEqual({
      configFilePath: undefined,
      strict: true,
    });
  });
});
