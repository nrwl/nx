import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-use-exit-and-flush-analytics"
export const RULE_NAME = 'use-exit-and-flush-analytics';

const EXCLUDED_PATTERNS = [
  /\.spec\.ts$/,
  /analytics\/analytics\.ts$/,
  /analytics\/analytics-processor\.ts$/,
  /tasks-runner\/fork\.ts$/,
  /tasks-runner\/batch\/run-batch\.ts$/,
  /project-graph\/plugins\/isolation\/plugin-worker\.ts$/,
  /command-line\/migrate\/run-migration-process\.js$/,
  /daemon\/server\//,
  /executors\/run-commands\/running-tasks\.ts$/,
  /executors\/run-script\/run-script\.impl\.ts$/,
  /native\/assert-supported-platform\.ts$/,
  /command-line\/init\/implementation\/dot-nx\/nxw\.ts$/,
  /utils\/git-utils\.index-filter\.ts$/,
];

function isExcludedFile(filename: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(filename));
}

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce using exitAndFlushAnalytics() instead of process.exit() to ensure analytics data is flushed before exiting.',
    },
    schema: [],
    messages: {
      useExitAndFlushAnalytics:
        'Use exitAndFlushAnalytics() instead of process.exit() to ensure analytics data is flushed before exiting.',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.physicalFilename;

    // Only apply to files within packages/nx/src/
    if (!filename.includes('packages/nx/src/')) {
      return {};
    }

    // Skip excluded files
    if (isExcludedFile(filename)) {
      return {};
    }

    return {
      'CallExpression > MemberExpression.callee'(
        node: TSESTree.MemberExpression
      ) {
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'process' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'exit'
        ) {
          context.report({
            node: node.parent as TSESTree.CallExpression,
            messageId: 'useExitAndFlushAnalytics',
          });
        }
      },
    };
  },
});
