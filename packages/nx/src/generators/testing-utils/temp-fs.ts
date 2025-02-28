import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { joinPathFragments } from '../../utils/path';
import { setWorkspaceRoot, workspaceRoot } from '../../utils/workspace-root';

type NestedFiles = {
  [fileName: string]: string;
};

/**
 * A class that allows you to create a temporary directory and set it as the current working directory for your tests.
 * It also provides a method to reset the temporary directory and restore the original working directory.
 */
export class TempFs {
  readonly tempDir: string;

  private previousWorkspaceRoot: string;

  /**
   * Creates a new instance of the TempFs class.
   * @param dirname The base name for the temporary directory.
   * @param overrideWorkspaceRoot Whether to override the workspace root with the temporary directory.
   */
  constructor(private dirname: string, overrideWorkspaceRoot = true) {
    this.tempDir = realpathSync(mkdtempSync(join(tmpdir(), this.dirname)));
    this.previousWorkspaceRoot = workspaceRoot;

    if (overrideWorkspaceRoot) {
      setWorkspaceRoot(this.tempDir);
    }
  }

  /**
   * Creates files in the temporary directory.
   * @param fileObject An object containing the paths and contents of the files to be created.
   */
  async createFiles(fileObject: NestedFiles) {
    await Promise.all(
      Object.keys(fileObject).map(async (path) => {
        await this.createFile(path, fileObject[path]);
      })
    );
  }

  /**
   * Creates files in the temporary directory synchronously.
   * @param fileObject An object containing the paths and contents of the files to be created.
   */
  createFilesSync(fileObject: NestedFiles) {
    for (let path of Object.keys(fileObject)) {
      this.createFileSync(path, fileObject[path]);
    }
  }

  /**
   * Creates a file in the temporary directory.
   * @param filePath The path of the file to be created. It should be relative to the temporary directory.
   * @param content The content of the file to be created.
   */
  async createFile(filePath: string, content: string) {
    const dir = joinPathFragments(this.tempDir, dirname(filePath));
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(joinPathFragments(this.tempDir, filePath), content);
  }

  /**
   * Creates a file in the temporary directory synchronously.
   * @param filePath The path of the file to be created. It should be relative to the temporary directory.
   * @param content The content of the file to be created.
   */
  createFileSync(filePath: string, content: string) {
    let dir = joinPathFragments(this.tempDir, dirname(filePath));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(joinPathFragments(this.tempDir, filePath), content);
  }

  /**
   * Reads the contents of a file in the temporary directory.
   * @param filePath The path of the file to be read. It should be relative to the temporary directory.
   * @returns A promise that resolves to the contents of the file.
   */
  async readFile(filePath: string): Promise<string> {
    return await readFile(joinPathFragments(this.tempDir, filePath), 'utf-8');
  }

  /**
   * Removes a file from the temporary directory synchronously.
   * @param filePath The path of the file to be removed. It should be relative to the temporary directory.
   */
  removeFileSync(filePath: string): void {
    unlinkSync(joinPathFragments(this.tempDir, filePath));
  }

  /**
   * Appends content to a file in the temporary directory.
   * @param filePath The path of the file to be appended to. It should be relative to the temporary directory.
   * @param content The content to be appended to the file.
   */
  appendFile(filePath: string, content: string) {
    appendFileSync(joinPathFragments(this.tempDir, filePath), content);
  }

  /**
   * Writes content to a file in the temporary directory.
   * @param filePath The path of the file to be written to. It should be relative to the temporary directory.
   * @param content The content to be written to the file.
   */
  writeFile(filePath: string, content: string) {
    writeFileSync(joinPathFragments(this.tempDir, filePath), content);
  }

  /**
   * Renames a file in the temporary directory.
   * @param oldPath The path of the file to be renamed. It should be relative to the temporary directory.
   * @param newPath The new path of the file. It should be relative to the temporary directory.
   */
  renameFile(oldPath: string, newPath: string) {
    renameSync(
      joinPathFragments(this.tempDir, oldPath),
      joinPathFragments(this.tempDir, newPath)
    );
  }

  /**
   * Cleans up the temporary directory and restores the original workspace root.
   */
  cleanup() {
    rmSync(this.tempDir, { recursive: true, force: true });
    setWorkspaceRoot(this.previousWorkspaceRoot);
  }

  /**
   * Resets the temporary directory and restores the original workspace root.
   */
  reset() {
    rmSync(this.tempDir, { recursive: true, force: true });
    mkdirSync(this.tempDir, { recursive: true });
  }
}
