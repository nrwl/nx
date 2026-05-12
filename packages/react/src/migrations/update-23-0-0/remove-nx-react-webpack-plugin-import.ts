import { formatFiles, Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';

const DEPRECATED_SYMBOL = 'NxReactWebpackPlugin';
const DEPRECATED_PACKAGE = '@nx/react';
const NEW_PACKAGE = '@nx/react/webpack-plugin';

// ES module import: import { NxReactWebpackPlugin[, ...] } from '@nx/react'
const ES_IMPORT_SELECTOR = `ImportDeclaration:has(StringLiteral[value=${DEPRECATED_PACKAGE}]):has(ImportClause ImportSpecifier > Identifier[name=${DEPRECATED_SYMBOL}])`;
const IMPORT_SPECIFIERS_SELECTOR = `ImportClause ImportSpecifier`;
const TARGET_IMPORT_SPECIFIER_SELECTOR = `ImportClause ImportSpecifier > Identifier[name=${DEPRECATED_SYMBOL}]`;
const ES_MODULE_PATH_SELECTOR = `StringLiteral[value=${DEPRECATED_PACKAGE}]`;

// CJS require: const { NxReactWebpackPlugin[, ...] } = require('@nx/react')
const CJS_REQUIRE_STMT_SELECTOR = `VariableStatement:has(ObjectBindingPattern > BindingElement > Identifier[name=${DEPRECATED_SYMBOL}]):has(CallExpression:has(Identifier[name=require]) > StringLiteral[value=${DEPRECATED_PACKAGE}])`;
const CJS_BINDING_ELEMENTS_SELECTOR = `ObjectBindingPattern > BindingElement`;
const CJS_TARGET_BINDING_SELECTOR = `ObjectBindingPattern > BindingElement > Identifier[name=${DEPRECATED_SYMBOL}]`;
const CJS_REQUIRE_PATH_SELECTOR = `CallExpression:has(Identifier[name=require]) > StringLiteral[value=${DEPRECATED_PACKAGE}]`;

export default async function removeNxReactWebpackPluginImport(tree: Tree) {
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
    let sourceFile = ast(contents);

    // Handle ES module imports
    const esImportNodes = query(sourceFile, ES_IMPORT_SELECTOR);
    for (const importNode of esImportNodes) {
      const specifiers = query(importNode, IMPORT_SPECIFIERS_SELECTOR);
      const targetIdentifier = query(
        importNode,
        TARGET_IMPORT_SPECIFIER_SELECTOR
      )[0];
      if (!targetIdentifier) continue;

      // Walk to the ImportSpecifier so we cover both `Foo` and `Foo as Bar`.
      const targetSpec = targetIdentifier.parent;
      if (specifiers.length === 1) {
        // Single specifier - replace the module path string only
        const modulePathNode = query(importNode, ES_MODULE_PATH_SELECTOR)[0];
        if (!modulePathNode) continue;
        contents =
          contents.slice(0, modulePathNode.getStart()) +
          `'${NEW_PACKAGE}'` +
          contents.slice(modulePathNode.getEnd());
      } else {
        // Multiple specifiers - extract target spec verbatim (preserves alias)
        const end =
          contents.charAt(targetSpec.getEnd()) === ','
            ? targetSpec.getEnd() + 1
            : targetSpec.getEnd();
        contents =
          `import { ${targetSpec.getText()} } from '${NEW_PACKAGE}';\n` +
          contents.slice(0, targetSpec.getStart()) +
          contents.slice(end);
      }
      changed = true;
    }

    // Re-parse if content changed before handling require() calls
    if (changed) {
      sourceFile = ast(contents);
    }

    // Handle CJS require() imports
    const requireNodes = query(sourceFile, CJS_REQUIRE_STMT_SELECTOR);
    for (const stmtNode of requireNodes) {
      const bindingElements = query(stmtNode, CJS_BINDING_ELEMENTS_SELECTOR);
      const targetIdentifier = query(stmtNode, CJS_TARGET_BINDING_SELECTOR)[0];
      if (!targetIdentifier) continue;

      // Walk to the BindingElement so we cover both `Foo` and `Foo: Bar`.
      const targetBinding = targetIdentifier.parent;
      if (bindingElements.length === 1) {
        // Single binding - replace the require path string only
        const requirePathNode = query(stmtNode, CJS_REQUIRE_PATH_SELECTOR)[0];
        if (!requirePathNode) continue;
        contents =
          contents.slice(0, requirePathNode.getStart()) +
          `'${NEW_PACKAGE}'` +
          contents.slice(requirePathNode.getEnd());
      } else {
        // Multiple bindings - extract target binding verbatim (preserves alias)
        const end =
          contents.charAt(targetBinding.getEnd()) === ','
            ? targetBinding.getEnd() + 1
            : targetBinding.getEnd();
        contents =
          `const { ${targetBinding.getText()} } = require('${NEW_PACKAGE}');\n` +
          contents.slice(0, targetBinding.getStart()) +
          contents.slice(end);
      }
      changed = true;
    }

    if (changed) {
      tree.write(filePath, contents);
    }
  });

  await formatFiles(tree);
}
