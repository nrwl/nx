import { logging } from '@angular-devkit/core';
import * as chalk from 'chalk';
import { createConsoleLogger } from '@angular-devkit/core/node';

const NX_PREFIX = `${chalk.cyan('>')} ${chalk.inverse(
  chalk.bold(chalk.cyan(' NX '))
)}`;

const NX_ERROR = chalk.inverse(chalk.bold(chalk.red(' ERROR ')));

let logger: logging.Logger;
export const getLogger = (isVerbose = false): any => {
  if (!logger) {
    logger = createConsoleLogger(isVerbose, process.stdout, process.stderr, {
      warn: (s) => chalk.bold(chalk.yellow(s)),
      error: (s) => {
        if (s.startsWith('NX ')) {
          return `\n${NX_ERROR} ${chalk.bold(chalk.red(s.substr(3)))}\n`;
        }

        return chalk.bold(chalk.red(s));
      },
      info: (s) => {
        if (s.startsWith('NX ')) {
          return `\n${NX_PREFIX} ${chalk.bold(s.substr(3))}\n`;
        }

        return chalk.white(s);
      },
    });
  }

  return logger;
};
