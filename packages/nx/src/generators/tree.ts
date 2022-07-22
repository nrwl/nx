import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  ensureDirSync,
  removeSync,
  renameSync,
  chmodSync,
} from 'fs-extra';
import type { Mode } from 'fs';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { dirname, join, relative, sep, basename } from 'path';
import * as chalk from 'chalk';

/**
 * Options to set when writing a file in the Virtual file system tree.
 */
export interface TreeWriteOptions {
  /**
   * Permission to be granted on the file, given as a string (e.g `755`) or octal integer (e.g `0o755`).
   * The logical OR operator can be used to separate multiple permissions.
   * See https://nodejs.org/api/fs.html#fs_file_modes
   */
  mode?: Mode;
}

/**
 * Options to set when renaming a file/folder in the Virtual file system tree.
 */
export interface TreeRenameOptions {
  /**
   * This should correspond to the type of rename action to perform
   */
  mode: 'fs' | 'git';

  /**
   * Source path
   */
  source: string;
}

/**
 * Virtual file system tree.
 */
export interface Tree {
  /**
   * Root of the workspace. All paths are relative to this.
   */
  root: string;

  /**
   * Read the contents of a file.
   * @param filePath A path to a file.
   */
  read(filePath: string): Buffer | null;

  /**
   * Read the contents of a file as string.
   * @param filePath A path to a file.
   * @param encoding the encoding for the result
   */
  read(filePath: string, encoding: BufferEncoding): string | null;

  /**
   * Update the contents of a file or create a new file.
   */
  write(
    filePath: string,
    content: Buffer | string,
    options?: TreeWriteOptions
  ): void;

  /**
   * Check if a file exists.
   */
  exists(filePath: string): boolean;

  /**
   * Delete the file.
   */
  delete(filePath: string): void;

  /**
   * Rename the file or the folder.
   */
  rename(from: string, to: string, isNoop?: boolean): void;

  /**
   * Check if this is a file or not.
   */
  isFile(filePath: string): boolean;

  /**
   * Returns the list of children of a folder.
   */
  children(dirPath: string): string[];

  /**
   * Returns the list of currently recorded changes.
   */
  listChanges(): FileChange[];

  /**
   * Changes permissions of a file.
   * @param filePath A path to a file.
   * @param mode The permission to be granted on the file, given as a string (e.g `755`) or octal integer (e.g `0o755`).
   * See https://nodejs.org/api/fs.html#fs_file_modes.
   */
  changePermissions(filePath: string, mode: Mode): void;

  isDeleted(filePath: string): boolean;
  isRenamed(filePath: string): boolean;
  isNoop(filePath: string): boolean;
}

/**
 * Description of a file change in the Nx virtual file system/
 */
export interface FileChange {
  /**
   * Path relative to the workspace root
   */
  path: string;

  /**
   * Type of change: 'CREATE' | 'DELETE' | 'UPDATE'
   */
  type: 'CREATE' | 'DELETE' | 'UPDATE' | 'RENAME';

  /**
   * The content of the file or null in case of delete.
   */
  content: Buffer | null;
  /**
   * Options to set on the file being created or updated, or options for the rename operation.
   */
  options?: TreeWriteOptions | TreeRenameOptions;

  /**
   * Specifies that this record is for presentation and internal tracking only
   */
  noop?: boolean;
}

export class FsTree implements Tree {
  private recordedChanges: {
    [path: string]: {
      content: Buffer | null;
      isDeleted: boolean;
      isRename?: boolean;
      isNoop?: boolean;
      options?: TreeWriteOptions | TreeRenameOptions;
    };
  } = {};

  // Used to track renames by mapping original path to new path
  private renameChanges: {
    [path: string]: string;
  } = {};

  constructor(readonly root: string, private readonly isVerbose: boolean) {}

  read(filePath: string): Buffer | null;
  read(filePath: string, encoding: BufferEncoding): string | null;
  read(filePath: string, encoding?: BufferEncoding): Buffer | string | null {
    filePath = this.normalize(filePath);
    try {
      let content: Buffer;
      if (this.renameChanges[this.rp(filePath)]) {
        return null;
      }
      if (this.recordedChanges[this.rp(filePath)]) {
        content = this.recordedChanges[this.rp(filePath)].content;
      } else {
        content = this.fsReadFile(filePath);
      }

      return encoding ? content.toString(encoding) : content;
    } catch (e) {
      if (this.isVerbose) {
        logger.error(e);
      }
      return null;
    }
  }

  write(
    filePath: string,
    content: Buffer | string,
    options?: TreeWriteOptions
  ): void {
    filePath = this.normalize(filePath);
    if (
      this.fsExists(this.rp(filePath)) &&
      Buffer.from(content).equals(this.fsReadFile(filePath))
    ) {
      // Remove recorded change because the file has been restored to it's original contents
      delete this.recordedChanges[this.rp(filePath)];
      return;
    }
    try {
      this.recordedChanges[this.rp(filePath)] = {
        content: Buffer.from(content),
        isDeleted: false,
        options,
      };
    } catch (e) {
      if (this.isVerbose) {
        logger.error(e);
      }
    }
  }

