import { styleText } from 'node:util';

const orangeColor = (text) => `\x1b[38;5;214m${text}\x1b[39m`;

export const E2E_LOG_PREFIX = `${styleText(
  ['reset', 'inverse', 'bold'],
  orangeColor(' E2E ')
)}`;

export function e2eConsoleLogger(message: string, body?: string) {
  process.stdout.write('\n');
  process.stdout.write(`${E2E_LOG_PREFIX} ${message}\n`);
  if (body) {
    process.stdout.write(`${body}\n`);
  }
  process.stdout.write('\n');
}

export function logInfo(title: string, body?: string) {
  const message = `${styleText(
    ['reset', 'inverse', 'bold', 'white'],
    ' INFO '
  )} ${styleText(['bold', 'white'], title)}`;
  return e2eConsoleLogger(message, body);
}

export function logError(title: string, body?: string) {
  const message = `${styleText(
    ['reset', 'inverse', 'bold', 'red'],
    ' ERROR '
  )} ${styleText(['bold', 'red'], title)}`;
  return e2eConsoleLogger(message, body);
}

export function logSuccess(title: string, body?: string) {
  const message = `${styleText(
    ['reset', 'inverse', 'bold', 'green'],
    ' SUCCESS '
  )} ${styleText(['bold', 'green'], title)}`;
  return e2eConsoleLogger(message, body);
}
