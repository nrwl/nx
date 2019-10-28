/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { EmittedFiles } from '@angular-devkit/build-webpack';
import { Path, dirname, getSystemPath, join, virtualFs } from '@angular-devkit/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ExtraEntryPoint } from '../../../browser/schema';
import { generateEntryPoints } from '../package-chunk-sort';
import { stripBom } from '../strip-bom';
import { CrossOriginValue, FileInfo, augmentIndexHtml } from './augment-index-html';

type ExtensionFilter = '.js' | '.css';

export interface WriteIndexHtmlOptions {
  host: virtualFs.Host;
  outputPath: Path;
  indexPath: Path;
  files?: EmittedFiles[];
  noModuleFiles?: EmittedFiles[];
  moduleFiles?: EmittedFiles[];
  baseHref?: string;
  deployUrl?: string;
  sri?: boolean;
  scripts?: ExtraEntryPoint[];
  styles?: ExtraEntryPoint[];
  postTransform?: IndexHtmlTransform;
  crossOrigin?: CrossOriginValue;
}

export type IndexHtmlTransform = (content: string) => Promise<string>;

export function writeIndexHtml({
  host,
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
}: WriteIndexHtmlOptions): Observable<void> {
  return host.read(indexPath).pipe(
    map(content => stripBom(virtualFs.fileBufferToString(content))),
    switchMap(content =>
      augmentIndexHtml({
        input: getSystemPath(outputPath),
        inputContent: content,
        baseHref,
        deployUrl,
        crossOrigin,
        sri,
        entrypoints: generateEntryPoints({ scripts, styles }),
        files: filterAndMapBuildFiles(files, ['.js', '.css']),
        noModuleFiles: filterAndMapBuildFiles(noModuleFiles, '.js'),
        moduleFiles: filterAndMapBuildFiles(moduleFiles, '.js'),
        loadOutputFile: async filePath => {
          return host
            .read(join(dirname(outputPath), filePath))
            .pipe(map(data => virtualFs.fileBufferToString(data)))
            .toPromise();
        },
      }),
    ),
    switchMap(content => (postTransform ? postTransform(content) : of(content))),
    map(content => virtualFs.stringToFileBuffer(content)),
    switchMap(content => host.write(outputPath, content)),
  );
}

function filterAndMapBuildFiles(
  files: EmittedFiles[],
  extensionFilter: ExtensionFilter | ExtensionFilter[],
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
