import { hashFile, hashArray, Watcher } from '../index';

import { tmpdir } from 'os';
import { mkdtemp, writeFile } from 'fs-extra';
import { join } from 'path';

describe('native', () => {
  it('should hash files', async () => {
    expect(hashFile).toBeDefined();

    const tempDirPath = await mkdtemp(join(tmpdir(), 'native-test'));
    const tempFilePath = join(tempDirPath, 'temp.txt');
    await writeFile(tempFilePath, 'content');

    expect(hashFile(tempFilePath).hash).toBe('6193209363630369380');
  });

  it('should hash content', async () => {
    expect(hashArray).toBeDefined();

    expect(hashArray(["one", "two"])).toEqual("10960201262927338690")
  });

  it('should create an instance of NativeHasher', () => {
    // const nativeHasher = new NativeFileHasher('/root');
    // expect(nativeHasher instanceof NativeFileHasher).toBe(true);
  });
});

describe('watcher', () => {
  it('should watch files', (done) => {
    let watcher = new Watcher('/Users/jon/Dev/nx', (error, paths) => {
      console.log(paths);
      watcher.stop();
      done();
    });

    watcher.start();
  }, 10_000_000);
});
