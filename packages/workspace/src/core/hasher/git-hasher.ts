import { spawnSync } from 'child_process';

function parseGitLsTree(output: string): Map<string, string> {
  const changes: Map<string, string> = new Map<string, string>();
  if (output) {
    const gitRegex: RegExp = /([0-9]{6})\s(blob|commit)\s([a-f0-9]{40})\s*(.*)/;
    output.split('\n').forEach((line) => {
      if (line) {
        const matches: RegExpMatchArray | null = line.match(gitRegex);
        if (matches && matches[3] && matches[4]) {
          const hash: string = matches[3];
          const filename: string = matches[4];
          changes.set(filename, hash);
        } else {
          throw new Error(`Cannot parse git ls-tree input: "${line}"`);
        }
      }
    });
  }
  return changes;
}

function parseGitStatus(output: string): Map<string, string> {
  const changes: Map<string, string> = new Map<string, string>();
  if (!output) {
    return changes;
  }
  output
    .trim()
    .split('\n')
    .forEach((line) => {
      const [changeType, ...filenames]: string[] = line
        .trim()
        .split(' ')
        .filter((linePart) => !!linePart);
      if (changeType && filenames && filenames.length > 0) {
        changes.set(filenames[filenames.length - 1], changeType);
      }
    });
  return changes;
}

function spawnProcess(command: string, args: string[], cwd: string): string {
  const r = spawnSync(command, args, { cwd });
  if (r.status !== 0) {
    throw new Error(`Failed to run ${command} ${args.join(' ')}`);
  }
  return r.stdout.toString().trim();
}

function getGitHashForFiles(
  filesToHash: string[],
  path: string
): Map<string, string> {
  const changes: Map<string, string> = new Map<string, string>();
  if (filesToHash.length) {
    const hashStdout = spawnProcess(
      'git',
      ['hash-object', ...filesToHash],
      path
    );
    const hashes: string[] = hashStdout.split('\n');
    if (hashes.length !== filesToHash.length) {
      throw new Error(
        `Passed ${filesToHash.length} file paths to Git to hash, but received ${hashes.length} hashes.`
      );
    }
    for (let i: number = 0; i < hashes.length; i++) {
      const hash: string = hashes[i];
      const filePath: string = filesToHash[i];
      changes.set(filePath, hash);
    }
  }
  return changes;
}

function gitLsTree(path: string): Map<string, string> {
  return parseGitLsTree(spawnProcess('git', ['ls-tree', 'HEAD', '-r'], path));
}

function gitStatus(path: string): Map<string, string> {
  const filesToHash: string[] = [];
  parseGitStatus(
    spawnProcess('git', ['status', '-s', '-u', '.'], path)
  ).forEach((changeType: string, filename: string) => {
    if (changeType !== 'D') {
      filesToHash.push(filename);
    }
  });
  return getGitHashForFiles(filesToHash, path);
}

export function getFileHashes(path: string): Map<string, string> {
  const res = new Map<string, string>();

  try {
    const m1 = gitLsTree(path);
    m1.forEach((hash: string, filename: string) => {
      res.set(`${path}/${filename}`, hash);
    });
    const m2 = gitStatus(path);
    m2.forEach((hash: string, filename: string) => {
      res.set(`${path}/${filename}`, hash);
    });
    return res;
  } catch (e) {
    // this strategy is only used for speeding things up.
    // ignoring all the errors
    if (process.env.NX_GIT_HASHER_LOGGING) {
      console.error(`Internal error:`);
      console.error(e);
    }
    return new Map<string, string>();
  }
}
