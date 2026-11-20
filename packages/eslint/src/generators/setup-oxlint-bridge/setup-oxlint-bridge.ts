import {
  addDependenciesToPackageJson,
  formatFiles,
  type GeneratorCallback,
  logger,
  type Tree,
} from '@nx/devkit';
import ts = require('typescript');
import { assertSupportedEslintVersion } from '../../utils/assert-supported-eslint-version';
import {
  baseEslintConfigFilenames,
  eslintFlatConfigFilenames,
} from '../../utils/flat-config';
import { findEslintFile } from '../utils/eslint-file';
import { eslintPluginOxlintVersion, jitiVersion } from '../../utils/versions';
import type { SetupOxlintBridgeSchema } from './schema';

export async function setupOxlintBridgeGenerator(
  tree: Tree,
  options: SetupOxlintBridgeSchema
): Promise<GeneratorCallback> {
  assertSupportedEslintVersion(tree);
  const file = findEslintFile(tree);
  if (!file)
    throw new Error(
      'No ESLint config file found. Run `nx g @nx/eslint:init` first.'
    );
  if (
    ![...eslintFlatConfigFilenames, ...baseEslintConfigFilenames].includes(
      file
    ) ||
    !file.endsWith('js')
  ) {
    throw new Error(
      `The ESLint config "${file}" does not appear to be a flat config.`
    );
  }
  const content = tree.read(file, 'utf-8');
  const source = parse(content);
  if (source.statements.some(importsBridge)) {
    logger.info('The config already imports eslint-plugin-oxlint. Skipping.');
    return () => {};
  }

  const format = source.statements.some(ts.isExportAssignment) ? 'mjs' : 'cjs';
  const updated = injectOxlintBridge(
    content,
    format,
    options.oxlintConfigPath ?? './oxlint.config.ts'
  );
  tree.write(file, updated);
  const install = options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(
        tree,
        {},
        {
          'eslint-plugin-oxlint': eslintPluginOxlintVersion,
          jiti: jitiVersion,
        },
        undefined,
        options.keepExistingVersions
      );
  if (!options.skipFormat) await formatFiles(tree);
  return install;
}

function parse(content: string) {
  return ts.createSourceFile(
    'eslint.config.js',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
}

function importsBridge(stmt: ts.Statement): boolean {
  if (ts.isImportDeclaration(stmt)) {
    return (
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text === 'eslint-plugin-oxlint'
    );
  }
  return (
    ts.isVariableStatement(stmt) &&
    stmt.declarationList.declarations.some(
      ({ initializer }) =>
        initializer &&
        ts.isCallExpression(initializer) &&
        initializer.expression.getText() === 'require' &&
        initializer.arguments.length === 1 &&
        ts.isStringLiteral(initializer.arguments[0]) &&
        initializer.arguments[0].text === 'eslint-plugin-oxlint'
    )
  );
}

function exportValue(stmt: ts.Statement, format: 'mjs' | 'cjs') {
  if (format === 'mjs' && ts.isExportAssignment(stmt)) return stmt.expression;
  if (
    format === 'cjs' &&
    ts.isExpressionStatement(stmt) &&
    ts.isBinaryExpression(stmt.expression) &&
    stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    stmt.expression.left.getText() === 'module.exports'
  ) {
    return stmt.expression.right;
  }
}

export function injectOxlintBridge(
  content: string,
  format: 'mjs' | 'cjs',
  configPath: string
) {
  const source = parse(content);
  for (const stmt of source.statements) {
    const value = exportValue(stmt, format);
    if (!value) continue;
    const elements = ts.isArrayLiteralExpression(value)
      ? value.elements
      : ts.isCallExpression(value) &&
          value.expression.getText() === 'defineConfig'
        ? value.arguments
        : undefined;
    if (!elements) break;
    const path = JSON.stringify(configPath);
    const setup =
      format === 'mjs'
        ? `import oxlint from 'eslint-plugin-oxlint';\nimport { createJiti } from 'jiti';\nconst oxlintConfig = (await createJiti(import.meta.url).import(${path})).default;`
        : `const oxlint = require('eslint-plugin-oxlint');\nconst { createJiti } = require('jiti');\nconst oxlintConfig = createJiti(__filename)(${path}).default;`;
    const insert = value.end - 1;
    const separator = elements.length && !elements.hasTrailingComma ? ',' : '';
    const blocks =
      "{ linterOptions: { reportUnusedDisableDirectives: 'off' } },\n  ...oxlint.buildFromOxlintConfig(oxlintConfig)";
    return (
      content.slice(0, stmt.getStart(source)) +
      setup +
      '\n\n' +
      content.slice(stmt.getStart(source), insert) +
      separator +
      '\n  ' +
      blocks +
      ',\n' +
      content.slice(insert)
    );
  }
  throw new Error(
    'Expected an exported flat config array or defineConfig(...) call.'
  );
}

export default setupOxlintBridgeGenerator;
