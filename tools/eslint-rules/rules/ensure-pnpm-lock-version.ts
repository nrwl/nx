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
import { parseAllDocuments } from 'yaml';

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
  defaultOptions: [] as { version: string }[],
  create(context) {
    // pnpm 12 prepends a package-manager document to the dependency lockfile.
    const documents = parseAllDocuments(context.sourceCode.text);
    const lockfile = documents.at(-1);
    const version = lockfile?.get('lockfileVersion');
    const lockfileVersion =
      !documents.some((document) => document.errors.length) &&
      (typeof version === 'string' || typeof version === 'number')
        ? String(version)
        : undefined;

    const options = context.options;
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
