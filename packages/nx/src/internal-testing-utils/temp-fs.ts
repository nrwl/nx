import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { joinPathFragments } from '../utils/path';
import { setWorkspaceRoot, workspaceRoot } from '../utils/workspace-root';

type NestedFiles = {
  [fileName: string]: string;
};

export class TempFs {
  readonly tempDir: string;

  private previousWorkspaceRoot: string;

  constructor(
    private dirname: string,
    overrideWorkspaceRoot = true
  ) {
    this.tempDir = realpathSync(mkdtempSync(join(tmpdir(), this.dirname)));
    this.previousWorkspaceRoot = workspaceRoot;

    if (overrideWorkspaceRoot) {
      setWorkspaceRoot(this.tempDir);
    }
  }

  async createFiles(fileObject: NestedFiles) {
    await Promise.all(
      Object.keys(fileObject).map(async (path) => {
        await this.createFile(path, fileObject[path]);
      })
    );
  }

  createFilesSync(fileObject: NestedFiles) {
    for (let path of Object.keys(fileObject)) {
      this.createFileSync(path, fileObject[path]);
    }
  }

  async createFile(filePath: string, content: string) {
    const dir = joinPathFragments(this.tempDir, dirname(filePath));
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(joinPathFragments(this.tempDir, filePath), content);
  }

  createFileSync(filePath: string, content: string) {
    let dir = joinPathFragments(this.tempDir, dirname(filePath));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(joinPathFragments(this.tempDir, filePath), content);
  }

  createDirSync(dirPath: string) {
    const dir = joinPathFragments(this.tempDir, dirPath);
    mkdirSync(dir, { recursive: true });
  }

  createSymlinkSync(
    fileOrDirPath: string,
    symlinkPath: string,
    type: 'dir' | 'file'
  ) {
    const absoluteFileOrDirPath = joinPathFragments(
      this.tempDir,
      fileOrDirPath
    );
    const absoluteSymlinkPath = joinPathFragments(this.tempDir, symlinkPath);
    const symlinkDir = dirname(absoluteSymlinkPath);
    if (!existsSync(symlinkDir)) {
      mkdirSync(symlinkDir, { recursive: true });
    }

    symlinkSync(absoluteFileOrDirPath, absoluteSymlinkPath, type);
  }

  async readFile(filePath: string): Promise<string> {
    return await readFile(joinPathFragments(this.tempDir, filePath), 'utf-8');
  }

  removeFileSync(filePath: string): void {
    unlinkSync(joinPathFragments(this.tempDir, filePath));
  }

  appendFile(filePath: string, content: string) {
    appendFileSync(joinPathFragments(this.tempDir, filePath), content);
  }

  writeFile(filePath: string, content: string) {
    writeFileSync(joinPathFragments(this.tempDir, filePath), content);
  }
  renameFile(oldPath: string, newPath: string) {
    renameSync(
      joinPathFragments(this.tempDir, oldPath),
      joinPathFragments(this.tempDir, newPath)
    );
  }

  cleanup() {
    try {
      removeDir(this.tempDir);
      setWorkspaceRoot(this.previousWorkspaceRoot);
    } catch (e) {
      // We are experiencing flakiness in CI related to this cleanup, so log only for now
      if (process.env.CI) {
        console.error(`Failed to cleanup temp dir: ${e}`);
      } else {
        throw e;
      }
    }
  }

  reset() {
    try {
      rmSync(this.tempDir, { recursive: true, force: true, maxRetries: 5 });
      mkdirSync(this.tempDir, { recursive: true });
    } catch (e) {
      // We are experiencing flakiness in CI related to this cleanup, so log only for now
      if (process.env.CI) {
        console.error(`Failed to cleanup temp dir: ${e}`);
      } else {
        throw e;
      }
    }
  }
}

// A workspace context walks on a background thread and writes its files
// archive under `.nx/workspace-data` when done, which can land mid-delete.
// `rmSync` never re-deletes entries written after it walked a directory, so
// retry the whole removal.
const MAX_REMOVE_ATTEMPTS = 5;

function removeDir(dir: string) {
  for (let attempt = 1; attempt <= MAX_REMOVE_ATTEMPTS; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (e) {
      if (
        attempt === MAX_REMOVE_ATTEMPTS ||
        !['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(e.code)
      ) {
        throw e;
      }
      sleepSync(100);
    }
  }
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
