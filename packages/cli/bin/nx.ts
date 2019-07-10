#!/usr/bin/env node
import { statSync } from 'fs';
import * as path from 'path';

function isLocalProject(dir: string): boolean {
  if (path.dirname(dir) === dir) return false;
  const configPath = path.join(dir, 'angular.json');
  if (fileExists(configPath)) {
    return true;
  } else {
    return isLocalProject(path.dirname(dir));
  }
}

function findLocalNx(dir: string): string {
  if (path.dirname(dir) === dir) return null;
  const nxPath = path.join(dir, 'node_modules', '.bin', 'nx');
  if (fileExists(nxPath)) {
    return nxPath;
  } else {
    return findLocalNx(path.dirname(dir));
  }
}

function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

const inLocal = isLocalProject(__dirname);
if (inLocal) {
  /**
   * The commandsObject is a Yargs object declared in `nx-commands.ts`,
   * It is exposed and bootstrapped here to provide CLI features.
   */
  const w = require('@nrwl/workspace');
  if (w.supportedNxCommands.includes(process.argv[2])) {
    // The commandsObject is a Yargs object declared in `nx-commands.ts`,
    // It is exposed and bootstrapped here to provide CLI features.
    w.commandsObject.argv;
  } else {
    require(w.closestCli(__dirname));
  }
} else {
  require(findLocalNx(process.cwd()));
}
