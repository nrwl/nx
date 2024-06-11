import { execSync } from 'child_process';
import { readFileSync, constants as FsConstants } from 'fs';
import * as path from 'path';
import { valid } from 'semver';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import {
  flushChanges,
  FsTree,
  printChanges,
  Tree,
} from '../../../../generators/tree';
import { writeJson } from '../../../../generators/utils/json';

export const nxWrapperPath = (p: typeof import('path') = path) =>
  p.join('.nx', 'nxw.js');

const NODE_MISSING_ERR =
  'Nx requires NodeJS to be available. To install NodeJS and NPM, see: https://nodejs.org/en/download/ .';
const NPM_MISSING_ERR =
  'Nx requires npm to be available. To install NodeJS and NPM, see: https://nodejs.org/en/download/ .';

const BATCH_SCRIPT_CONTENTS = [
  // don't log command to console
  `@ECHO OFF`,
  // Prevents path_to_root from being inherited by child processes
  `SETLOCAL`,
  `SET path_to_root=%~dp0`,
  // Checks if node is available
  `WHERE node >nul 2>nul`,
  `IF %ERRORLEVEL% NEQ 0 (ECHO ${NODE_MISSING_ERR} & GOTO exit)`,
  // Checks if npm is available
  `WHERE npm >nul 2>nul`,
  `IF %ERRORLEVEL% NEQ 0 (ECHO ${NPM_MISSING_ERR} & GOTO exit)`,
  // Executes the nx wrapper script
  `node ${path.win32.join('%path_to_root%', nxWrapperPath(path.win32))} %*`,
  // Exits with the same error code as the previous command
  `:exit`,
  `  cmd /c exit /b %ERRORLEVEL%`,
].join('\r\n');

const SHELL_SCRIPT_CONTENTS = [
  // Execute in bash
  `#!/bin/bash`,
  // Checks if node is available
  `command -v node >/dev/null 2>&1 || { echo >&2 "${NODE_MISSING_ERR}"; exit 1; }`,
  // Checks if npm is available
  `command -v npm >/dev/null 2>&1 || { echo >&2 "${NPM_MISSING_ERR}"; exit 1; }`,
  // Gets the path to the root of the project
  `path_to_root=$(dirname $BASH_SOURCE)`,
  // Executes the nx wrapper script
  `node ${path.posix.join('$path_to_root', nxWrapperPath(path.posix))} $@`,
].join('\n');

export function generateDotNxSetup(version?: string) {
  const host = new FsTree(process.cwd(), false, '.nx setup');
  writeMinimalNxJson(host, version);
  updateGitIgnore(host);
  host.write(nxWrapperPath(), getNxWrapperContents());
  host.write('nx.bat', BATCH_SCRIPT_CONTENTS);
  host.write('nx', SHELL_SCRIPT_CONTENTS, {
    mode: FsConstants.S_IXUSR | FsConstants.S_IRUSR | FsConstants.S_IWUSR,
  });
  const changes = host.listChanges();
  printChanges(changes);
  flushChanges(host.root, changes);
}

export function normalizeVersionForNxJson(pkg: string, version: string) {
  if (!valid(version)) {
    version = execSync(`npm view ${pkg}@${version} version`).toString();
  }
  return version.trimEnd();
}

export function writeMinimalNxJson(host: Tree, version: string) {
  if (!host.exists('nx.json')) {
    writeJson<NxJsonConfiguration>(host, 'nx.json', {
      installation: {
        version: normalizeVersionForNxJson('nx', version),
      },
    });
  }
}

export function updateGitIgnore(host: Tree) {
  let contents = host.read('.gitignore', 'utf-8') ?? '';
  if (!contents.includes('.nx/installation')) {
    contents = [contents, '.nx/installation'].join('\n');
  }
  if (!contents.includes('.nx/cache')) {
    contents = [contents, '.nx/cache'].join('\n');
  }
  host.write('.gitignore', contents);
}

// Gets the sanitized contents for nxw.js
export function getNxWrapperContents() {
  return sanitizeWrapperScript(
    readFileSync(path.join(__dirname, 'nxw.js'), 'utf-8')
  );
}

// Remove any empty comments or comments that start with `//#: ` or eslint-disable comments.
// This removes the sourceMapUrl since it is invalid, as well as any internal comments.
export function sanitizeWrapperScript(input: string) {
  const linesToRemove = [
    // Comments that start with //#
    '\\/\\/# .*',
    // Comments that are empty (often used for newlines between internal comments)
    '\\s*\\/\\/\\s*',
    // Comments that disable an eslint rule.
    '\\/\\/ eslint-disable-next-line.*',
  ];
  const regex = `(${linesToRemove.join('|')})$`;
  return input.replace(new RegExp(regex, 'gm'), '');
}
