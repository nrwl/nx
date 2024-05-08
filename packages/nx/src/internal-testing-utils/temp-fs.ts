import { dirname, join } from 'path';
import { tmpdir } from 'os';
import {
  emptyDirSync,
  mkdirpSync,
  mkdtempSync,
  outputFile,
  readFile,
  realpathSync,
  rmSync,
  unlinkSync,
} from 'fs-extra';
import { joinPathFragments } from '../utils/path';
import { appendFileSync, existsSync, renameSync, writeFileSync } from 'fs';
import { setWorkspaceRoot, workspaceRoot } from '../utils/workspace-root';

type NestedFiles = {
  [fileName: string]: string;
};

export class TempFs {
  readonly tempDir: string;

  private previousWorkspaceRoot: string;

  constructor(private dirname: string, overrideWorkspaceRoot = true) {
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
    await outputFile(joinPathFragments(this.tempDir, filePath), content);
  }

  createFileSync(filePath: string, content: string) {
    let dir = joinPathFragments(this.tempDir, dirname(filePath));
    if (!existsSync(dir)) {
      mkdirpSync(dir);
    }
    writeFileSync(joinPathFragments(this.tempDir, filePath), content);
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
    rmSync(this.tempDir, { recursive: true });
    setWorkspaceRoot(this.previousWorkspaceRoot);
  }

  reset() {
    emptyDirSync(this.tempDir);
  }
}
