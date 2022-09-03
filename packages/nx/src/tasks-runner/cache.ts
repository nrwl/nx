import { workspaceRoot } from '../utils/workspace-root';
import {
  copy,
  lstat,
  mkdir,
  mkdirSync,
  pathExists,
  readFile,
  remove,
  writeFile,
} from 'fs-extra';
import { dirname, join, resolve } from 'path';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { execFile, spawn } from 'child_process';
import { cacheDir } from '../utils/cache-directory';
import { platform } from 'os';
import { Task } from '../config/task-graph';
import * as fastGlob from 'fast-glob';

export type CachedResult = {
  terminalOutput: string;
  outputsPath: string;
  code: number;
  remote: boolean;
};
export type TaskWithCachedResult = { task: Task; cachedResult: CachedResult };

export class Cache {
  root = workspaceRoot;
  cachePath = this.createCacheDir();
  terminalOutputsDir = this.createTerminalOutputsDir();
  useFsExtraToCopyAndRemove = platform() === 'win32';

  constructor(private readonly options: DefaultTasksRunnerOptions) {}

  removeOldCacheRecords() {
    /**
     * Even though spawning a process is fast, we don't want to do it every time
     * the user runs a command. Instead, we want to do it once in a while.
     */
    const shouldSpawnProcess = Math.floor(Math.random() * 50) === 1;
    if (shouldSpawnProcess) {
      const scriptPath = require.resolve('./remove-old-cache-records.js');
      try {
        const p = spawn('node', [scriptPath, `"${this.cachePath}"`], {
          stdio: 'ignore',
          detached: true,
        });
        p.unref();
      } catch (e) {
        console.log(`Unable to start remove-old-cache-records script:`);
        console.log(e.message);
      }
    }
  }

  async get(task: Task): Promise<CachedResult | null> {
    const res = await this.getFromLocalDir(task);

    if (res) {
      return { ...res, remote: false };
    } else if (this.options.remoteCache) {
      // didn't find it locally but we have a remote cache
      // attempt remote cache
      await this.options.remoteCache.retrieve(task.hash, this.cachePath);
      // try again from local cache
      const res2 = await this.getFromLocalDir(task);
      return res2 ? { ...res2, remote: true } : null;
    } else {
      return null;
    }
  }

  async put(
    task: Task,
    terminalOutput: string | null,
    outputs: string[],
    code: number
  ) {
    return this.tryAndRetry(async () => {
      const td = join(this.cachePath, task.hash);
      const tdCommit = join(this.cachePath, `${task.hash}.commit`);

      // might be left overs from partially-completed cache invocations
      await remove(tdCommit);
      await this.remove(td);

      await mkdir(td);
      await writeFile(
        join(td, 'terminalOutput'),
        terminalOutput ?? 'no terminal output'
      );

      await mkdir(join(td, 'outputs'));
      const expandedOutputs = await this.expandOutputsInWorkspace(outputs);

      await Promise.all(
        expandedOutputs.map(async (f) => {
          const src = join(this.root, f);
          if (await pathExists(src)) {
            const isFile = (await lstat(src)).isFile();

            const cached = join(td, 'outputs', f);
            const directory = isFile ? dirname(cached) : cached;
            await mkdir(directory, { recursive: true });
            await this.copy(src, cached);
          }
        })
      );
      // we need this file to account for partial writes to the cache folder.
      // creating this file is atomic, whereas creating a folder is not.
      // so if the process gets terminated while we are copying stuff into cache,
      // the cache entry won't be used.
      await writeFile(join(td, 'code'), code.toString());
      await writeFile(tdCommit, 'true');

      if (this.options.remoteCache) {
        await this.options.remoteCache.store(task.hash, this.cachePath);
      }

      if (terminalOutput) {
        const outputPath = this.temporaryOutputPath(task);
        await writeFile(outputPath, terminalOutput);
      }
    });
  }

  async copyFilesFromCache(
    hash: string,
    cachedResult: CachedResult,
    outputs: string[]
  ) {
    return this.tryAndRetry(async () => {
      const expandedOutputs = await this.expandOutputsInCache(
        outputs,
        cachedResult
      );
      await Promise.all(
        expandedOutputs.map(async (f) => {
          const cached = join(cachedResult.outputsPath, f);
          if (await pathExists(cached)) {
            const isFile = (await lstat(cached)).isFile();
            const src = join(this.root, f);
            await this.remove(src);
            // Ensure parent directory is created if src is a file
            const directory = isFile ? resolve(src, '..') : src;
            await mkdir(directory, { recursive: true });
            await this.copy(cached, src);
          }
        })
      );
    });
  }

  temporaryOutputPath(task: Task) {
    return join(this.terminalOutputsDir, task.hash);
  }

  private async expandOutputsInWorkspace(outputs: string[]) {
    return this._expandOutputs(outputs, workspaceRoot);
  }

  private async expandOutputsInCache(
    outputs: string[],
    cachedResult: CachedResult
  ) {
    return this._expandOutputs(outputs, cachedResult.outputsPath);
  }

  private async _expandOutputs(outputs: string[], cwd: string) {
    return (
      await Promise.all(
        outputs.map(async (entry) => {
          if (await pathExists(join(cwd, entry))) {
            return entry;
          }
          return fastGlob(entry, { cwd, dot: true });
        })
      )
    ).flat();
  }

  private async copy(src: string, destination: string): Promise<void> {
    if (this.useFsExtraToCopyAndRemove) {
      return copy(src, destination);
    }
    return new Promise((res, rej) => {
      execFile('cp', ['-a', src, dirname(destination)], (error) => {
        if (!error) {
          res();
        } else {
          this.useFsExtraToCopyAndRemove = true;
          copy(src, destination).then(res, rej);
        }
      });
    });
  }

  private async remove(path: string): Promise<void> {
    if (this.useFsExtraToCopyAndRemove) {
      return remove(path);
    }

    return new Promise<void>((res, rej) => {
      execFile('rm', ['-rf', path], (error) => {
        if (!error) {
          res();
        } else {
          this.useFsExtraToCopyAndRemove = true;
          remove(path).then(res, rej);
        }
      });
    });
  }

  private async getFromLocalDir(task: Task) {
    const tdCommit = join(this.cachePath, `${task.hash}.commit`);
    const td = join(this.cachePath, task.hash);

    if (await pathExists(tdCommit)) {
      const terminalOutput = await readFile(
        join(td, 'terminalOutput'),
        'utf-8'
      );
      let code = 0;
      try {
        code = Number(await readFile(join(td, 'code'), 'utf-8'));
      } catch {}
      return {
        terminalOutput,
        outputsPath: join(td, 'outputs'),
        code,
      };
    } else {
      return null;
    }
  }

  private createCacheDir() {
    mkdirSync(cacheDir, { recursive: true });
    return cacheDir;
  }

  private createTerminalOutputsDir() {
    const path = join(this.cachePath, 'terminalOutputs');
    mkdirSync(path, { recursive: true });
    return path;
  }

  private tryAndRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempts = 0;
    const baseTimeout = 100;
    const _try = async () => {
      try {
        attempts++;
        return await fn();
      } catch (e) {
        if (attempts === 10) {
          // After enough attempts, throw the error
          throw e;
        }
        await new Promise((res) => setTimeout(res, baseTimeout * attempts));
        return await _try();
      }
    };
    return _try();
  }
}
