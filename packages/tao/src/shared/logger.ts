import { createConsoleLogger } from '@angular-devkit/core/node';
import { terminal } from '@angular-devkit/core';

export const logger = createConsoleLogger(
  false,
  process.stdout,
  process.stderr,
  {
    warn: s => terminal.bold(terminal.yellow(s)),
    error: s => terminal.bold(terminal.red(s)),
    fatal: s => terminal.bold(terminal.red(s))
  }
);
