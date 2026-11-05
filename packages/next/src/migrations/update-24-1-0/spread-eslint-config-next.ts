import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  visitNotIgnoredFiles,
  type MigrationReturnObject,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import {
  addImportToFlatConfig,
  getEslintConfigNextUsage,
  isEslintConfigFile,
  isFlatConfig,
} from '@nx/eslint/internal';
import { ensureTypescript } from '@nx/js/internal';
import type * as ts from 'typescript';

const NEXT_VITALS = 'nextVitals';
const NEXT_VITALS_IMPORT = 'eslint-config-next/core-web-vitals';
const NEXT_PLUGIN_IMPORT = '@next/eslint-plugin-next';
// The name the @nx/eslint generators give the exported config array.
const CONFIG_VARIABLE = 'eslintConfig';
const GENERATED_COMPAT_CONFIGS = ['next', 'next/core-web-vitals'];
// Modules of the FlatCompat and `@next/next` setup that Nx generated next to the Next.js entries.
const SETUP_MODULES = new Set([
  NEXT_PLUGIN_IMPORT,
  '@eslint/compat',
  '@eslint/eslintrc',
  '@eslint/js',
  'path',
  'url',
  'node:path',
  'node:url',
]);
const CONFLICTING_PLUGIN_MODULES = new Set([
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-import',
  'eslint-plugin-jsx-a11y',
]);
const CONFLICTING_PLUGIN_NAMES = new Set([
  'react',
  'react-hooks',
  'import',
  'jsx-a11y',
]);
const CONFLICTING_CONFIG_REFERENCE =
  /^(?:flat\/react(?:-jsx)?|plugin:(?:react|react-hooks|import|jsx-a11y)\/.+)$/;
const RULE_FROM_NEXT_REGISTERED_PLUGIN = /^(?:react|jsx-a11y|import)\/[\w-]+$/;

let tsModule: typeof import('typescript');

export default async function update(
  tree: Tree
): Promise<MigrationReturnObject> {
  tsModule ??= ensureTypescript();

  const rootConfigWithConflictingPlugin = tree
    .children('')
    .filter((file) => isEslintConfigFile(file) && tree.isFile(file))
    .find((file) =>
      registersConflictingPlugin(parse(tree.read(file, 'utf-8')))
    );

  const nextSteps: string[] = [];
  visitNotIgnoredFiles(tree, '', (path) => {
    if (!isFlatConfig(path)) {
      return;
    }
    const content = tree.read(path, 'utf-8');
    const usage = getEslintConfigNextUsage(content);
    if (!usage.registersNextPlugin && !usage.extendsNextThroughCompat) {
      return;
    }

    const source = parse(content);
    let reason: string;
    if (usage.importsEslintConfigNext) {
      reason = 'it already imports eslint-config-next';
    } else if (registersConflictingPlugin(source)) {
      reason = getConflictingPluginsReason('it');
    } else if (rootConfigWithConflictingPlugin) {
      reason = getConflictingPluginsReason(rootConfigWithConflictingPlugin);
    } else {
      const updated = spreadNextVitals(source);
      if (updated) {
        tree.write(path, updated);
        return;
      }
      reason = 'its Next.js entries differ from the ones Nx generates';
    }
    nextSteps.push(
      getNextStep(path, source, usage.extendsNextThroughCompat, reason)
    );
  });

  await formatFiles(tree);

  return nextSteps.length
    ? { nextSteps, agentContext: nextSteps }
    : { skipAgentic: true };
}

