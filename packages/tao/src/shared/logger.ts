import { logging, terminal } from '@angular-devkit/core';
import { createConsoleLogger } from '@angular-devkit/core/node';

let logger: logging.Logger;
export const getLogger = (isVerbose: boolean = false) => {
  if (!logger) {
    logger = createConsoleLogger(isVerbose, process.stdout, process.stderr, {
      warn: s => terminal.bold(terminal.yellow(s)),
      error: s => terminal.bold(terminal.red(s)),
      fatal: s => terminal.bold(terminal.red(s))
    });
  }
  return logger;
};
