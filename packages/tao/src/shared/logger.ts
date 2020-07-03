import { logging, terminal } from '@angular-devkit/core';
import { createConsoleLogger } from '@angular-devkit/core/node';

const NX_PREFIX = `${terminal.cyan('>')} ${terminal.inverse(
  terminal.bold(terminal.cyan(' NX '))
)}`;

const NX_ERROR = terminal.inverse(terminal.bold(terminal.red(' ERROR ')));

let logger: logging.Logger;
export const getLogger = (isVerbose = false): logging.Logger => {
  if (!logger) {
    logger = createConsoleLogger(isVerbose, process.stdout, process.stderr, {
      warn: (s) => terminal.bold(terminal.yellow(s)),
      error: (s) => {
        if (s.startsWith('NX ')) {
          return `\n${NX_ERROR} ${terminal.bold(terminal.red(s.substr(3)))}\n`;
        }

        return terminal.bold(terminal.red(s));
      },
      fatal: (s) => terminal.bold(terminal.red(s)),
      info: (s) => {
        if (s.startsWith('NX ')) {
          return `\n${NX_PREFIX} ${terminal.bold(s.substr(3))}\n`;
        }

        return terminal.white(s);
      },
    });
  }

  return logger;
};