// Returns undefined when the file has Next.js entries Nx did not generate or already uses `nextVitals`.
function spreadNextVitals(source: ts.SourceFile): string | undefined {
  const elements = getExportedArrayElements(source);
  if (!elements || hasIdentifier(source, NEXT_VITALS)) {
    return undefined;
  }
  const bindings = getModuleBindings(source);
  const pluginElements = elements.filter((element) =>
    isGeneratedNextPluginElement(element, bindings)
  );
  const compatElements = elements.filter(isGeneratedCompatElement);
  const compatConfigs = new Set(
    compatElements
      .flatMap((element) => getCompatExtendsCall(element).arguments)
      .map((argument) => (argument as ts.StringLiteralLike).text)
  );
  const matchesGeneratedShape =
    (pluginElements.length === 1 && !compatElements.length) ||
    (!pluginElements.length &&
      compatConfigs.size === GENERATED_COMPAT_CONFIGS.length);
  if (!matchesGeneratedShape) {
    return undefined;
  }

  const content = source.getFullText();
  const matched = new Set<ts.Node>([...pluginElements, ...compatElements]);
  const changes: StringChange[] = [];
  elements.forEach((element, index) => {
    if (!matched.has(element)) {
      return;
    }
    if (!changes.length) {
      changes.push(
        {
          type: ChangeType.Delete,
          start: element.getStart(),
          length: element.end - element.getStart(),
        },
        {
          type: ChangeType.Insert,
          index: element.getStart(),
          text: `...${NEXT_VITALS}`,
        }
      );
    } else {
      const previous = elements[index - 1];
      changes.push({
        type: ChangeType.Delete,
        start: previous.end,
        length: element.end - previous.end,
      });
    }
  });

  let updated = applyChangesToString(content, changes);
  updated = addImportToFlatConfig(updated, NEXT_VITALS, NEXT_VITALS_IMPORT);
  updated = removeUnusedSetup(updated);
  updated = nameExportedArray(updated);

  const usage = getEslintConfigNextUsage(updated);
  return usage.registersNextPlugin || usage.extendsNextThroughCompat
    ? undefined
    : updated;
}

// `{ plugins: { '@next/next': nextEslintPluginNext } }`
function isGeneratedNextPluginElement(
  element: ts.Expression,
  bindings: Map<string, string>
): boolean {
  if (
    !tsModule.isObjectLiteralExpression(element) ||
    element.properties.length !== 1
  ) {
    return false;
  }
  const [plugins] = element.properties;
  if (
    !tsModule.isPropertyAssignment(plugins) ||
    getPropertyName(plugins.name) !== 'plugins' ||
    !tsModule.isObjectLiteralExpression(plugins.initializer) ||
    plugins.initializer.properties.length !== 1
  ) {
    return false;
  }
  const [plugin] = plugins.initializer.properties;
  return (
    tsModule.isPropertyAssignment(plugin) &&
    getPropertyName(plugin.name) === '@next/next' &&
    tsModule.isIdentifier(plugin.initializer) &&
    bindings.get(plugin.initializer.text) === NEXT_PLUGIN_IMPORT
  );
}

// `...compat.extends('next', ...)` or `...fixupConfigRules(compat.extends('next'))`
function isGeneratedCompatElement(element: ts.Expression): boolean {
  if (!tsModule.isSpreadElement(element)) {
    return false;
  }
  const call = getCompatExtendsCall(element);
  return (
    !!call &&
    call.arguments.length > 0 &&
    call.arguments.every(
      (argument) =>
        tsModule.isStringLiteralLike(argument) &&
        GENERATED_COMPAT_CONFIGS.includes(argument.text)
    )
  );
}

function getCompatExtendsCall(
  element: ts.Expression
): ts.CallExpression | undefined {
  if (!tsModule.isSpreadElement(element)) {
    return undefined;
  }
  let expression = element.expression;
  if (
    tsModule.isCallExpression(expression) &&
    tsModule.isIdentifier(expression.expression) &&
    expression.expression.text === 'fixupConfigRules' &&
    expression.arguments.length === 1
  ) {
    expression = expression.arguments[0];
  }
  return tsModule.isCallExpression(expression) &&
    tsModule.isPropertyAccessExpression(expression.expression) &&
    tsModule.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === 'compat' &&
    expression.expression.name.text === 'extends'
    ? expression
    : undefined;
}

function removeUnusedSetup(content: string): string {
  while (true) {
    const source = parse(content);
    const unused = source.statements.filter(
      (statement) =>
        (isCompatDeclaration(statement) &&
          !isReferencedOutside(source, ['compat'], statement)) ||
        getImports(statement).some(
          ({ module, names }) =>
            SETUP_MODULES.has(module) &&
            !isReferencedOutside(source, names, statement)
        )
    );
    if (!unused.length) {
      return content;
    }
    content = applyChangesToString(
      content,
      unused.map((statement) => {
        const start = statement.getStart();
        const end =
          content[statement.end] === '\n' ? statement.end + 1 : statement.end;
        return { type: ChangeType.Delete, start, length: end - start };
      })
    );
  }
}

