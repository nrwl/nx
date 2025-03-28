import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute } from 'path';
import { tmpFolder, tmpProjPath } from './paths';
import { parseJson } from '@nx/devkit';
import type { JsonParseOptions } from '@nx/devkit';
import { directoryExists, fileExists } from 'nx/src/utils/fileutils';

export { directoryExists, fileExists };

/**
 * Copies module folders from the working directory to the e2e directory
 * @param modules a list of module names or scopes to copy
 */
export function copyNodeModules(modules: string[]) {
  modules.forEach((module) => {
    rmSync(`${tmpProjPath()}/node_modules/${module}`, {
      recursive: true,
      force: true,
    });
    cpSync(
      `./node_modules/${module}`,
      `${tmpProjPath()}/node_modules/${module}`,
      { recursive: true }
    );
  });
}

/**
 * Assert test output from a asynchronous CLI command.
 *
 * @param output Output from an asynchronous command
 */
export function expectTestsPass(output: { stdout: string; stderr: string }) {
  expect(output.stderr).toContain('Ran all test suites');
  expect(output.stderr).not.toContain('fail');
}

// type callback =

/**
 * Update a file's content in the e2e directory.
 *
 * If the `content` param is a callback, it will provide the original file content as an argument.
 *
 * @param file Path of the file in the e2e directory
 * @param content Content to replace the original content with
 */
export function updateFile(
  file: string,
  content: string | ((originalFileContent: string) => string)
): void {
  mkdirSync(dirname(tmpProjPath(file)), { recursive: true });
  if (typeof content === 'string') {
    writeFileSync(tmpProjPath(file), content);
  } else {
    writeFileSync(
      tmpProjPath(file),
      content(readFileSync(tmpProjPath(file)).toString())
    );
  }
}

/**
 * Rename a file or directory within the e2e directory.
 * @param path Original path
 * @param newPath New path
 */
export function renameFile(path: string, newPath: string): void {
  mkdirSync(dirname(tmpProjPath(newPath)), { recursive: true });
  renameSync(tmpProjPath(path), tmpProjPath(newPath));
}

/**
 * Check if the file or directory exists.
 *
 * If a path starts with `/` or `C:/`, it will check it as absolute. Otherwise it will check within the e2e directory.
 *
 * @param expectedPaths Files or directories to check
 * @usage `checkFileExists('file1', 'file2', '/var/user/file')`
 */
export function checkFilesExist(...expectedPaths: string[]) {
  expectedPaths.forEach((path) => {
    const filePath = isAbsolute(path) ? path : tmpProjPath(path);
    if (!exists(filePath)) {
      throw new Error(`'${filePath}' does not exist`);
    }
  });
}

/**
 * Get a list of all files within a directory.
 * @param dirName Directory name within the e2e directory.
 */
export function listFiles(dirName: string): string[] {
  return readdirSync(tmpProjPath(dirName));
}

/**
 * Read a JSON file.
 * @param path Path to the JSON file. Absolute or relative to the e2e directory.
 * @param options JSON parse options
 */
export function readJson<T extends object = any>(
  path: string,
  options?: JsonParseOptions
): T {
  return parseJson<T>(readFile(path), options);
}

/**
 * Read a file.
 * @param path Path to the file. Absolute or relative to the e2e directory.
 */
export function readFile(path: string): string {
  const filePath = isAbsolute(path) ? path : tmpProjPath(path);
  return readFileSync(filePath, 'utf-8');
}

/**
 * Deletes the e2e directory
 */
export function cleanup(): void {
  rmSync(tmpProjPath(), { recursive: true, force: true });
}

/**
 * Remove the dist folder from the e2e directory
 */
export function rmDist(): void {
  rmSync(`${tmpProjPath()}/dist`, { recursive: true, force: true });
}

export function removeTmpProject(project: string): void {
  rmSync(`${tmpFolder()}/${project}`, { recursive: true, force: true });
}

/**
 * Get the currend `cwd` in the process
 */
export function getCwd(): string {
  return process.cwd();
}

/**
 * Check if a file or directory exists.
 * @param path Path to file or directory
 */
export function exists(path: string): boolean {
  return directoryExists(path) || fileExists(path);
}

/**
 * Get the size of a file on disk
 * @param filePath Path to the file
 */
export function getSize(filePath: string): number {
  return statSync(filePath).size;
}
