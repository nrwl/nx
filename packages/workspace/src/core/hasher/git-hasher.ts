import { spawn } from 'child_process';
import { fileExists } from '../../utilities/fileutils';
import { joinPathFragments } from '@nrwl/devkit';

export async function getGitHashForFiles(
  potentialFilesToHash: string[],
  path: string
): Promise<{ hashes: Map<string, string>; deleted: string[] }> {
  const filesToHash = [];
  const deleted = [];
  for (let f of potentialFilesToHash) {
    if (fileExists(joinPathFragments(path, f))) {
      filesToHash.push(f);
    } else {
      deleted.push(f);
    }
  }

  const res: Map<string, string> = new Map<string, string>();
  if (filesToHash.length) {
    const hashStdout = await spawnProcess(
      'git',
      ['hash-object', ...filesToHash],
      path
    );
    const hashes: string[] = hashStdout.split('\n').filter((s) => !!s);
    if (hashes.length !== filesToHash.length) {
      throw new Error(
        `Passed ${filesToHash.length} file paths to Git to hash, but received ${hashes.length} hashes.`
      );
    }
    for (let i = 0; i < hashes.length; i++) {
      const hash: string = hashes[i];
      const filePath: string = filesToHash[i];
      res.set(filePath, hash);
    }
  }
  return { hashes: res, deleted };
}

async function spawnProcess(command: string, args: string[], cwd: string) {
  const cp = spawn(command, args, {
    windowsHide: true,
    shell: false,
    cwd,
  });
  let s = '';
  for await (const data of cp.stdout) {
    s += data;
  }
  return s;
}

async function getStagedFiles(path: string) {
  const staged = await spawnProcess(
    'git',
    ['ls-files', '-s', '-z', '--exclude-standard', '.'],
    path
  );
  const res = new Map();
  for (let line of staged.split('\0')) {
    if (!line) continue;
    const [_, hash, __, ...fileParts] = line.split(/\s/);
    const fileName = fileParts.join(' ');
    res.set(fileName, hash);
  }
  return res;
}

async function getUnstagedFiles(path: string) {
  const unstaged = await spawnProcess(
    'git',
    ['ls-files', '-m', '-z', '--exclude-standard', '.'],
    path
  );
  const lines = unstaged.split('\0').filter((f) => !!f);
  return getGitHashForFiles(lines, path);
}

async function getUntrackedFiles(path: string) {
  const untracked = await spawnProcess(
    'git',
    ['ls-files', '--other', '-z', '--exclude-standard', '.'],
    path
  );
  const lines = untracked.split('\0').filter((f) => !!f);
  return getGitHashForFiles(lines, path);
}

export async function getFileHashes(path: string): Promise<{
  allFiles: Map<string, string>;
}> {
  const [staged, unstaged, untracked] = await Promise.all([
    getStagedFiles(path),
    getUnstagedFiles(path),
    getUntrackedFiles(path),
  ]);

  unstaged.hashes.forEach((hash: string, filename: string) => {
    staged.set(filename, hash);
  });

  unstaged.deleted.forEach((filename) => {
    staged.delete(filename);
  });

  untracked.hashes.forEach((hash: string, filename: string) => {
    staged.set(filename, hash);
  });

  return { allFiles: staged };
}
