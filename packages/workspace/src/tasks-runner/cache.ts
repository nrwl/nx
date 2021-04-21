import { appRootPath } from '../utilities/app-root';
import { Task } from './tasks-runner';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  removeSync,
  ensureDirSync,
  copySync,
} from 'fs-extra';
import { join, resolve } from 'path';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { spawn } from 'child_process';
import { cacheDirectory } from '../utilities/cache-directory';

export type CachedResult = {
  terminalOutput: string;
  outputsPath: string;
  code: number;
};
export type TaskWithCachedResult = { task: Task; cachedResult: CachedResult };

class CacheConfig {
  constructor(private readonly options: DefaultTasksRunnerOptions) {}

  isCacheableTask(task: Task) {
    const cacheable =
      this.options.cacheableOperations || this.options.cacheableTargets;
    return (
      cacheable &&
      cacheable.indexOf(task.target.target) > -1 &&
      !this.longRunningTask(task)
    );
  }

  private longRunningTask(task: Task) {
    return !!task.overrides['watch'];
  }
}

export class Cache {
  root = appRootPath;
  cachePath = this.createCacheDir();
  terminalOutputsDir = this.createTerminalOutputsDir();
  cacheConfig = new CacheConfig(this.options);

  constructor(private readonly options: DefaultTasksRunnerOptions) {}

  removeOldCacheRecords() {
    /**
     * Even though spawning a process is fast, we don't want to do it every time
     * the user runs a command. Instead, we want to do it once in a while.
     */
    const shouldSpawnProcess = Math.floor(Math.random() * 50) === 1;
    if (shouldSpawnProcess) {
      const scriptPath = require.resolve(
        '@nrwl/workspace/src/tasks-runner/remove-old-cache-records.js',
        { paths: [this.root] }
      );

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

  async get(task: Task): Promise<CachedResult> {
    if (!this.cacheConfig.isCacheableTask(task)) return null;

    const res = this.getFromLocalDir(task);

    // didn't find it locally but we have a remote cache
    if (!res && this.options.remoteCache) {
      // attempt remote cache
      await this.options.remoteCache.retrieve(task.hash, this.cachePath);
      // try again from local cache
      return this.getFromLocalDir(task);
    } else {
      return res;
    }
  }

  async put(
    task: Task,
    terminalOutput: string | null,
    outputs: string[],
    code: number
  ) {
    const td = join(this.cachePath, task.hash);
    const tdCommit = join(this.cachePath, `${task.hash}.commit`);

    // might be left overs from partially-completed cache invocations
    removeSync(tdCommit);
    removeSync(td);

    mkdirSync(td);
    writeFileSync(
      join(td, 'terminalOutput'),
      terminalOutput ?? 'no terminal output'
    );

    mkdirSync(join(td, 'outputs'));
    outputs.forEach((f) => {
      const src = join(this.root, f);
      if (existsSync(src)) {
        const cached = join(td, 'outputs', f);
        // Ensure parent directory is created if src is a file
        const isFile = lstatSync(src).isFile();
        const directory = isFile ? resolve(cached, '..') : cached;
        ensureDirSync(directory);

        copySync(src, cached);
      }
    });
    // we need this file to account for partial writes to the cache folder.
    // creating this file is atomic, whereas creating a folder is not.
    // so if the process gets terminated while we are copying stuff into cache,
    // the cache entry won't be used.
    writeFileSync(join(td, 'code'), code.toString());
    writeFileSync(tdCommit, 'true');

    if (this.options.remoteCache) {
      await this.options.remoteCache.store(task.hash, this.cachePath);
    }
  }

  copyFilesFromCache(
    hash: string,
    cachedResult: CachedResult,
    outputs: string[]
  ) {
    outputs.forEach((f) => {
      const cached = join(cachedResult.outputsPath, f);
      if (existsSync(cached)) {
        const isFile = lstatSync(cached).isFile();
        const src = join(this.root, f);
        removeSync(src);

        // Ensure parent directory is created if src is a file
        const directory = isFile ? resolve(src, '..') : src;
        ensureDirSync(directory);
        copySync(cached, src);
      }
    });
  }

  temporaryOutputPath(task: Task) {
    if (this.cacheConfig.isCacheableTask(task)) {
      return join(this.terminalOutputsDir, task.hash);
    } else {
      return null;
    }
  }

  private getFromLocalDir(task: Task) {
    const tdCommit = join(this.cachePath, `${task.hash}.commit`);
    const td = join(this.cachePath, task.hash);

    if (existsSync(tdCommit)) {
      const terminalOutput = readFileSync(join(td, 'terminalOutput'), 'utf-8');
      let code = 0;
      try {
        code = Number(readFileSync(join(td, 'code'), 'utf-8'));
      } catch (e) {}
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
    const dir = cacheDirectory(this.root, this.options.cacheDirectory);
    ensureDirSync(dir);
    return dir;
  }

  private createTerminalOutputsDir() {
    const path = join(this.cachePath, 'terminalOutputs');
    ensureDirSync(path);
    return path;
  }
}
