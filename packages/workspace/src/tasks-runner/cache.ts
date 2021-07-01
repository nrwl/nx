import { appRootPath } from '../utilities/app-root';
import { Task } from './tasks-runner';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  unlinkSync,
} from 'fs';
import { removeSync, ensureDirSync, copySync, readdirSync } from 'fs-extra';
import { join, resolve, sep } from 'path';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { spawn } from 'child_process';
import { cacheDirectory } from '../utilities/cache-directory';
import { writeToFile } from '../utilities/fileutils';

export type CachedResult = {
  terminalOutput: string;
  outputsPath: string;
  code: number;
};
export type TaskWithCachedResult = { task: Task; cachedResult: CachedResult };

export class Cache {
  root = appRootPath;
  cachePath = this.createCacheDir();
  terminalOutputsDir = this.createTerminalOutputsDir();
  latestOutputsHashesDir = this.ensureLatestOutputsHashesDir();

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
    this.removeRecordedOutputsHashes(outputs);
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
    this.recordOutputsHash(outputs, hash);
  }

  temporaryOutputPath(task: Task) {
    return join(this.terminalOutputsDir, task.hash);
  }

  removeRecordedOutputsHashes(outputs: string[]): void {
    outputs.forEach((output) => {
      const hashFile = this.getFileNameWithLatestRecordedHashForOutput(output);
      try {
        unlinkSync(hashFile);
      } catch (e) {}
    });
  }

  recordOutputsHash(outputs: string[], hash: string): void {
    outputs.forEach((output) => {
      const hashFile = this.getFileNameWithLatestRecordedHashForOutput(output);
      writeToFile(hashFile, hash);
    });
  }

  shouldCopyOutputsFromCache(
    taskWithCachedResult: TaskWithCachedResult,
    outputs: string[]
  ): boolean {
    return (
      this.areLatestOutputsHashesDifferentThanTaskHash(
        outputs,
        taskWithCachedResult.task.hash
      ) || this.isAnyOutputMissing(taskWithCachedResult.cachedResult, outputs)
    );
  }

  private areLatestOutputsHashesDifferentThanTaskHash(
    outputs: string[],
    hash: string
  ) {
    return outputs.some(
      (output) => this.getLatestRecordedHashForTask(output) !== hash
    );
  }

  private getLatestRecordedHashForTask(output: string): string | null {
    try {
      return readFileSync(
        this.getFileNameWithLatestRecordedHashForOutput(output)
      ).toString();
    } catch (e) {
      return null;
    }
  }

  private isAnyOutputMissing(
    cachedResult: CachedResult,
    outputs: string[]
  ): boolean {
    return outputs.some((output) => {
      const cacheOutputPath = join(cachedResult.outputsPath, output);
      const rootOutputPath = join(this.root, output);

      const haveDifferentAmountOfFiles =
        existsSync(cacheOutputPath) &&
        existsSync(rootOutputPath) &&
        readdirSync(cacheOutputPath).length !==
          readdirSync(rootOutputPath).length;

      return (
        (existsSync(cacheOutputPath) && !existsSync(rootOutputPath)) ||
        haveDifferentAmountOfFiles
      );
    });
  }

  private getFileNameWithLatestRecordedHashForOutput(output: string): string {
    return join(
      this.latestOutputsHashesDir,
      `${output.split(sep).join('-')}.hash`
    );
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

  private ensureLatestOutputsHashesDir() {
    const path = join(this.cachePath, 'latestOutputsHashes');
    ensureDirSync(path);
    return path;
  }
}
