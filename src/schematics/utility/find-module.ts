/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Tree, normalizePath } from '@angular-devkit/schematics';
import * as path from 'path';

/**
 * Function to find the "closest" module to a generated file's path.
 */
export function findModule(host: Tree, generateDir: string): string {
  let closestModule = generateDir;
  const allFiles = host.files;

  let modulePath: string | null = null;
  const moduleRe = /\.module\.ts$/;
  while (closestModule) {
    const normalizedRoot = normalizePath(closestModule);
    const matches = allFiles.filter(p => moduleRe.test(p) && p.startsWith(normalizedRoot));

    if (matches.length == 1) {
      modulePath = matches[0];
      break;
    } else if (matches.length > 1) {
      throw new Error('More than one module matches. Use skip-import option to skip importing '
        + 'the component into the closest module.');
    }
    closestModule = closestModule.split('/').slice(0, -1).join('/');
  }

  if (!modulePath) {
    throw new Error('Could not find an NgModule for the new component. Use the skip-import '
      + 'option to skip importing components in NgModule.');
  }

  return modulePath;
}

/**
 * Build a relative path from one file path to another file path.
 */
export function buildRelativePath(from: string, to: string) {
  // Convert to arrays.
  const fromParts = from.split('/');
  const toParts = to.split('/');

  // Remove file names (preserving destination)
  fromParts.pop();
  const toFileName = toParts.pop();

  const relativePath = path.relative(fromParts.join('/'), toParts.join('/'));
  let pathPrefix = '';

  // Set the path prefix for same dir or child dir, parent dir starts with `..`
  if (!relativePath) {
    pathPrefix = '.';
  } else if (!relativePath.startsWith('.')) {
    pathPrefix = `./`;
  }

  return `${pathPrefix}${relativePath}/${toFileName}`;
}
