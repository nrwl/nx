import { ESLintUtils } from '@typescript-eslint/experimental-utils';
import type { AST } from 'jsonc-eslint-parser';

// NOTE: The rule will be available in ESLint configs as "@nrwl/nx/workspace/valid-schema-description"
export const RULE_NAME = 'valid-schema-description';

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: `Ensures that nx schemas contain valid descriptions in order to provide consistent --help output for commands`,
      recommended: 'error',
    },
    fixable: 'code',
    schema: [],
    messages: {
      requireSchemaDescriptionString:
        'A schema description string is required in order to render --help output correctly',
      validSchemaDescription:
        'A schema description should end with a . character for consistency',
    },
  },
  defaultOptions: [],
  create(context) {
    // jsonc-eslint-parser adds this property to parserServices where appropriate
    if (!(context.parserServices as any).isJSON) {
      return {};
    }
    return {
      ['JSONExpressionStatement > JSONObjectExpression'](
        node: AST.JSONObjectExpression
      ) {
        const descriptionParentJSONPropertyNode =
          resolveDescriptionParentPropertyNode(node);
        if (!descriptionParentJSONPropertyNode) {
          context.report({
            node: node as any,
            messageId: 'requireSchemaDescriptionString',
          });
          return;
        }

        if (!descriptionParentJSONPropertyNode.value.value.endsWith('.')) {
          context.report({
            node: descriptionParentJSONPropertyNode.value as any,
            messageId: 'validSchemaDescription',
            fix: (fixer) => {
              const [start, end] =
                descriptionParentJSONPropertyNode.value.range;
              return fixer.insertTextAfterRange(
                [start, end - 1], // -1 to account for the closing " of the string
                '.'
              );
            },
          });
        }
      },
    };
  },
});

interface JSONPropertyWithStringLiteralValue extends AST.JSONProperty {
  key: AST.JSONStringLiteral;
  value: AST.JSONStringLiteral;
}

function resolveDescriptionParentPropertyNode(
  node: AST.JSONObjectExpression
): JSONPropertyWithStringLiteralValue | null {
  const descriptionParentJSONPropertyNode = node.properties.find((prop) => {
    return (
      prop.key.type === 'JSONLiteral' &&
      prop.key.value === 'description' &&
      prop.value.type === 'JSONLiteral' &&
      typeof prop.value.value === 'string' &&
      prop.value.value.length > 0
    );
  });
  return descriptionParentJSONPropertyNode as JSONPropertyWithStringLiteralValue;
}
