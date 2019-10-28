/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { existsSync } from 'fs';
import * as path from 'path';
import { isDirectory } from './is-directory';

export function findUp(names: string | string[], from: string, stopOnNodeModules = false) {
  if (!Array.isArray(names)) {
    names = [names];
  }
  const root = path.parse(from).root;

  let currentDir = from;
  while (currentDir && currentDir !== root) {
    for (const name of names) {
      const p = path.join(currentDir, name);
      if (existsSync(p)) {
        return p;
      }
    }

    if (stopOnNodeModules) {
      const nodeModuleP = path.join(currentDir, 'node_modules');
      if (existsSync(nodeModuleP)) {
        return null;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

export function findAllNodeModules(from: string, root?: string) {
  const nodeModules: string[] = [];

  let current = from;
  while (current && current !== root) {
    const potential = path.join(current, 'node_modules');
    if (existsSync(potential) && isDirectory(potential)) {
      nodeModules.push(potential);
    }

    const next = path.dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }

  return nodeModules;
}
