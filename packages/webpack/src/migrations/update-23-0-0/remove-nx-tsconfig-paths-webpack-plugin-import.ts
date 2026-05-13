import { formatFiles, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';

const DEPRECATED_SYMBOL = 'NxTsconfigPathsWebpackPlugin';
const DEPRECATED_PACKAGE = '@nx/webpack';
const NEW_PACKAGE = '@nx/webpack/tsconfig-paths-plugin';

// ES module import: import { NxTsconfigPathsWebpackPlugin[, ...] } from '@nx/webpack'
const ES_IMPORT_SELECTOR = `ImportDeclaration:has(StringLiteral[value=${DEPRECATED_PACKAGE}]):has(ImportClause ImportSpecifier > Identifier[name=${DEPRECATED_SYMBOL}])`;
const IMPORT_SPECIFIERS_SELECTOR = `ImportClause ImportSpecifier`;
const TARGET_IMPORT_SPECIFIER_SELECTOR = `ImportClause ImportSpecifier > Identifier[name=${DEPRECATED_SYMBOL}]`;
const ES_MODULE_PATH_SELECTOR = `StringLiteral[value=${DEPRECATED_PACKAGE}]`;

// CJS require: const { NxTsconfigPathsWebpackPlugin[, ...] } = require('@nx/webpack')
const CJS_REQUIRE_STMT_SELECTOR = `VariableStatement:has(ObjectBindingPattern > BindingElement > Identifier[name=${DEPRECATED_SYMBOL}]):has(CallExpression:has(Identifier[name=require]) > StringLiteral[value=${DEPRECATED_PACKAGE}])`;
const CJS_BINDING_ELEMENTS_SELECTOR = `ObjectBindingPattern > BindingElement`;
const CJS_TARGET_BINDING_SELECTOR = `ObjectBindingPattern > BindingElement > Identifier[name=${DEPRECATED_SYMBOL}]`;
const CJS_REQUIRE_PATH_SELECTOR = `CallExpression:has(Identifier[name=require]) > StringLiteral[value=${DEPRECATED_PACKAGE}]`;

// Walk past whitespace from `fromIndex` to find a trailing comma. Returns the
// position AFTER the comma if found, otherwise the original index. Handles
// the `Foo , withReact` shape where the user wrote whitespace before the
// comma — `node.getEnd()` stops at the identifier and the comma sits one
// character past the whitespace.
function endAfterTrailingComma(text: string, fromIndex: number): number {
  let i = fromIndex;
  while (i < text.length && /\s/.test(text.charAt(i))) i++;
  return text.charAt(i) === ',' ? i + 1 : fromIndex;
}

export default async function removeNxTsconfigPathsWebpackPluginImport(
  tree: Tree
) {
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (
      !filePath.endsWith('.ts') &&
      !filePath.endsWith('.tsx') &&
      !filePath.endsWith('.js') &&
      !filePath.endsWith('.jsx') &&
      !filePath.endsWith('.cjs') &&
      !filePath.endsWith('.mjs')
    ) {
      return;
    }

    let contents = tree.read(filePath, 'utf-8');
    if (!contents) return;

    // Quick check: must contain the deprecated symbol and the deprecated package path
    if (
      !contents.includes(DEPRECATED_SYMBOL) ||
      (!contents.includes(`'${DEPRECATED_PACKAGE}'`) &&
        !contents.includes(`"${DEPRECATED_PACKAGE}"`))
    ) {
      return;
    }

    let changed = false;

    // Re-parse on every iteration so multiple matches in the same file work
    // correctly. The multi-specifier branch prepends a new declaration which
    // shifts every offset; collected AST positions go stale after one rewrite,
    // so process one match at a time.
    let didRewrite = true;
    while (didRewrite) {
      didRewrite = false;
      const sourceFile = ast(contents);

      const importNode = query(sourceFile, ES_IMPORT_SELECTOR)[0];
      if (importNode) {
        const specifiers = query(importNode, IMPORT_SPECIFIERS_SELECTOR);
        const targetIdentifier = query(
          importNode,
          TARGET_IMPORT_SPECIFIER_SELECTOR
        )[0];
        if (targetIdentifier) {
          // Walk to the ImportSpecifier to cover `Foo` and `Foo as Bar`.
          const targetSpec = targetIdentifier.parent;
          if (specifiers.length === 1) {
            const modulePathNode = query(
              importNode,
              ES_MODULE_PATH_SELECTOR
            )[0];
            if (modulePathNode) {
              contents =
                contents.slice(0, modulePathNode.getStart()) +
                `'${NEW_PACKAGE}'` +
                contents.slice(modulePathNode.getEnd());
              changed = true;
              didRewrite = true;
              continue;
            }
          } else {
            // Extract target spec verbatim (preserves alias)
            const end = endAfterTrailingComma(contents, targetSpec.getEnd());
            contents =
              `import { ${targetSpec.getText()} } from '${NEW_PACKAGE}';\n` +
              contents.slice(0, targetSpec.getStart()) +
              contents.slice(end);
            changed = true;
            didRewrite = true;
            continue;
          }
        }
      }

      const stmtNode = query(sourceFile, CJS_REQUIRE_STMT_SELECTOR)[0];
      if (stmtNode) {
        const bindingElements = query(stmtNode, CJS_BINDING_ELEMENTS_SELECTOR);
        const targetIdentifier = query(
          stmtNode,
          CJS_TARGET_BINDING_SELECTOR
        )[0];
        if (targetIdentifier) {
          // Walk to the BindingElement to cover `Foo` and `Foo: Bar`.
          const targetBinding = targetIdentifier.parent;
          if (bindingElements.length === 1) {
            const requirePathNode = query(
              stmtNode,
              CJS_REQUIRE_PATH_SELECTOR
            )[0];
            if (requirePathNode) {
              contents =
                contents.slice(0, requirePathNode.getStart()) +
                `'${NEW_PACKAGE}'` +
                contents.slice(requirePathNode.getEnd());
              changed = true;
              didRewrite = true;
              continue;
            }
          } else {
            // Extract target binding verbatim (preserves alias)
            const end = endAfterTrailingComma(contents, targetBinding.getEnd());
            contents =
              `const { ${targetBinding.getText()} } = require('${NEW_PACKAGE}');\n` +
              contents.slice(0, targetBinding.getStart()) +
              contents.slice(end);
            changed = true;
            didRewrite = true;
            continue;
          }
        }
      }
    }

    if (changed) {
      tree.write(filePath, contents);
    }
  });

  await formatFiles(tree);
}
