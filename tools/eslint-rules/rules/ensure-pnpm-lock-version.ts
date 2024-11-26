/**
 * This file sets you up with structure needed for an ESLint rule.
 *
 * It leverages utilities from @typescript-eslint to allow TypeScript to
 * provide autocompletions etc for the configuration.
 *
 * Your rule's custom logic will live within the create() method below
 * and you can learn more about writing ESLint rules on the official guide:
 *
 * https://eslint.org/docs/developer-guide/working-with-rules
 *
 * You can also view many examples of existing rules here:
 *
 * https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin/src/rules
 */

import { ESLintUtils } from '@typescript-eslint/utils';
import { closeSync, openSync, readSync } from 'node:fs';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-ensure-pnpm-lock-version"
export const RULE_NAME = 'ensure-pnpm-lock-version';

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: ``,
    },
    schema: [
      {
        type: 'object',
        properties: {
          version: {
            type: 'string',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unparseableLockfileVersion:
        'Could not parse lockfile version from pnpm-lock.yaml, the file may be corrupted or the ensure-pnpm-lock-version lint rule may need to be updated.',
      incorrectLockfileVersion:
        'pnpm-lock.yaml has a lockfileVersion of {{version}}, but {{expectedVersion}} is required.',
    },
  },
  defaultOptions: [],
  create(context) {
    // Read upon creation of the rule, the contents should not change during linting
    const lockfileFirstLine = readFirstLineSync('pnpm-lock.yaml');
    // Extract the version number, it will be a string in single quotes
    const lockfileVersion = lockfileFirstLine.match(
      /lockfileVersion:\s*'([^']+)'/
    )?.[1];

    const options = context.options as { version: string }[];
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error('Expected an array of options with a version property');
    }
    const expectedLockfileVersion = options[0].version;
    return {
      Program(node) {
        if (!lockfileVersion) {
          context.report({
            node,
            messageId: 'unparseableLockfileVersion',
          });
          return;
        }

        if (lockfileVersion !== expectedLockfileVersion) {
          context.report({
            node,
            messageId: 'incorrectLockfileVersion',
            data: {
              version: lockfileVersion,
              expectedVersion: expectedLockfileVersion,
            },
          });
        }
      },
    };
  },
});

/**
 * pnpm-lock.yaml is a huge file, so only read the first line as efficiently as possible
 * for optimum linting performance.
 */
function readFirstLineSync(filePath: string) {
  const BUFFER_SIZE = 64; // Optimized for the expected line length
  const buffer = Buffer.alloc(BUFFER_SIZE);
  let line = '';
  let bytesRead: number;
  let fd: number;
  try {
    fd = openSync(filePath, 'r');
    bytesRead = readSync(fd, buffer, 0, BUFFER_SIZE, 0);
    line = buffer.toString('utf8', 0, bytesRead).split('\n')[0];
  } catch (err) {
    throw err; // Re-throw to allow caller to handle
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
    }
  }
  return line;
}
