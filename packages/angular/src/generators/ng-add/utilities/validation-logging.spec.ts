import * as chalk from 'chalk';
import {
  arrayToString,
  getProjectValidationResultMessage,
} from './validation-logging';

describe('arrayToString', () => {
  it('should return an empty string when the array is empty', () => {
    const result = arrayToString([]);

    expect(result).toBe('');
  });

  it('should return quoted string when the array has a single element', () => {
    const result = arrayToString(['foo']);

    expect(result).toBe('"foo"');
  });

  it('should return a comma-separated quoted string when the array has a multiple elements', () => {
    const result = arrayToString(['foo', 'bar', 'baz']);

    expect(result).toBe('"foo", "bar" and "baz"');
  });
});

describe('getProjectValidationResultMessage', () => {
  it('should return a message using the right format', () => {
    const message = getProjectValidationResultMessage([
      { message: 'Simple error message with hint', hint: 'Some hint message' },
      { message: 'Simple error message without hint' },
      {
        messageGroup: {
          title: 'Message group with hint',
          messages: [
            'First error message',
            'Second error message',
            'Third error message',
          ],
        },
        hint: 'Some hint message',
      },
      {
        messageGroup: {
          title: 'Message group without hint',
          messages: ['First error message', 'Second error message'],
        },
      },
    ]);

    expect(message).toBe(`${chalk.bold(`Validation results`)}:

  - Simple error message with hint
  ${chalk.dim(chalk.italic(`  Some hint message`))}

  - Simple error message without hint

  - Message group with hint:
    - Errors:
      - First error message
      - Second error message
      - Third error message
  ${chalk.dim(chalk.italic(`  - Some hint message`))}

  - Message group without hint:
    - Errors:
      - First error message
      - Second error message`);
  });
});
