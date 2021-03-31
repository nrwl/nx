import { appRootPath } from '../utilities/app-root';
import { Task } from './tasks-runner';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  removeSync,
  mkdirSync,
  lstatSync,
  copySync,
  ensureDirSync,
} from 'fs-extra';
import * as path from 'path';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { spawn } from 'child_process';
import { cacheDirectory } from '../utilities/cache-directory';

export type CachedResult = { terminalOutput: string; outputsPath: string };
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

  async put(task: Task, terminalOutputPath: string, outputs: string[]) {
    const terminalOutput = readFileSync(terminalOutputPath).toString();
    const td = path.join(this.cachePath, task.hash);
    const tdCommit = path.join(this.cachePath, `${task.hash}.commit`);

    // might be left overs from partially-completed cache invocations
    if (existsSync(tdCommit)) {
      removeSync(tdCommit);
    }
    if (existsSync(td)) {
      removeSync(td);
    }

    mkdirSync(td);
    writeFileSync(path.join(td, 'terminalOutput'), terminalOutput);

    mkdirSync(path.join(td, 'outputs'));
    outputs.forEach((f) => {
      const src = path.join(this.root, f);
      if (existsSync(src)) {
        const cached = path.join(td, 'outputs', f);
        // Ensure parent directory is created if src is a file
        const isFile = lstatSync(src).isFile();
        const directory = isFile ? path.resolve(cached, '..') : cached;
        ensureDirSync(directory);

        copySync(src, cached);
      }
    });
    // we need this file to account for partial writes to the cache folder.
    // creating this file is atomic, whereas creating a folder is not.
    // so if the process gets terminated while we are copying stuff into cache,
    // the cache entry won't be used.
    writeFileSync(tdCommit, 'true');

    if (this.options.remoteCache) {
      await this.options.remoteCache.store(task.hash, this.cachePath);
    }
  }

  copyFilesFromCache(cachedResult: CachedResult, outputs: string[]) {
    outputs.forEach((f) => {
      const cached = path.join(cachedResult.outputsPath, f);
      if (existsSync(cached)) {
        const isFile = lstatSync(cached).isFile();
        const src = path.join(this.root, f);
        if (existsSync(src)) {
          removeSync(src);
        }
        // Ensure parent directory is created if src is a file
        const directory = isFile ? path.resolve(src, '..') : src;
        ensureDirSync(directory);
        copySync(cached, src);
      }
    });
  }

  temporaryOutputPath(task: Task) {
    if (this.cacheConfig.isCacheableTask(task)) {
      return path.join(this.terminalOutputsDir, task.hash);
    } else {
      return null;
    }
  }

  private getFromLocalDir(task: Task) {
    const tdCommit = path.join(this.cachePath, `${task.hash}.commit`);
    const td = path.join(this.cachePath, task.hash);

    if (existsSync(tdCommit)) {
      return {
        terminalOutput: readFileSync(
          path.join(td, 'terminalOutput')
        ).toString(),
        outputsPath: path.join(td, 'outputs'),
      };
    } else {
      return null;
    }
  }

  private createCacheDir() {
    const dir = cacheDirectory(this.root, this.options.cacheDirectory);
    if (!existsSync(dir)) {
      ensureDirSync(dir);
    }
    return dir;
  }

  private createTerminalOutputsDir() {
    const outputDir = path.join(this.cachePath, 'terminalOutputs');
    ensureDirSync(outputDir);
    return outputDir;
  }
}