  overwrite(
    filePath: string,
    content: Buffer | string,
    options?: TreeWriteOptions
  ): void {
    filePath = this.normalize(filePath);
    this.write(filePath, content, options);
  }

  delete(filePath: string): void {
    filePath = this.normalize(filePath);
    if (this.filesForDir(this.rp(filePath)).length > 0) {
      this.filesForDir(this.rp(filePath)).forEach(
        (f) => (this.recordedChanges[f] = { content: null, isDeleted: true })
      );
    }
    this.recordedChanges[this.rp(filePath)] = {
      content: null,
      isDeleted: true,
    };

    // Delete directories when empty
    if (this.children(dirname(this.rp(filePath))).length < 1) {
      this.delete(dirname(this.rp(filePath)));
    }
  }

  exists(filePath: string): boolean {
    filePath = this.normalize(filePath);
    try {
      if (this.renameChanges[this.rp(filePath)]) {
        return false;
      }
      if (this.recordedChanges[this.rp(filePath)]) {
        return !this.recordedChanges[this.rp(filePath)].isDeleted;
      } else if (this.filesForDir(this.rp(filePath)).length > 0) {
        return true;
      } else {
        return this.fsExists(filePath);
      }
    } catch {
      return false;
    }
  }

  rename(from: string, to: string, isNoop = false): void {
    from = this.rp(this.normalize(from));
    to = this.rp(this.normalize(to));

    if (!this.exists(from)) {
      return void 0;
    }

    const dirFiles = this.filesForDir(from);
    const mode = this.fsIsInGitIndex(from) ? 'git' : 'fs';

    this.recordedChanges[to] = {
      content: dirFiles.length > 0 ? null : this.read(from),
      isDeleted: false,
      isRename: true,
      isNoop,
      options: {
        mode,
        source: from,
      } as TreeRenameOptions,
    };

    this.renameChanges[from] = to;

    // delete previous entry if doing a swip-swap to clean the map
    if (this.renameChanges[to] === from) {
      delete this.renameChanges[to];
      // delete this.recordedChanges[from];
    }
    // console.log(`${from} -> ${to}`);
    // console.log(JSON.stringify(this.renameChanges));
    dirFiles.forEach((f) => {
      // console.log(`Entry: ${this.rp(f)} -> ${this.rp(join(to, basename(f)))}`);
      this.rename(this.rp(f), this.rp(join(to, basename(f))), true);
    });

    // Delete directories when empty
    if (this.children(dirname(from)).length < 1) {
      this.recordedChanges[dirname(from)] = {
        content: null,
        isDeleted: true,
      };
    }
  }

  isFile(filePath: string): boolean {
    filePath = this.normalize(filePath);
    try {
      if (this.recordedChanges[this.rp(filePath)]) {
        return !this.recordedChanges[this.rp(filePath)].isDeleted;
      } else if (this.renameChanges[this.rp(filePath)]) {
        return false;
      } else {
        return this.fsIsFile(filePath);
      }
    } catch {
      return false;
    }
  }

  children(dirPath: string): string[] {
    dirPath = this.normalize(dirPath);
    let res = this.fsReadDir(dirPath);

    res = [...res, ...this.directChildrenOfDir(this.rp(dirPath))];
    res = res.filter((q) => {
      const p = join(this.rp(dirPath), q);
      return !this.renameChanges[p] && !this.recordedChanges[p]?.isDeleted;
    });
    // Dedupe
    return Array.from(new Set(res));
  }

  listChanges(): FileChange[] {
    const res = [] as FileChange[];
    Object.keys(this.recordedChanges).forEach((f) => {
      if (this.recordedChanges[f].isDeleted) {
        if (this.fsExists(f)) {
          res.push({
            path: f,
            type: 'DELETE',
            content: null,
            noop: this.recordedChanges[f].isNoop,
          });
        }
      } else {
        if (this.recordedChanges[f].isRename) {
          res.push({
            path: f,
            type: 'RENAME',
            content: this.recordedChanges[f].content,
            options: this.recordedChanges[f].options,
            noop: this.recordedChanges[f].isNoop,
          });
        } else if (this.fsExists(f)) {
          res.push({
            path: f,
            type: 'UPDATE',
            content: this.recordedChanges[f].content,
            options: this.recordedChanges[f].options,
            noop: this.recordedChanges[f].isNoop,
          });
        } else {
          res.push({
            path: f,
            type: 'CREATE',
            content: this.recordedChanges[f].content,
            options: this.recordedChanges[f].options,
            noop: this.recordedChanges[f].isNoop,
          });
        }
      }
    });
    return res;
  }

