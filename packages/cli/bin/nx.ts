#!/usr/bin/env node
import { statSync } from 'fs';
import * as path from 'path';

function findWorkspaceRoot(dir: string) {
  if (path.dirname(dir) === dir) return null;
  if (exists(path.join(dir, 'angular.json'))) {
    return { type: 'angular', dir };
  } else if (exists(path.join(dir, 'workspace.json'))) {
    return { type: 'nx', dir };
  } else {
    return findWorkspaceRoot(path.dirname(dir));
  }
}

function exists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile() || statSync(filePath).isDirectory();
  } catch (err) {
    return false;
  }
}

const workspace = findWorkspaceRoot(__dirname);

// we are running a local nx
if (workspace) {
  // The commandsObject is a Yargs object declared in `nx-commands.ts`,
  // It is exposed and bootstrapped here to provide CLI features.
  const w = require('@nrwl/workspace');
  if (w.supportedNxCommands.includes(process.argv[2])) {
    // The commandsObject is a Yargs object declared in `nx-commands.ts`,
    // It is exposed and bootstrapped here to provide CLI features.
    w.commandsObject.argv;
  } else if (workspace.type === 'nx') {
    require(path.join(
      workspace.dir,
      'node_modules',
      '@nrwl',
      'tao',
      'index.js'
    ));
  } else if (workspace.type === 'angular') {
    require(path.join(
      workspace.dir,
      'node_modules',
      '@angular',
      'cli',
      'lib',
      'init.js'
    ));
  }
} else {
  // we are running global nx
  const w = findWorkspaceRoot(process.cwd());
  if (w) {
    require(path.join(w.dir, 'node_modules', '@nrwl', 'cli', 'bin', 'nx.js'));
  } else {
    console.error(
      `Error: The current directory isn't part of an Nx workspace.`
    );
    process.exit(1);
  }
}
