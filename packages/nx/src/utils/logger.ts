import { styleText } from 'node:util';

export const NX_PREFIX = styleText(['inverse', 'bold', 'cyan'], ' NX ');

export const NX_ERROR = styleText(['inverse', 'bold', 'red'], ' ERROR ');

export const logger = {
  warn: (s) => console.warn(styleText(['bold', 'yellow'], String(s))),
  error: (s) => {
    if (typeof s === 'string' && s.startsWith('NX ')) {
      console.error(
        `\n${NX_ERROR} ${styleText(['bold', 'red'], s.slice(3))}\n`
      );
    } else if (s instanceof Error && s.stack) {
      console.error(styleText(['bold', 'red'], s.stack));
    } else {
      console.error(styleText(['bold', 'red'], String(s)));
    }
  },
  info: (s) => {
    if (typeof s === 'string' && s.startsWith('NX ')) {
      console.info(`\n${NX_PREFIX} ${styleText('bold', s.slice(3))}\n`);
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
