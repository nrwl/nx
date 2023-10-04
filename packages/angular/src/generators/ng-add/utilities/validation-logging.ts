import * as chalk from 'chalk';
import type { ValidationError } from './types';

export function arrayToString(array: string[]): string {
  if (array.length === 0) {
    return '';
  }

  if (array.length === 1) {
    return quote(array[0]);
  }

  const last = array[array.length - 1];
  const rest = array.slice(0, array.length - 1);
  return `${rest.map(quote).join(', ')} and ${quote(last)}`;
}

export function getProjectValidationResultMessage(
  validationResult: ValidationError[]
): string {
  return `${chalk.bold('Validation results')}:

  ${validationResult
    .map((error) => getValidationErrorText(error))
    .join('\n\n  ')}`;
}

function getValidationErrorText({
  message,
  messageGroup,
  hint,
}: ValidationError): string {
  let lines = message
    ? [`- ${message}`, ...(hint ? [chalk.dim(chalk.italic(`  ${hint}`))] : [])]
    : [
        `- ${messageGroup.title}:`,
        '  - Errors:',
        ...messageGroup.messages.map((message) => `    - ${message}`),
        ...(hint ? [chalk.dim(chalk.italic(`  - ${hint}`))] : []),
      ];

  return lines.join('\n  ');
}

function quote(str: string): string {
  return `"${str}"`;
}
