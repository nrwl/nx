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

  // /**
  //  * Check if this is a directory or not.
  //  */
  // isDirectory(filePath: string): boolean;

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

  /**
   * Check if this is deleted
   * @param filePath
   */
  isDeleted(filePath: string): boolean;

  /**
   * Check if this is renamed
   * @param filePath
   */
  isRenamed(filePath: string): boolean;

  /**
   * Check if this is a noop change
   * @param filePath
   */
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

export interface IRecordChange {
  content?: Buffer | null;
  isDeleted?: boolean;
  isRename?: boolean;
  isFolder?: boolean;
  isNoop?: boolean;
  options?: TreeWriteOptions | TreeRenameOptions;
}
export interface IRecordChangeDelete extends IRecordChange {
  isNoop: boolean;
}
export interface IRecordChangeCreate extends IRecordChange {
  content: Buffer | null;
  options: TreeWriteOptions;
}
export interface IRecordChangeRename extends IRecordChange {
  content: Buffer | null;
  isFolder: boolean;
  options: TreeRenameOptions;
}

export class RecordChange implements IRecordChange {
  public content: Buffer | null;
  public isDeleted: boolean;
  public isRename: boolean;
  public isNoop: boolean;
  public isFolder: boolean;
  public options: TreeWriteOptions | TreeRenameOptions;

  constructor(config: IRecordChange) {
    Object.assign(
      this,
      {
        content: null,
        isDeleted: false,
        isRename: false,
        isNoop: void 0, // default to undefined
        isFolder: false,
        options: void 0,
      },
      config
    );
  }

  isFile() {
    return !this.isDeleted && !this.isFolder;
  }

  isDirectory() {
    return !this.isDeleted && this.isFolder;
  }
}

class DeleteChange extends RecordChange {
  constructor(config?: IRecordChangeDelete) {
    super(
      Object.assign(
        {
          isDeleted: true,
          content: null,
        },
        config || {}
      )
    );
  }
}
class WriteChange extends RecordChange {
  constructor(config: IRecordChangeCreate) {
    super(
      Object.assign(
        {
          isDeleted: false,
        },
        config
      )
    );
  }
}
class RenameChange extends RecordChange {
  constructor(config: IRecordChangeRename) {
    super(
      Object.assign(
        {
          isDeleted: false,
          isRename: true,
        },
        config
      )
    );
  }
}

