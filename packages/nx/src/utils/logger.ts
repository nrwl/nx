import * as pc from 'picocolors';

export const NX_PREFIX = pc.inverse(pc.bold(pc.cyan(' NX ')));

export const NX_ERROR = pc.inverse(pc.bold(pc.red(' ERROR ')));

export const logger = {
  warn: (s) => console.warn(pc.bold(pc.yellow(s))),
  error: (s) => {
    if (typeof s === 'string' && s.startsWith('NX ')) {
      console.error(`\n${NX_ERROR} ${pc.bold(pc.red(s.slice(3)))}\n`);
    } else if (s instanceof Error && s.stack) {
      console.error(pc.bold(pc.red(s.stack)));
    } else {
      console.error(pc.bold(pc.red(s)));
    }
  },
  info: (s) => {
    if (typeof s === 'string' && s.startsWith('NX ')) {
      console.info(`\n${NX_PREFIX} ${pc.bold(s.slice(3))}\n`);
    } else {
      console.info(s);
    }
  },
  log: (...s) => {
    console.log(...s);
  },
  debug: (...s) => {
    console.debug(...s);
  },
  fatal: (...s) => {
    console.error(...s);
  },
  verbose: (...s) => {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(...s);
    }
  },
};

export function stripIndent(str: string): string {
  const match = str.match(/^[ \t]*(?=\S)/gm);
  if (!match) {
    return str;
  }
  const indent = match.reduce((r, a) => Math.min(r, a.length), Infinity);
  const regex = new RegExp(`^[ \\t]{${indent}}`, 'gm');
  return str.replace(regex, '');
}