function isCompatDeclaration(statement: ts.Statement): boolean {
  if (
    !tsModule.isVariableStatement(statement) ||
    statement.declarationList.declarations.length !== 1
  ) {
    return false;
  }
  const [declaration] = statement.declarationList.declarations;
  return (
    tsModule.isIdentifier(declaration.name) &&
    declaration.name.text === 'compat' &&
    !!declaration.initializer &&
    tsModule.isNewExpression(declaration.initializer) &&
    tsModule.isIdentifier(declaration.initializer.expression) &&
    declaration.initializer.expression.text === 'FlatCompat'
  );
}

function getModuleBindings(source: ts.SourceFile): Map<string, string> {
  const bindings = new Map<string, string>();
  for (const statement of source.statements) {
    for (const { module, names } of getImports(statement)) {
      names.forEach((name) => bindings.set(name, module));
    }
  }
  return bindings;
}

function getImports(
  statement: ts.Statement
): { module: string; names: string[] }[] {
  if (tsModule.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (!clause || !tsModule.isStringLiteral(statement.moduleSpecifier)) {
      return [];
    }
    const names = clause.name ? [clause.name.text] : [];
    if (clause.namedBindings) {
      if (tsModule.isNamespaceImport(clause.namedBindings)) {
        names.push(clause.namedBindings.name.text);
      } else {
        names.push(
          ...clause.namedBindings.elements.map((element) => element.name.text)
        );
      }
    }
    return [{ module: statement.moduleSpecifier.text, names }];
  }
  if (
    tsModule.isVariableStatement(statement) &&
    statement.declarationList.declarations.length === 1
  ) {
    const [declaration] = statement.declarationList.declarations;
    const initializer = declaration.initializer;
    if (
      !initializer ||
      !tsModule.isCallExpression(initializer) ||
      !tsModule.isIdentifier(initializer.expression) ||
      initializer.expression.text !== 'require' ||
      initializer.arguments.length !== 1 ||
      !tsModule.isStringLiteral(initializer.arguments[0])
    ) {
      return [];
    }
    const names = tsModule.isIdentifier(declaration.name)
      ? [declaration.name.text]
      : tsModule.isObjectBindingPattern(declaration.name)
        ? declaration.name.elements.flatMap((element) =>
            tsModule.isIdentifier(element.name) ? [element.name.text] : []
          )
        : [];
    return [{ module: initializer.arguments[0].text, names }];
  }
  return [];
}

function isReferencedOutside(
  source: ts.SourceFile,
  names: string[],
  statement: ts.Statement | undefined
): boolean {
  let referenced = false;
  const visit = (node: ts.Node) => {
    if (referenced || node === statement) {
      return;
    }
    if (tsModule.isIdentifier(node) && names.includes(node.text)) {
      referenced = true;
      return;
    }
    tsModule.forEachChild(node, visit);
  };
  visit(source);
  return referenced;
}

function registersConflictingPlugin(source: ts.SourceFile): boolean {
  const bindings = getModuleBindings(source);
  if (
    [...bindings.values()].some((module) =>
      CONFLICTING_PLUGIN_MODULES.has(module)
    )
  ) {
    return true;
  }
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) {
      return;
    }
    if (
      (tsModule.isStringLiteralLike(node) &&
        CONFLICTING_CONFIG_REFERENCE.test(node.text)) ||
      (tsModule.isPropertyAssignment(node) &&
        getPropertyName(node.name) === 'plugins' &&
        tsModule.isObjectLiteralExpression(node.initializer) &&
        node.initializer.properties.some(
          (property) =>
            property.name &&
            CONFLICTING_PLUGIN_NAMES.has(getPropertyName(property.name))
        ))
    ) {
      found = true;
      return;
    }
    tsModule.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function getConflictingPluginsReason(config: string): string {
  return `${config} registers react, react-hooks, import or jsx-a11y, which eslint-config-next also registers. ESLint fails when two configs register different copies of one plugin`;
}

