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

import { ASTUtils, ESLintUtils, TSESTree } from '@typescript-eslint/utils';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-valid-command-object"
export const RULE_NAME = 'valid-command-object';

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: `Ensures that commands contain valid descriptions in order to provide consistent --help output and generated documentation`,
    },
    schema: [],
    messages: {
      validCommandDescription:
        'A command description should end with a . character for consistency',
    },
  },
  defaultOptions: [],
  create(context) {
    if (
      !context.physicalFilename.endsWith('command-object.ts') &&
      !(
        context.physicalFilename.includes('nx/src/command-line/') &&
        // Ignore the examples file, those descriptions work differently
        !context.physicalFilename.endsWith('examples.ts') &&
        // Ignore spec files
        !context.physicalFilename.endsWith('.spec.ts')
      ) &&
      !context.physicalFilename.includes('packages/create-nx-workspace')
    ) {
      return {};
    }

    return {
      'Property > :matches(Identifier[name="describe"], Identifier[name="description"], TaggedTemplateExpression)':
        (node: TSESTree.Identifier) => {
          const propertyNode = node.parent as TSESTree.Property;
          const stringToCheck =
            (propertyNode.value.type === 'Literal' &&
              typeof propertyNode.value.value !== 'boolean') ||
            propertyNode.value.type === 'TemplateLiteral'
              ? ASTUtils.getStringIfConstant(propertyNode.value)
              : null;

          // String description already ends with a . character (or some other form of punctuation)
          if (
            !stringToCheck ||
            // Call trim() to avoid issues with trailing whitespace
            stringToCheck.trim().endsWith('.') ||
            stringToCheck.trim().endsWith('!') ||
            stringToCheck.trim().endsWith('?')
          ) {
            return;
          }
          context.report({
            messageId: 'validCommandDescription',
            node: propertyNode,
            fix: (fixer) => {
              // We need to take the closing ' or " or ` into account when applying the . character
              return fixer.insertTextAfterRange(
                [propertyNode.value.range[0], propertyNode.value.range[1] - 1],
                '.'
              );
            },
          });
        },
    };
  },
});
