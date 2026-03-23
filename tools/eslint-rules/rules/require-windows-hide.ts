import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-require-windows-hide"
export const RULE_NAME = 'require-windows-hide';

const SPAWN_FUNCTIONS = new Set([
  'spawn',
  'spawnSync',
  'exec',
  'execSync',
  'execFile',
  'execFileSync',
]);

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensures that child_process spawn/exec calls include windowsHide: true to prevent console windows from flashing on Windows.',
    },
    schema: [],
    messages: {
      missingWindowsHide:
        'windowsHide must be set to true to prevent console windows from flashing on Windows.',
      windowsHideMustBeTrue:
        'windowsHide must be set to true to prevent console windows from flashing on Windows.',
    },
  },
  defaultOptions: [],
  create(context) {
    // Skip spec/test files
    if (
      context.physicalFilename.endsWith('.spec.ts') ||
      context.physicalFilename.endsWith('.test.ts')
    ) {
      return {};
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const calleeName = getCalleeName(node);
        if (!calleeName || !SPAWN_FUNCTIONS.has(calleeName)) {
          return;
        }

        // Find the options argument (object expression) in the call arguments
        const optionsArg = node.arguments.find(
          (arg): arg is TSESTree.ObjectExpression =>
            arg.type === 'ObjectExpression'
        );

        if (!optionsArg) {
          // Check if the last argument could be options passed as a variable
          const lastArg = node.arguments[node.arguments.length - 1];
          const hasVariableOptions =
            lastArg &&
            (lastArg.type === 'Identifier' || lastArg.type === 'SpreadElement');
          if (hasVariableOptions) {
            return;
          }
          // No options object provided at all - report error
          context.report({
            messageId: 'missingWindowsHide',
            node: node,
          });
          return;
        }

        // Look for windowsHide property
        const windowsHideProp = optionsArg.properties.find(
          (prop): prop is TSESTree.Property =>
            prop.type === 'Property' &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'windowsHide'
        );

        if (!windowsHideProp) {
          // windowsHide is missing from the options object
          context.report({
            messageId: 'missingWindowsHide',
            node: optionsArg,
          });
          return;
        }

        // windowsHide exists but check it's set to true
        if (
          windowsHideProp.value.type === 'Literal' &&
          windowsHideProp.value.value !== true
        ) {
          context.report({
            messageId: 'windowsHideMustBeTrue',
            node: windowsHideProp,
          });
        }
      },
    };
  },
});

function getCalleeName(node: TSESTree.CallExpression): string | null {
  // Direct call: spawn(...)
  if (node.callee.type === 'Identifier') {
    return node.callee.name;
  }
  // Member expression: child_process.spawn(...)
  if (
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier'
  ) {
    return node.callee.property.name;
  }
  return null;
}