  changePermissions(filePath: string, mode: Mode): void {
    filePath = this.normalize(filePath);
    const filePathChangeKey = this.rp(filePath);
    if (this.recordedChanges[filePathChangeKey]) {
      if (this.recordedChanges[filePathChangeKey].isDeleted) {
        throw new Error(
          `Cannot change permissions of deleted file ${filePath}.`
        );
      }

      this.recordedChanges[filePathChangeKey].options = { mode };
    } else if (!this.fsExists(filePath)) {
      throw new Error(
        `Cannot change permissions of non-existing file ${filePath}.`
      );
    } else if (!this.fsIsFile(filePath)) {
      // To fully support directories we'd need to change how we store
      // changes to keep a record of directories so we can associate
      // permissions to them.
      throw new Error(`Cannot change permissions of non-file ${filePath}.`);
    } else {
      this.recordedChanges[filePathChangeKey] = {
        content: this.fsReadFile(filePath),
        isDeleted: false,
        options: { mode },
      };
    }
  }

  isDeleted(path: string): boolean {
    path = this.rp(this.normalize(path));
    return !!this.recordedChanges[path]?.isDeleted || false;
  }

  isRenamed(path: string): boolean {
    path = this.rp(this.normalize(path));
    return !!this.renameChanges[path] || false;
  }

  isNoop(path: string): boolean {
    path = this.rp(this.normalize(path));
    return !!this.recordedChanges[path]?.isNoop || false;
  }

  private normalize(path: string) {
    return relative(this.root, join(this.root, path)).split(sep).join('/');
  }

  private fsReadDir(dirPath: string) {
    try {
      return readdirSync(join(this.root, dirPath));
    } catch {
      return [];
    }
  }

  private fsIsFile(filePath: string): boolean {
    try {
      const stat = statSync(join(this.root, filePath));
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private fsReadFile(filePath: string): Buffer {
    return readFileSync(join(this.root, filePath));
  }

  private fsExists(filePath: string): boolean {
    try {
      const stat = statSync(join(this.root, filePath));
      return stat.isFile() || stat.isDirectory();
    } catch {
      return false;
    }
  }

  private fsIsInGitIndex(filePath: string): boolean {
    try {
      // TODO: consider nodegit?
      return !!execSync(`git ls-files ${filePath}`).toString();
    } catch (e) {
      return false;
    }
  }

  private filesForDir(path: string): string[] {
    return Object.keys(this.recordedChanges).filter(
      (f) =>
        f.startsWith(`${path}/`) &&
        !this.recordedChanges[f].isDeleted &&
        !this.renameChanges[f]
    );
  }

  private directChildrenOfDir(path: string): string[] {
    const res = {};
    if (path === '') {
      return Object.keys(this.recordedChanges).map(
        (file) => file.split('/')[0]
      );
    }
    Object.keys(this.recordedChanges).forEach((f) => {
      if (f.startsWith(`${path}/`)) {
        const [_, file] = f.split(`${path}/`);
        res[file.split('/')[0]] = true;
      }
    });

    return Object.keys(res);
  }

  private rp(pp: string): string {
    return pp.startsWith('/') ? pp.substring(1) : pp;
  }
}

export function flushChanges(root: string, fileChanges: FileChange[]): void {
  fileChanges.forEach((f) => {
    // Ignore noops
    if (f.noop) return;

    const fpath = join(root, f.path);
    if (f.type === 'CREATE') {
      ensureDirSync(dirname(fpath));
      writeFileSync(fpath, f.content);
      if (f.options?.mode) chmodSync(fpath, f.options.mode);
    } else if (f.type === 'UPDATE') {
      writeFileSync(fpath, f.content);
      if (f.options?.mode) chmodSync(fpath, f.options.mode);
    } else if (f.type === 'DELETE') {
      removeSync(fpath);
    } else if (f.type === 'RENAME') {
      const options: TreeRenameOptions = f.options as TreeRenameOptions;
      if (options?.mode === 'fs') {
        renameSync(join(root, options.source), fpath);
      } else if (f.options?.mode === 'git') {
        renameGitSync(join(root, options.source), fpath);
      }
    }
  });
}

export function printChanges(fileChanges: FileChange[]): void {
  fileChanges.forEach((f) => {
    if (f.type === 'CREATE') {
      console.log(`${chalk.green('CREATE')} ${f.path}`);
    } else if (f.type === 'UPDATE') {
      console.log(`${chalk.white('UPDATE')} ${f.path}`);
    } else if (f.type === 'DELETE') {
      console.log(`${chalk.yellow('DELETE')} ${f.path}`);
    } else if (f.type === 'RENAME') {
      console.log(
        `${chalk.cyan('RENAME')} ${
          (f.options as TreeRenameOptions)?.source
        } -> ${f.path}`
      );
    }
  });
}

function renameGitSync(from, to) {
  execSync(`git mv ${from} ${to}`);
}