function getNextStep(
  path: string,
  source: ts.SourceFile,
  extendsNextThroughCompat: boolean,
  reason: string
): string {
  const problem = extendsNextThroughCompat
    ? 'extends the "next" configs through FlatCompat, which fails because eslint-config-next 16 only ships flat configs'
    : 'registers the "@next/next" plugin directly instead of through eslint-config-next';
  const rules = findRulesFromNextRegisteredPlugins(source);
  return [
    `${path} ${problem}.`,
    `The migration did not update it because ${reason}.`,
    `Replace the Next.js entries with a spread of the default export of "${NEXT_VITALS_IMPORT}".`,
    ...(rules.length
      ? [
          `Its references to ${rules.join(', ')} keep working after that, because eslint-config-next registers those plugins.`,
        ]
      : []),
  ].join(' ');
}

function findRulesFromNextRegisteredPlugins(source: ts.SourceFile): string[] {
  const rules = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      tsModule.isStringLiteralLike(node) &&
      RULE_FROM_NEXT_REGISTERED_PLUGIN.test(node.text)
    ) {
      rules.add(node.text);
    }
    tsModule.forEachChild(node, visit);
  };
  visit(source);
  return [...rules];
}

function getExportedArrayElements(
  source: ts.SourceFile
): ts.NodeArray<ts.Expression> | undefined {
  for (const statement of source.statements) {
    if (tsModule.isExportAssignment(statement) && !statement.isExportEquals) {
      const exported = tsModule.isIdentifier(statement.expression)
        ? findConstInitializer(source, statement.expression.text)
        : statement.expression;
      if (exported && tsModule.isArrayLiteralExpression(exported)) {
        return exported.elements;
      }
    }
    if (
      tsModule.isExpressionStatement(statement) &&
      tsModule.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind ===
        tsModule.SyntaxKind.EqualsToken &&
      statement.expression.left.getText() === 'module.exports' &&
      tsModule.isArrayLiteralExpression(statement.expression.right)
    ) {
      return statement.expression.right.elements;
    }
  }
  return undefined;
}

// A `let` or `var` is skipped because a later assignment can replace its value.
function findConstInitializer(
  source: ts.SourceFile,
  name: string
): ts.Expression | undefined {
  for (const statement of source.statements) {
    if (
      !tsModule.isVariableStatement(statement) ||
      (statement.declarationList.flags & tsModule.NodeFlags.BlockScoped) !==
        tsModule.NodeFlags.Const
    ) {
      continue;
    }
    const declaration = statement.declarationList.declarations.find(
      (declaration) =>
        tsModule.isIdentifier(declaration.name) &&
        declaration.name.text === name
    );
    if (declaration) {
      return declaration.initializer;
    }
  }
  return undefined;
}

// eslint-config-next turns on `import/no-anonymous-default-export`, which reports `export default [...]`.
function nameExportedArray(content: string): string {
  const source = parse(content);
  const exportDefault = source.statements.find(
    (statement): statement is ts.ExportAssignment =>
      tsModule.isExportAssignment(statement) && !statement.isExportEquals
  );
  if (
    !exportDefault ||
    !tsModule.isArrayLiteralExpression(exportDefault.expression) ||
    hasIdentifier(source, CONFIG_VARIABLE)
  ) {
    return content;
  }
  const start = exportDefault.getStart();
  return applyChangesToString(content, [
    {
      type: ChangeType.Delete,
      start,
      length: exportDefault.expression.getStart() - start,
    },
    {
      type: ChangeType.Insert,
      index: start,
      text: `const ${CONFIG_VARIABLE} = `,
    },
    {
      type: ChangeType.Insert,
      index: exportDefault.end,
      text: `\n\nexport default ${CONFIG_VARIABLE};`,
    },
  ]);
}

function hasIdentifier(source: ts.SourceFile, name: string): boolean {
  return isReferencedOutside(source, [name], undefined);
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  return tsModule.isIdentifier(name) ||
    tsModule.isStringLiteral(name) ||
    tsModule.isNoSubstitutionTemplateLiteral(name)
    ? name.text
    : undefined;
}

function parse(content: string): ts.SourceFile {
  return tsModule.createSourceFile(
    '',
    content,
    tsModule.ScriptTarget.Latest,
    true,
    tsModule.ScriptKind.TS
  );
}
