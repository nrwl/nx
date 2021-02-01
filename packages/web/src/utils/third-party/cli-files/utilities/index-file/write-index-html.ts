/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { dirname, join } from 'path';
import { EmittedFile } from '@nrwl/workspace/src/utilities/run-webpack';
import { ExtraEntryPoint } from '../../../browser/schema';
import { generateEntryPoints } from '../package-chunk-sort';
import { stripBom } from '../strip-bom';
import {
  augmentIndexHtml,
  CrossOriginValue,
  FileInfo,
} from './augment-index-html';
import { readFileSync, writeFileSync } from 'fs-extra';

type ExtensionFilter = '.js' | '.css';

export interface WriteIndexHtmlOptions {
  outputPath: string;
  indexPath: string;
  files?: EmittedFile[];
  noModuleFiles?: EmittedFile[];
  moduleFiles?: EmittedFile[];
  baseHref?: string;
  deployUrl?: string;
  sri?: boolean;
  scripts?: ExtraEntryPoint[];
  styles?: ExtraEntryPoint[];
  postTransform?: IndexHtmlTransform;
  crossOrigin?: CrossOriginValue;
}

export type IndexHtmlTransform = (content: string) => Promise<string>;

export async function writeIndexHtml({
  outputPath,
  indexPath,
  files = [],
  noModuleFiles = [],
  moduleFiles = [],
  baseHref,
  deployUrl,
  sri = false,
  scripts = [],
  styles = [],
  postTransform,
  crossOrigin,
}: WriteIndexHtmlOptions) {
  let content = readFileSync(indexPath).toString();
  content = stripBom(content);
  content = augmentIndexHtml({
    input: outputPath,
    inputContent: content,
    baseHref,
    deployUrl,
    crossOrigin,
    sri,
    entrypoints: generateEntryPoints({ scripts, styles }),
    files: filterAndMapBuildFiles(files, ['.js', '.css']),
    noModuleFiles: filterAndMapBuildFiles(noModuleFiles, '.js'),
    moduleFiles: filterAndMapBuildFiles(moduleFiles, '.js'),
    loadOutputFile: (filePath) =>
      readFileSync(join(dirname(outputPath), filePath)).toString(),
  });
  if (postTransform) {
    content = await postTransform(content);
  }

  writeFileSync(outputPath, content);
}

function filterAndMapBuildFiles(
  files: EmittedFile[],
  extensionFilter: ExtensionFilter | ExtensionFilter[]
): FileInfo[] {
  const filteredFiles: FileInfo[] = [];
  const validExtensions: string[] = Array.isArray(extensionFilter)
    ? extensionFilter
    : [extensionFilter];

  for (const { file, name, extension, initial } of files) {
    if (name && initial && validExtensions.includes(extension)) {
      filteredFiles.push({ file, extension, name });
    }
  }

  return filteredFiles;
}
