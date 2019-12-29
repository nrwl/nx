import { appRootPath } from '../utils/app-root';
import { ProjectGraph } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';
import { Task } from './tasks-runner';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  writeFileSync
} from 'fs';
import { join } from 'path';
import { Hasher } from './hasher';
import * as fsExtra from 'fs-extra';
import { DefaultTasksRunnerOptions } from './tasks-runner-v2';

export type CachedResult = { terminalOutput: string; outputsPath: string };
export type TaskWithCachedResult = { task: Task; cachedResult: CachedResult };

export class Cache {
  root = appRootPath;
  cachePath = this.createCacheDir();
  hasher = new Hasher(this.projectGraph, this.nxJson);

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJson,
    private readonly options: DefaultTasksRunnerOptions
  ) {}

  async get(task: Task): Promise<CachedResult> {
    if (!this.cacheable(task)) return null;

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

  async put(task: Task, terminalOutput: string, folders: string[]) {
    if (!this.cacheable(task)) return;
    const hash = await this.hasher.hash(task);
    const td = join(this.cachePath, hash);
    const tdCommit = join(this.cachePath, `${hash}.commit`);

    // might be left overs from partially-completed cache invocations
    if (existsSync(td)) {
      fsExtra.removeSync(td);
    }
    if (existsSync(tdCommit)) {
      fsExtra.removeSync(tdCommit);
    }

    mkdirSync(td);
    writeFileSync(join(td, 'terminalOutput'), terminalOutput);

    mkdirSync(join(td, 'outputs'));
    folders.forEach(f => {
      const srcDir = join(this.root, f);
      if (existsSync(srcDir)) {
        const cachedDir = join(td, 'outputs', f);
        mkdirSync(cachedDir, { recursive: true });
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
        mkdirSync(srcDir, { recursive: true });
        fsExtra.copySync(cachedDir, srcDir);
      }
    });
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

  private cacheable(task: Task) {
    return (
      this.options.cacheableOperations &&
      this.options.cacheableOperations.indexOf(task.target.target) > -1
    );
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
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}
