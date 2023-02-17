import { execSync } from 'child_process';
import { mkdirSync, removeSync } from 'fs-extra';
import { dirSync } from 'tmp';
import { getFileHashes, getGitHashForBatch } from './git-hasher';

describe('git-hasher', () => {
  let dir: string;
  const warnSpy = jest.spyOn(console, 'warn');

  beforeEach(() => {
    dir = dirSync().name;
    run(`git init`);
    run(`git config user.email "test@test.com"`);
    run(`git config user.name "test"`);
    run(`git config commit.gpgsign false`);

    warnSpy.mockClear();
  });

  afterEach(() => {
    expect(console.warn).not.toHaveBeenCalled();
    removeSync(dir);
  });

  it('should work', async () => {
    run(`echo AAA > a.txt`);
    run(`git add .`);
    run(`git commit -am init`);
    const hashes = (await getFileHashes(dir)).allFiles;
    expect([...hashes.keys()]).toEqual([`a.txt`]);
    expect(hashes.get(`a.txt`)).toBeDefined();

    // should handle additions
    run(`echo BBB > b.txt`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a.txt`,
      `b.txt`,
    ]);

    run(`git add .`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a.txt`,
      `b.txt`,
    ]);

    run(`git commit  -am second`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a.txt`,
      `b.txt`,
    ]);

    // should handle removals
    // removal unstaged
    run(`rm b.txt`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([`a.txt`]);

    // removal staged
    run(`git add .`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([`a.txt`]);

    // removed committed
    run(`git commit  -am third`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([`a.txt`]);

    // should handle moves
    run(`mv a.txt newa.txt`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `newa.txt`,
    ]);

    run(`git add .`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `newa.txt`,
    ]);

    run(`echo AAAA > a.txt`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `newa.txt`,
      `a.txt`,
    ]);

    run(`git add .`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a.txt`,
      `newa.txt`,
    ]);
  });

  it('should handle spaces in filenames', async () => {
    run(`echo AAA > "a b".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    run(`touch "x y z.txt"`); // unstaged
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a b.txt`,
      `x y z.txt`,
    ]);
    run(`git add .`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a b.txt`,
      `x y z.txt`,
    ]);
    run(`mv "a b.txt" "a b moved.txt"`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `x y z.txt`,
      `a b moved.txt`,
    ]);
    run(`git add .`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a b moved.txt`,
      `x y z.txt`,
    ]);
    run(`rm "x y z.txt"`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a b moved.txt`,
    ]);
  });

  it('should handle renames and modifications', async () => {
    run(`echo AAA > "a".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    run(`mv a.txt moda.txt`);
    run(`git add .`);
    run(`echo modified >> moda.txt`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `moda.txt`,
    ]);
  });

  it('should handle special characters in filenames', async () => {
    run(`echo AAA > "a-ū".txt`);
    run(`echo BBB > "b-ū".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `a-ū.txt`,
      `b-ū.txt`,
    ]);

    run(`mv a-ū.txt moda-ū.txt`);
    run(`git add .`);
    run(`echo modified >> moda-ū.txt`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `b-ū.txt`,
      `moda-ū.txt`,
    ]);

    run(`rm "moda-ū.txt"`);
    expect([...(await getFileHashes(dir)).allFiles.keys()]).toEqual([
      `b-ū.txt`,
    ]);
  });

  it('should work with sub-directories', async () => {
    const subDir = `${dir}/sub`;
    mkdirSync(subDir);
    run(`echo AAA > a.txt`);
    run(`echo BBB > sub/b.txt`);
    run(`git add --all`);
    run(`git commit -am init`);
    expect([...(await getFileHashes(subDir)).allFiles.keys()]).toEqual([
      `b.txt`,
    ]);

    run(`echo CCC > sub/c.txt`);
    expect([...(await getFileHashes(subDir)).allFiles.keys()]).toEqual([
      `b.txt`,
      `c.txt`,
    ]);
  });

  function run(command: string) {
    return execSync(command, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
  }

  it('should hash two simple files', async () => {
    const files = ['a.txt', 'b.txt'];
    run(`echo AAA > a.txt`);
    run(`echo BBB > b.txt`);
    const hashes = await getGitHashForBatch(files, dir);
    expect([...hashes.keys()]).toEqual(files);
  });

  it('should fail when file deleted', async () => {
    const files = ['a.txt', 'b.txt'];
    run(`echo AAA > a.txt`);
    try {
      const hashes = await getGitHashForBatch(files, dir);
      expect(false).toBeTruthy();
    } catch (err: any) {
      expect(err instanceof Error).toBeTruthy();
      const error = err as Error;
      expect(error.message).toMatch(
        /Passed 2 file paths to Git to hash, but received 1 hashes\.\n *fatal:.*b\.txt.*No such file or directory\n/
      );
    }
  });
});
