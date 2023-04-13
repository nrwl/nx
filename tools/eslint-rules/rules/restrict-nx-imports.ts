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

import { normalizePath, workspaceRoot } from '@nrwl/devkit';
import {
  ESLintUtils,
  AST_NODE_TYPES,
  TSESTree,
} from '@typescript-eslint/utils';

// NOTE: The rule will be available in ESLint configs as "@nrwl/nx/workspace/restrict-nx-imports"
export const RULE_NAME = 'restrict-nx-imports';

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: `Ensure that there are no deep imports from nx/src/plugins/js`,
      recommended: 'error',
    },
    schema: [],
    messages: {
      noCircularNx:
        'Functions within "nx" should be imported with relative path. Alias import found: {{imp}}',
      noDeepImport:
        'Functions from "nx/src/plugins/js" should be imported via barrel import. Deep import found: {{imp}}',
      noDeepRelativeImport:
        'Functions from "./plugins/js" should be imported via relative barrel import. Deep import found: {{imp}}',
    },
  },
  defaultOptions: [],
  create(context) {
    function run(
      node:
        | TSESTree.ImportDeclaration
        | TSESTree.ImportExpression
        | TSESTree.ExportAllDeclaration
        | TSESTree.ExportNamedDeclaration
    ) {
      // Ignoring ExportNamedDeclarations like:
      // export class Foo {}
      if (!node.source) {
        return;
      }

      // accept only literals because template literals have no value
      if (node.source.type !== AST_NODE_TYPES.Literal) {
        return;
      }
      const imp = node.source.value as string;
      if (imp.includes('nx/src/plugins/js/')) {
        context.report({
          node,
          messageId: 'noDeepImport',
          data: {
            imp,
          },
        });
      }
      const fileName = normalizePath(context.getFilename()).slice(
        workspaceRoot.length + 1
      );
      if (
        imp.includes('./plugins/js/') &&
        fileName.startsWith('packages/nx/')
      ) {
        context.report({
          node,
          messageId: 'noDeepRelativeImport',
          data: {
            imp,
          },
        });
      }
      if (imp.includes('nx/src') && fileName.startsWith('packages/nx/')) {
        context.report({
          node,
          messageId: 'noCircularNx',
          data: {
            imp,
          },
        });
      }
    }

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        run(node);
      },
      ImportExpression(node: TSESTree.ImportExpression) {
        run(node);
      },
      ExportAllDeclaration(node: TSESTree.ExportAllDeclaration) {
        run(node);
      },
      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        run(node);
      },
    };
  },
});
