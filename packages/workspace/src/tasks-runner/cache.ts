import { appRootPath } from '../utils/app-root';
import { ProjectGraph } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';
import { Task } from './tasks-runner';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Hasher } from './hasher';
import * as fsExtra from 'fs-extra';
import { DefaultTasksRunnerOptions } from './tasks-runner-v2';
import { spawn } from 'child_process';

export type CachedResult = { terminalOutput: string; outputsPath: string };
export type TaskWithCachedResult = { task: Task; cachedResult: CachedResult };

class CacheConfig {
  constructor(private readonly options: DefaultTasksRunnerOptions) {}

  isCacheableTask(task: Task) {
    return (
      this.options.cacheableOperations &&
      this.options.cacheableOperations.indexOf(task.target.target) > -1 &&
      !this.longRunningTask(task)
    );
  }

  private longRunningTask(task: Task) {
    return task.overrides['watch'] !== undefined;
  }
}

export class Cache {
  root = appRootPath;
  cachePath = this.createCacheDir();
  terminalOutputsDir = this.createTerminalOutputsDir();
  hasher = new Hasher(this.projectGraph, this.nxJson);
  cacheConfig = new CacheConfig(this.options);

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJson,
    private readonly options: DefaultTasksRunnerOptions
  ) {}

  removeOldCacheRecords() {
    /**
     * Even though spawning a process is fast, we don't want to do it every time
     * the user runs a command. Instead, we want to do it once in a while.
     */
    const shouldSpawnProcess = Math.floor(Math.random() * 50) === 1;
    if (shouldSpawnProcess) {
      const scriptPath = join(
        this.root,
        'node_modules',
        '@nrwl',
        'workspace',
        'src',
        'tasks-runner',
        'remove-old-cache-records.js'
      );
      try {
        const p = spawn('node', [`"${scriptPath}"`, `"${this.cachePath}"`], {
          stdio: 'ignore',
          detached: true
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

    const res = await this.getFromLocalDir(task);

    // didn't find it locally but we have a remote cache
    if (!res && this.options.remoteCache) {
      // attempt remote cache
      await this.options.remoteCache.retrieve(
        await this.hasher.hash(task),
        this.cachePath
      );
      // try again from local cache
      return this.getFromLocalDir(task);
    } else {
      return res;
    }
  }

  async put(task: Task, terminalOutputPath: string, folders: string[]) {
    const terminalOutput = readFileSync(terminalOutputPath).toString();
    const hash = await this.hasher.hash(task);
    const td = join(this.cachePath, hash);
    const tdCommit = join(this.cachePath, `${hash}.commit`);

    // might be left overs from partially-completed cache invocations
    if (existsSync(tdCommit)) {
      fsExtra.removeSync(tdCommit);
    }
    if (existsSync(td)) {
      fsExtra.removeSync(td);
    }

    mkdirSync(td);
    writeFileSync(join(td, 'terminalOutput'), terminalOutput);

    mkdirSync(join(td, 'outputs'));
    folders.forEach(f => {
      const srcDir = join(this.root, f);
      if (existsSync(srcDir)) {
        const cachedDir = join(td, 'outputs', f);
        fsExtra.ensureDirSync(cachedDir);
        fsExtra.copySync(srcDir, cachedDir);
      }
    });
    // we need this file to account for partial writes to the cache folder.
    // creating this file is atomic, whereas creating a folder is not.
    // so if the process gets terminated while we are copying stuff into cache,
    // the cache entry won't be used.
    writeFileSync(tdCommit, 'true');

    if (this.options.remoteCache) {
      await this.options.remoteCache.store(
        await this.hasher.hash(task),
        this.cachePath
      );
    }
  }

  copyFilesFromCache(cachedResult: CachedResult, outputs: string[]) {
    outputs.forEach(f => {
      const cachedDir = join(cachedResult.outputsPath, f);
      if (existsSync(cachedDir)) {
        const srcDir = join(this.root, f);
        if (existsSync(srcDir)) {
          fsExtra.removeSync(srcDir);
        }
        fsExtra.ensureDirSync(srcDir);
        fsExtra.copySync(cachedDir, srcDir);
      }
    });
  }

  async temporaryOutputPath(task: Task) {
    if (this.cacheConfig.isCacheableTask(task)) {
      return join(this.terminalOutputsDir, await this.hasher.hash(task));
    } else {
      return null;
    }
  }

  private async getFromLocalDir(task: Task) {
    const hash = await this.hasher.hash(task);
    const tdCommit = join(this.cachePath, `${hash}.commit`);
    const td = join(this.cachePath, hash);

    if (existsSync(tdCommit)) {
      return {
        terminalOutput: readFileSync(join(td, 'terminalOutput')).toString(),
        outputsPath: join(td, 'outputs')
      };
    } else {
      return null;
    }
  }

  private createCacheDir() {
    let dir;
    if (this.options.cacheDirectory) {
      if (this.options.cacheDirectory.startsWith('./')) {
        dir = join(this.root, this.options.cacheDirectory);
      } else {
        dir = this.options.cacheDirectory;
      }
    } else {
      dir = join(this.root, 'node_modules', '.cache', 'nx');
    }
    if (!existsSync(dir)) {
      fsExtra.ensureDirSync(dir);
    }
    return dir;
  }

  private createTerminalOutputsDir() {
    const path = join(this.cachePath, 'terminalOutputs');
    fsExtra.ensureDirSync(path);
    return path;
  }
}
