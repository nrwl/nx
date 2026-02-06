import chalk = require('chalk');
import { isOnDaemon } from '../daemon/is-on-daemon';
import { serverLogger } from '../daemon/logger';

export const NX_PREFIX = chalk.inverse(chalk.bold(chalk.cyan(' NX ')));

export const NX_ERROR = chalk.inverse(chalk.bold(chalk.red(' ERROR ')));

type LogDriver = Pick<Console, 'warn' | 'error' | 'info' | 'log' | 'debug'>;

export function createLogger(driver: LogDriver) {
  return {
    warn: (...v) => driver.warn(...v.map((s) => chalk.bold(chalk.yellow(s)))),
    error: (s) => {
      if (typeof s === 'string' && s.startsWith('NX ')) {
        driver.error(`\n${NX_ERROR} ${chalk.bold(chalk.red(s.slice(3)))}\n`);
      } else if (s instanceof Error && s.stack) {
        driver.error(chalk.bold(chalk.red(s.stack)));
      } else {
        driver.error(chalk.bold(chalk.red(s)));
      }
    },
    info: (s) => {
      if (typeof s === 'string' && s.startsWith('NX ')) {
        driver.info(`\n${NX_PREFIX} ${chalk.bold(s.slice(3))}\n`);
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
