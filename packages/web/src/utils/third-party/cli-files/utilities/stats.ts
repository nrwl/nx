/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
import { tags, terminal } from '@angular-devkit/core';
import * as path from 'path';

const { bold, green, red, reset, white, yellow } = terminal;

export function formatSize(size: number): string {
  if (size <= 0) {
    return '0 bytes';
  }

  const abbreviations = ['bytes', 'kB', 'MB', 'GB'];
  const index = Math.floor(Math.log(size) / Math.log(1024));

  return `${+(size / Math.pow(1024, index)).toPrecision(3)} ${
    abbreviations[index]
  }`;
}

export function generateBundleStats(
  info: {
    id: string | number;
    size?: number;
    files: string[];
    names?: string[];
    entry: boolean;
    initial: boolean;
    rendered?: boolean;
  },
  colors: boolean
): string {
  const g = (x: string) => (colors ? bold(green(x)) : x);
  const y = (x: string) => (colors ? bold(yellow(x)) : x);

  const size = typeof info.size === 'number' ? ` ${formatSize(info.size)}` : '';
  const files = info.files.map((f) => path.basename(f)).join(', ');
  const names = info.names ? ` (${info.names.join(', ')})` : '';
  const initial = y(info.entry ? '[entry]' : info.initial ? '[initial]' : '');
  const flags = ['rendered', 'recorded']
    .map((f) => (f && (info as any)[f] ? g(` [${f}]`) : ''))
    .join('');

  return `chunk {${y(info.id.toString())}} ${g(
    files
  )}${names}${size} ${initial}${flags}`;
}

export function generateBuildStats(
  hash: string,
  time: number,
  colors: boolean
): string {
  const w = (x: string) => (colors ? bold(white(x)) : x);
  return `Date: ${w(new Date().toISOString())} - Hash: ${w(hash)} - Time: ${w(
    '' + time
  )}ms`;
}

export function statsToString(json: any, statsConfig: any) {
  const colors = statsConfig.colors;
  const rs = (x: string) => (colors ? reset(x) : x);
  const w = (x: string) => (colors ? bold(white(x)) : x);

  const changedChunksStats = json.chunks
    .filter((chunk: any) => chunk.rendered)
    .map((chunk: any) => {
      const asset = json.assets.filter((x: any) => x.name == chunk.files[0])[0];
      return generateBundleStats(
        { ...chunk, size: asset && asset.size },
        colors
      );
    });

  const unchangedChunkNumber = json.chunks.length - changedChunksStats.length;

  if (unchangedChunkNumber > 0) {
    return (
      '\n' +
      rs(tags.stripIndents`
      Date: ${w(new Date().toISOString())} - Hash: ${w(json.hash)}
      ${unchangedChunkNumber} unchanged chunks
      ${changedChunksStats.join('\n')}
      Time: ${w('' + json.time)}ms
      `)
    );
  } else {
    return (
      '\n' +
      rs(tags.stripIndents`
      ${changedChunksStats.join('\n')}
      Date: ${w(new Date().toISOString())} - Hash: ${w(json.hash)} - Time: ${w(
        '' + json.time
      )}ms
      `)
    );
  }
}

export function statsWarningsToString(json: any, statsConfig: any) {
  const colors = statsConfig.colors;
  const rs = (x: string) => (colors ? reset(x) : x);
  const y = (x: string) => (colors ? bold(yellow(x)) : x);

  return rs(
    '\n' +
      json.warnings
        .map((warning: any) => y(`WARNING in ${warning}`))
        .join('\n\n')
  );
}

export function statsErrorsToString(json: any, statsConfig: any) {
  const colors = statsConfig.colors;
  const rs = (x: string) => (colors ? reset(x) : x);
  const r = (x: string) => (colors ? bold(red(x)) : x);

  return rs(
    '\n' + json.errors.map((error: any) => r(`ERROR in ${error}`)).join('\n')
  );
}
