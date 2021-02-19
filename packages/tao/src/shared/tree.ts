import {
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { mkdirpSync, rmdirSync } from 'fs-extra';
import { logger } from './logger';
import { dirname, join, relative, sep } from 'path';
const chalk = require('chalk');

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
   */
  read(filePath: string): Buffer | null;

  /**
   * Update the contents of a file or create a new file.
   */
  write(filePath: string, content: Buffer | string): void;

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
  rename(from: string, to: string): void;

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
  type: 'CREATE' | 'DELETE' | 'UPDATE';

  /**
   * The content of the file or null in case of delete.
   */
  content: Buffer | null;
}

export class FsTree implements Tree {
  private recordedChanges: {
    [path: string]: { content: Buffer | null; isDeleted: boolean };
  } = {};

  constructor(readonly root: string, private readonly isVerbose: boolean) {}

  read(filePath: string): Buffer | null {
    filePath = this.normalize(filePath);
    try {
      if (this.recordedChanges[this.rp(filePath)]) {
        return this.recordedChanges[this.rp(filePath)].content;
      } else {
        return this.fsReadFile(filePath);
      }
    } catch (e) {
      if (this.isVerbose) {
        logger.error(e);
      }
      return null;
    }
  }

  write(filePath: string, content: Buffer | string): void {
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
      };
    } catch (e) {
      if (this.isVerbose) {
        logger.error(e);
      }
    }
  }

  overwrite(filePath: string, content: Buffer | string): void {
    filePath = this.normalize(filePath);
    this.write(filePath, content);
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

    // Delete directories when
    if (
      this.exists(dirname(this.rp(filePath))) &&
      this.children(dirname(this.rp(filePath))).length < 1
    ) {
      this.delete(dirname(this.rp(filePath)));
    }
  }

  exists(filePath: string): boolean {
    filePath = this.normalize(filePath);
    try {
      if (this.recordedChanges[this.rp(filePath)]) {
        return !this.recordedChanges[this.rp(filePath)].isDeleted;
      } else if (this.filesForDir(this.rp(filePath)).length > 0) {
        return true;
      } else {
        return this.fsExists(filePath);
      }
    } catch (err) {
      return false;
    }
  }

  rename(from: string, to: string): void {
    from = this.normalize(from);
    to = this.normalize(to);
    const content = this.read(this.rp(from));
    this.delete(this.rp(from));
    this.write(this.rp(to), content);
  }

  isFile(filePath: string): boolean {
    filePath = this.normalize(filePath);
    try {
      if (this.recordedChanges[this.rp(filePath)]) {
        return !this.recordedChanges[this.rp(filePath)].isDeleted;
      } else {
        return this.fsIsFile(filePath);
      }
    } catch (err) {
      return false;
    }
  }

  children(dirPath: string): string[] {
    dirPath = this.normalize(dirPath);
    let res = this.fsReadDir(dirPath);

    res = [...res, ...this.directChildrenOfDir(this.rp(dirPath))];
    res = res.filter((q) => {
      const r = this.recordedChanges[join(this.rp(dirPath), q)];
      return !r?.isDeleted;
    });
    // Dedupe
    return Array.from(new Set(res));
  }

  listChanges(): FileChange[] {
    const res = [] as FileChange[];
    Object.keys(this.recordedChanges).forEach((f) => {
      if (this.recordedChanges[f].isDeleted) {
        if (this.fsExists(f)) {
          res.push({ path: f, type: 'DELETE', content: null });
        }
      } else {
        if (this.fsExists(f)) {
          res.push({
            path: f,
            type: 'UPDATE',
            content: this.recordedChanges[f].content,
          });
        } else {
          res.push({
            path: f,
            type: 'CREATE',
            content: this.recordedChanges[f].content,
          });
        }
      }
    });
    return res;
  }

  private normalize(path: string) {
    return relative(this.root, join(this.root, path)).split(sep).join('/');
  }

  private fsReadDir(dirPath: string) {
    if (!this.delegateToFs) return [];
    try {
      return readdirSync(join(this.root, dirPath));
    } catch (e) {
      return [];
    }
  }

  private fsIsFile(filePath: string) {
    if (!this.delegateToFs) return false;
    const stat = statSync(join(this.root, filePath));
    return stat.isFile();
  }

  private fsReadFile(filePath: string) {
    if (!this.delegateToFs) return null;
    return readFileSync(join(this.root, filePath));
  }

  private fsExists(filePath: string): boolean {
    if (!this.delegateToFs) return false;
    try {
      const stat = statSync(join(this.root, filePath));
      return stat.isFile() || stat.isDirectory();
    } catch (e) {
      return false;
    }
  }

  private delegateToFs(): boolean {
    return this.root !== null;
  }

  private filesForDir(path: string): string[] {
    return Object.keys(this.recordedChanges).filter(
      (f) => f.startsWith(path + '/') && !this.recordedChanges[f].isDeleted
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
      if (f.startsWith(path + '/')) {
        const [_, file] = f.split(path + '/');
        res[file.split('/')[0]] = true;
      }
    });

    return Object.keys(res);
  }

  private rp(pp: string) {
    return pp.startsWith('/') ? pp.substring(1) : pp;
  }
}

export function flushChanges(root: string, fileChanges: FileChange[]) {
  fileChanges.forEach((f) => {
    const fpath = join(root, f.path);
    if (f.type === 'CREATE') {
      mkdirpSync(dirname(fpath));
      writeFileSync(fpath, f.content);
    } else if (f.type === 'UPDATE') {
      writeFileSync(fpath, f.content);
    } else if (f.type === 'DELETE') {
      try {
        const stat = statSync(fpath);
        if (stat.isDirectory()) {
          rmdirSync(fpath, { recursive: true });
        } else {
          unlinkSync(fpath);
        }
      } catch (e) {}
    }
  });
}

export function printChanges(fileChanges: FileChange[]) {
  fileChanges.forEach((f) => {
    if (f.type === 'CREATE') {
      console.log(`${chalk.green('CREATE')} ${f.path}`);
    } else if (f.type === 'UPDATE') {
      console.log(`${chalk.white('UPDATE')} ${f.path}`);
    } else if (f.type === 'DELETE') {
      console.log(`${chalk.yellow('DELETE')} ${f.path}`);
    }
  });
}
