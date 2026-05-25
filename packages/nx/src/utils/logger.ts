import * as pc from 'picocolors';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { serverLogger } from '../daemon/logger';

export const NX_PREFIX = pc.inverse(pc.bold(pc.cyan(' NX ')));

export const NX_ERROR = pc.inverse(pc.bold(pc.red(' ERROR ')));

type LogDriver = Pick<Console, 'warn' | 'error' | 'info' | 'log' | 'debug'>;

export function createLogger(driver: LogDriver) {
  return {
    warn: (...v) => driver.warn(...v.map((s) => pc.bold(pc.yellow(s)))),
    error: (s) => {
      if (typeof s === 'string' && s.startsWith('NX ')) {
        driver.error(`\n${NX_ERROR} ${pc.bold(pc.red(s.slice(3)))}\n`);
      } else if (s instanceof Error && s.stack) {
        driver.error(pc.bold(pc.red(s.stack)));
      } else {
        driver.error(pc.bold(pc.red(s)));
      }
    },
    info: (s) => {
      if (typeof s === 'string' && s.startsWith('NX ')) {
        driver.info(`\n${NX_PREFIX} ${pc.bold(s.slice(3))}\n`);
      } else {
        driver.info(s);
      }
    },
    log: (...s) => {
      driver.log(...s);
    },
    debug: (...s) => {
      driver.debug(...s);
    },
    fatal: (...s) => {
      driver.error(...s);
    },
    verbose: (...s) => {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        // verbose logs go to stderr to prevent things like `nx show projects | grep`
        // breaking when you enable verbose logging. The only potential breakage from
        // this would be if a tool counts any output on stderr as being an issue, but
        // there are likely other places that would trigger those same issues.
        driver.warn(...s);
      }
    },
  };
}

export const logger = createLogger(
  isOnDaemon()
    ? (() => {
        const log = serverLogger.log.bind(serverLogger);
        return {
          warn: log,
          error: log,
          debug: log,
          info: log,
          log: log,
        };
      })()
    : console
);

export function stripIndent(str: string): string {
  const match = str.match(/^[ \t]*(?=\S)/gm);
  if (!match) {
    return str;
  }
  const indent = match.reduce((r, a) => Math.min(r, a.length), Infinity);
  const regex = new RegExp(`^[ \\t]{${indent}}`, 'gm');
  return str.replace(regex, '');
}
