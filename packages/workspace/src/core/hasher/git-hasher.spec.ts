import { dirSync } from 'tmp';
import { mkdirSync, removeSync } from 'fs-extra';
import { execSync } from 'child_process';
import { getFileHashes } from './git-hasher';

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

  it('should work', () => {
    run(`echo AAA > a.txt`);
    run(`git add .`);
    run(`git commit -am init`);
    const hashes = getFileHashes(dir).allFiles;
    expect([...hashes.keys()]).toEqual([`${dir}/a.txt`]);
    expect(hashes.get(`${dir}/a.txt`)).toBeDefined();

    // should handle additions
    run(`echo BBB > b.txt`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/b.txt`,
    ]);

    run(`git add .`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/b.txt`,
    ]);

    run(`git commit  -am second`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/b.txt`,
    ]);

    // should handle removals
    run(`rm b.txt`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([`${dir}/a.txt`]);

    run(`git add .`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([`${dir}/a.txt`]);

    run(`git commit  -am third`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([`${dir}/a.txt`]);

    // should handle moves
    run(`mv a.txt newa.txt`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/newa.txt`,
    ]);

    run(`git add .`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/newa.txt`,
    ]);

    run(`echo AAAA > a.txt`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/newa.txt`,
    ]);

    run(`git add .`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/newa.txt`,
    ]);
  });

  it('should handle spaces in filenames', () => {
    run(`echo AAA > "a b".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    run(`touch "x y z.txt"`); // unstaged
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a b.txt`,
      `${dir}/x y z.txt`,
    ]);
    run(`git add .`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a b.txt`,
      `${dir}/x y z.txt`,
    ]);
    run(`mv "a b.txt" "a b moved.txt"`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/x y z.txt`,
      `${dir}/a b moved.txt`,
    ]);
    run(`git add .`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a b moved.txt`,
      `${dir}/x y z.txt`,
    ]);
    run(`rm "x y z.txt"`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a b moved.txt`,
    ]);
  });

  it('should handle renames and modifications', () => {
    run(`echo AAA > "a".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    run(`mv a.txt moda.txt`);
    run(`git add .`);
    run(`echo modified >> moda.txt`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/moda.txt`,
    ]);
  });

  it('should handle special characters in filenames', () => {
    run(`echo AAA > "a-ū".txt`);
    run(`echo BBB > "b-ū".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/a-ū.txt`,
      `${dir}/b-ū.txt`,
    ]);

    run(`mv a-ū.txt moda-ū.txt`);
    run(`git add .`);
    run(`echo modified >> moda-ū.txt`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([
      `${dir}/b-ū.txt`,
      `${dir}/moda-ū.txt`,
    ]);

    run(`rm "moda-ū.txt"`);
    expect([...getFileHashes(dir).allFiles.keys()]).toEqual([`${dir}/b-ū.txt`]);
  });

  it('should work with sub-directories', () => {
    const subDir = `${dir}/sub`;
    mkdirSync(subDir);
    run(`echo AAA > a.txt`);
    run(`echo BBB > sub/b.txt`);
    run(`git add --all`);
    run(`git commit -am init`);
    expect([...getFileHashes(subDir).allFiles.keys()]).toEqual([
      `${subDir}/b.txt`,
    ]);

    run(`echo CCC > sub/c.txt`);
    expect([...getFileHashes(subDir).allFiles.keys()]).toEqual([
      `${subDir}/b.txt`,
      `${subDir}/c.txt`,
    ]);
  });

  function run(command: string) {
    return execSync(command, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
  }
});
