import { spawn } from 'child_process';
import { fileExists } from '../utils/fileutils';
import { joinPathFragments } from '../utils/path';

export async function getGitHashForFiles(
  potentialFilesToHash: string[],
  path: string
): Promise<{ hashes: Map<string, string>; deleted: string[] }> {
  const { filesToHash, deleted } = getActualFilesToHash(
    potentialFilesToHash,
    path
  );

  const res: Map<string, string> = new Map<string, string>();
  const promises: Promise<Map<string, string>>[] = [];
  if (filesToHash.length) {
    // On windows the max length is limited by the length of
    // the overall comand, rather than the number of individual
    // arguments. Since file paths are large and rather variable,
    // we use a smaller batchSize.
    const batchSize = process.platform === 'win32' ? 500 : 4000;
    for (
      let startIndex = 0;
      startIndex < filesToHash.length;
      startIndex += batchSize
    ) {
      promises.push(
        getGitHashForBatch(
          filesToHash.slice(startIndex, startIndex + batchSize),
          path
        )
      );
    }
  }
  // Merge batch results into final result set
  const batchResults = await Promise.all(promises);
  for (const batch of batchResults) {
    batch.forEach((v, k) => res.set(k, v));
  }
  return { hashes: res, deleted };
}

async function getGitHashForBatch(filesToHash: string[], path) {
  const res: Map<string, string> = new Map<string, string>();
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
  return res;
}

function getActualFilesToHash(
  potentialFilesToHash: string[],
  path: string
): { filesToHash: string[]; deleted: string[] } {
  const filesToHash = [];
  const deleted = [];
  for (let file of potentialFilesToHash) {
    if (fileExists(joinPathFragments(path, file))) {
      filesToHash.push(file);
    } else {
      deleted.push(file);
    }
  }
  return { filesToHash, deleted };
}

async function spawnProcess(command: string, args: string[], cwd: string) {
  const cp = spawn(command, args, {
    windowsHide: true,
    shell: false,
    cwd,
  });
  let stdout = '';
  for await (const data of cp.stdout) {
    stdout += data;
  }
  return stdout;
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
