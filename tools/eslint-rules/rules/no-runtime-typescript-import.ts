import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

// NOTE: The rule will be available in ESLint configs as "@nx/workspace-no-runtime-typescript-import"
export const RULE_NAME = 'no-runtime-typescript-import';

const typescriptModule = /^typescript(\/.*)?$/;

export const rule = ESLintUtils.RuleCreator(() => __filename)({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallows loading `typescript` at runtime instead of through the TypeScript adapter.',
    },
    schema: [],
    messages: {
      runtimeImport:
        "Load TypeScript through the adapter: getTypescriptAst() or getTypescriptBackend(), or ensureTypescript() in generators. The workspace's `typescript` can be 7.1, whose root export has no compiler API.",
    },
  },
  defaultOptions: [],
  create(context) {
    if (/\.(spec|test)\.[cm]?[jt]sx?$/.test(context.physicalFilename)) {
      return {};
    }

    const check = (node: TSESTree.Node, source: TSESTree.Node | undefined) => {
      const specifier = getStaticString(source);
      if (specifier !== undefined && typescriptModule.test(specifier)) {
        context.report({ messageId: 'runtimeImport', node });
      }
    };

    return {
      ImportDeclaration(node) {
        if (
          node.importKind === 'type' ||
          (node.specifiers.length > 0 &&
            node.specifiers.every(
              (specifier) =>
                specifier.type === 'ImportSpecifier' &&
                specifier.importKind === 'type'
            ))
        ) {
          return;
        }
        check(node, node.source);
      },
      ExportNamedDeclaration(node) {
        if (
          !node.source ||
          node.exportKind === 'type' ||
          (node.specifiers.length > 0 &&
            node.specifiers.every(
              (specifier) => specifier.exportKind === 'type'
            ))
        ) {
          return;
        }
        check(node, node.source);
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type') {
          check(node, node.source);
        }
      },
      TSImportEqualsDeclaration(node) {
        if (
          node.importKind !== 'type' &&
          node.moduleReference.type === 'TSExternalModuleReference'
        ) {
          check(node, node.moduleReference.expression);
        }
      },
      ImportExpression(node) {
        check(node, node.source);
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          check(node, node.arguments[0]);
        }
      },
    };
  },
});

function getStaticString(node: TSESTree.Node | undefined): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked ?? undefined;
  }
  return undefined;
}
