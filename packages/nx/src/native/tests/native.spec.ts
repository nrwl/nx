import { hashFile } from '../index';

import { tmpdir } from 'os';
import { mkdtemp, writeFile } from 'fs-extra';
import { join } from 'path';

describe('native', () => {
  it('should hash', async () => {
    expect(hashFile).toBeDefined();

    const tempDirPath = await mkdtemp(join(tmpdir(), 'native-test'));
    const tempFilePath = join(tempDirPath, 'temp.txt');
    await writeFile(tempFilePath, 'content');

    expect(hashFile(tempFilePath).hash).toBe('6193209363630369380');
  });

  it('should create an instance of NativeHasher', () => {
    // const nativeHasher = new NativeFileHasher('/root');
    // expect(nativeHasher instanceof NativeFileHasher).toBe(true);
  });
});