export class FsTree implements Tree {
  private recordedChanges: {
    [path: string]: RecordChange;
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
      if (this.isRenamed(filePath)) {
        return null;
      }

      const change = this.getChange(filePath);
      if (change) {
        content = change.content;
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
      this.removeChange(filePath);
      return;
    }
    try {
      this.addChange(
        filePath,
        new WriteChange({
          content: Buffer.from(content),
          options,
        })
      );
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

    this.filesForDir(this.rp(filePath)).forEach((f) => {
      this.addChange(f, new DeleteChange());
    });

    if (this.isDeleted(filePath)) {
      return;
    }

    this.addChange(filePath, new DeleteChange());

    // Delete directories when empty
    if (this.children(dirname(this.rp(filePath))).length < 1) {
      this.delete(dirname(this.rp(filePath)));
    }
  }

  exists(filePath: string): boolean {
    filePath = this.normalize(filePath);
    try {
      if (this.isRenamed(filePath)) {
        return false;
      }

      const change = this.getChange(filePath);
      if (change) {
        return !change.isDeleted;
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

    if (this.fsExists(from)) {
      const change = this.addChange(
        to,
        new RenameChange({
          content: this.read(from),
          isFolder: this.isDirectory(from),
          isNoop,
          options: {
            mode: this.fsIsInGitIndex(from) ? 'git' : 'fs',
            source: from,
          },
        })
      );

      this.renameChanges[from] = to;

      // delete previous entry for moved file
      if (this.renameChanges[to]) {
        delete this.renameChanges[to];
      }

      this.filesForDir(from).forEach((f) => {
        this.rename(this.rp(f), this.rp(join(to, basename(f))), true);
      });

      // Delete directories when empty
      if (
        !isNoop &&
        !change.isDirectory() &&
        this.children(dirname(from)).length < 1
      ) {
        this.delete(dirname(from));
      }
    } else {
      const content = this.read(from);
      this.delete(from);
      this.write(to, content);
      return;
    }
  }

  isFile(filePath: string): boolean {
    try {
      const change = this.getChange(filePath);
      if (change) {
        return change.isFile();
      } else if (this.isRenamed(filePath)) {
        return false;
      } else {
        return this.fsIsFile(this.normalize(filePath));
      }
    } catch {
      return false;
    }
  }

  isDirectory(filePath: string): boolean {
    try {
      const change = this.getChange(filePath);
      if (change) {
        return change.isDirectory();
      } else if (this.isRenamed(filePath)) {
        return false;
      } else {
        return this.fsIsDirectory(this.normalize(filePath));
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
      return !this.isRenamed(p) && !this.isDeleted(p);
    });
    // Dedupe
    return Array.from(new Set(res));
  }

  listChanges(): FileChange[] {
    const res = [] as FileChange[];
    Object.keys(this.recordedChanges).forEach((f) => {
      const change = this.recordedChanges[f];
      if (change instanceof DeleteChange) {
        if (this.fsExists(f)) {
          res.push({
            path: f,
            type: 'DELETE',
            content: null,
            noop: change.isNoop,
          });
        }
      } else {
        if (change instanceof RenameChange) {
          res.push({
            path: f,
            type: 'RENAME',
            content: change.content,
            options: change.options,
            noop: change.isNoop,
          });
        } else if (this.fsExists(f)) {
          res.push({
            path: f,
            type: 'UPDATE',
            content: change.content,
            options: change.options,
            noop: change.isNoop,
          });
        } else {
          res.push({
            path: f,
            type: 'CREATE',
            content: change.content,
            options: change.options,
            noop: change.isNoop,
          });
        }
      }
    });
    return res;
  }

  changePermissions(filePath: string, mode: Mode): void {
    filePath = this.normalize(filePath);
    const filePathChangeKey = this.rp(filePath);
    if (this.isRenamed(filePathChangeKey)) {
      throw new Error(`Cannot change permissions of renamed file ${filePath}.`);
    }

    const change = this.getChange(filePathChangeKey);
    if (change) {
      if (change.isDeleted) {
        throw new Error(
          `Cannot change permissions of deleted file ${filePath}.`
        );
      }

      change.options = { mode };
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
      this.addChange(
        filePathChangeKey,
        new WriteChange({
          content: this.fsReadFile(filePath),
          isDeleted: false,
          options: { mode },
        })
      );
    }
  }

  isDeleted(path: string): boolean {
    return !!this.getChange(path)?.isDeleted;
  }

  isNoop(path: string): boolean {
    return !!this.getChange(path)?.isNoop;
  }

  isRenamed(path: string): boolean {
    path = this.rp(this.normalize(path));
    return !!this.renameChanges[path];
  }

  private getChange(path: string): RecordChange | null {
    path = this.rp(this.normalize(path));
    return this.recordedChanges[path] || null;
  }

  private addChange(path: string, rc: RecordChange): RecordChange {
    path = this.rp(this.normalize(path));
    this.recordedChanges[path] = rc;
    return rc;
  }

  private removeChange(path: string): void {
    path = this.rp(this.normalize(path));
    delete this.recordedChanges[path];
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

  private fsIsDirectory(filePath: string): boolean {
    try {
      const stat = statSync(join(this.root, filePath));
      return stat.isDirectory();
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
        f.startsWith(`${path}/`) && !this.isDeleted(f) && !this.isRenamed(f)
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
      const { mode, source } = f.options as TreeRenameOptions;
      if (mode === 'fs') {
        renameSync(join(root, source), fpath);
      } else if (mode === 'git') {
        renameGitSync(join(root, source), fpath);
      }
    }
  });
}

export function printChanges(
  fileChanges: FileChange[],
  indent: string = ''
): void {
  fileChanges.forEach((f) => {
    if (f.type === 'CREATE') {
      console.log(`${indent}${chalk.green('CREATE')} ${f.path}`);
    } else if (f.type === 'UPDATE') {
      console.log(`${indent}${chalk.white('UPDATE')} ${f.path}`);
    } else if (f.type === 'DELETE') {
      console.log(`${indent}${chalk.yellow('DELETE')} ${f.path}`);
    } else if (f.type === 'RENAME') {
      const { source } = f.options as TreeRenameOptions;
      console.log(`${indent}${chalk.cyan('RENAME')} ${source} -> ${f.path}`);
    }
  });
}

function renameGitSync(from, to) {
  execSync(`git mv ${from} ${to}`);
}
