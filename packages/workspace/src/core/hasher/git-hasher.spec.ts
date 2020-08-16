import { dirSync } from 'tmp';
import { rmdirSync } from 'fs-extra';
import { execSync } from 'child_process';
import { getFileHashes } from './git-hasher';

describe('git-hasher', () => {
  let dir;

  beforeEach(() => {
    dir = dirSync().name;
    run(`git init`);
    run(`git config user.email "test@test.com"`);
    run(`git config user.name "test"`);
  });

  afterEach(() => {
    rmdirSync(dir, { recursive: true });
  });

  it('should work', () => {
    run(`echo AAA > a.txt`);
    run(`git add .`);
    run(`git commit -am init`);
    const hashes1 = getFileHashes(dir);
    expect([...hashes1.keys()]).toEqual([`${dir}/a.txt`]);
    expect(hashes1.get(`${dir}/a.txt`)).toBeDefined();

    // should handle additions
    run(`echo BBB > b.txt`);
    expect([...getFileHashes(dir).keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/b.txt`,
    ]);

    run(`git add .`);
    expect([...getFileHashes(dir).keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/b.txt`,
    ]);

    run(`git commit  -am second`);
    expect([...getFileHashes(dir).keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/b.txt`,
    ]);

    // should handle removals
    run(`rm b.txt`);
    expect([...getFileHashes(dir).keys()]).toEqual([`${dir}/a.txt`]);

    run(`git add .`);
    expect([...getFileHashes(dir).keys()]).toEqual([`${dir}/a.txt`]);

    run(`git commit  -am third`);
    expect([...getFileHashes(dir).keys()]).toEqual([`${dir}/a.txt`]);

    // should handle moves
    run(`mv a.txt newa.txt`);
    expect([...getFileHashes(dir).keys()]).toEqual([`${dir}/newa.txt`]);

    run(`git add .`);
    expect([...getFileHashes(dir).keys()]).toEqual([`${dir}/newa.txt`]);

    run(`echo AAAA > a.txt`);
    expect([...getFileHashes(dir).keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/newa.txt`,
    ]);

    run(`git add .`);
    expect([...getFileHashes(dir).keys()]).toEqual([
      `${dir}/a.txt`,
      `${dir}/newa.txt`,
    ]);
  });

  it('should handle spaces in filenames', () => {
    run(`echo AAA > "a b".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    expect([...getFileHashes(dir).keys()]).toEqual([`${dir}/a b.txt`]);
  });

  it('should handle renames and modifications', () => {
    run(`echo AAA > "a".txt`);
    run(`git add .`);
    run(`git commit -am init`);
    run(`mv a.txt moda.txt`);
    run(`git add .`);
    run(`echo modified >> moda.txt`);
    expect([...getFileHashes(dir).keys()]).toEqual([`${dir}/moda.txt`]);
  });

  function run(command: string) {
    return execSync(command, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
  }
});
