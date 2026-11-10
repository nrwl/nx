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
  isFlatConfig,
} from '@nx/eslint/internal';
import { ensureTypescript } from '@nx/js/internal';
import type * as ts from 'typescript';
import {
  findConfigWithConflictingPlugin,
  findRootConfigWithConflictingPlugin,
  getEslintMajorVersion,
} from '../../utils/eslint-config-next-conflicts';
import {
  getImports,
  getModuleBindings,
  getPropertyName,
  parseFlatConfig,
} from '../../utils/flat-config-source';

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
const RULE_FROM_NEXT_REGISTERED_PLUGIN = /^(?:react|jsx-a11y|import)\/[\w-]+$/;

let tsModule: typeof import('typescript');

export default async function update(
  tree: Tree
): Promise<MigrationReturnObject> {
  tsModule ??= ensureTypescript();

  const eslintMajor = getEslintMajorVersion(tree);
  const rootConfigWithConflictingPlugin = findRootConfigWithConflictingPlugin(
    tree,
    eslintMajor
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

    const source = parseFlatConfig(content);
    let reason: string;
    let suggestNextPluginConfig = false;
    if (usage.importsEslintConfigNext) {
      reason = 'it already imports eslint-config-next';
    } else {
      const configWithConflictingPlugin = findConfigWithConflictingPlugin(
        tree,
        path,
        eslintMajor
      );
      const conflictingConfig =
        configWithConflictingPlugin === path
          ? 'it'
          : (configWithConflictingPlugin ?? rootConfigWithConflictingPlugin);
      if (conflictingConfig) {
        const updated = addNextPluginConfig(source);
        if (updated) {
          tree.write(path, updated);
          nextSteps.push(getNextPluginConfigNote(path, conflictingConfig));
          return;
        }
        reason = getConflictingPluginsReason(conflictingConfig);
        suggestNextPluginConfig = true;
      } else {
        const updated = spreadNextVitals(source);
        if (updated) {
          tree.write(path, updated);
          return;
        }
        reason = 'its Next.js entries differ from the ones Nx generates';
      }
    }
    nextSteps.push(
      getNextStep(
        path,
        source,
        usage.extendsNextThroughCompat,
        reason,
        suggestNextPluginConfig
      )
    );
  });

  await formatFiles(tree);

  return nextSteps.length
    ? { nextSteps, agentContext: nextSteps }
    : { skipAgentic: true };
}

interface GeneratedNextEntries {
  elements: ts.NodeArray<ts.Expression>;
  generated: Set<ts.Expression>;
  // The local name of the `@next/eslint-plugin-next` import when the generated entry registers `@next/next`.
  pluginBinding: string | undefined;
}

function findGeneratedNextEntries(
  source: ts.SourceFile
): GeneratedNextEntries | undefined {
  const elements = getExportedArrayElements(source);
  if (!elements) {
    return undefined;
  }
  const bindings = getModuleBindings(source);
  const pluginElements = elements.filter(
    (element) => getGeneratedNextPluginBinding(element, bindings) !== undefined
  );
  const compatElements = elements.filter(isGeneratedCompatElement);
  if (pluginElements.length === 1 && !compatElements.length) {
    return {
      elements,
      generated: new Set(pluginElements),
      pluginBinding: getGeneratedNextPluginBinding(pluginElements[0], bindings),
    };
  }
  const compatConfigs = new Set(
    compatElements
      .flatMap((element) => getCompatExtendsCall(element).arguments)
      .map((argument) => (argument as ts.StringLiteralLike).text)
  );
  if (
    !pluginElements.length &&
    compatConfigs.size === GENERATED_COMPAT_CONFIGS.length
  ) {
    return {
      elements,
      generated: new Set(compatElements),
      pluginBinding: undefined,
    };
  }
  return undefined;
}

// Puts `text` in place of the first generated entry and removes the others.
function replaceGeneratedNextEntries(
  source: ts.SourceFile,
  { elements, generated }: GeneratedNextEntries,
  text: string
): string {
  const changes: StringChange[] = [];
  elements.forEach((element, index) => {
    if (!generated.has(element)) {
      return;
    }
    if (!changes.length) {
      changes.push(
        {
          type: ChangeType.Delete,
          start: element.getStart(),
          length: element.end - element.getStart(),
        },
        { type: ChangeType.Insert, index: element.getStart(), text }
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
  return applyChangesToString(source.getFullText(), changes);
}

// Returns undefined when the file has Next.js entries Nx did not generate or already uses `nextVitals`.
function spreadNextVitals(source: ts.SourceFile): string | undefined {
  const entries = findGeneratedNextEntries(source);
  if (!entries || hasIdentifier(source, NEXT_VITALS)) {
    return undefined;
  }
  let updated = replaceGeneratedNextEntries(
    source,
    entries,
    `...${NEXT_VITALS}`
  );
  updated = addImportToFlatConfig(updated, NEXT_VITALS, NEXT_VITALS_IMPORT);
  updated = removeUnusedSetup(updated);
  updated = nameExportedArray(updated);
  return hasNextEntries(updated) ? undefined : updated;
}

// Replaces only the `@next/next` registration. The FlatCompat `next` configs also
// registered react, import and jsx-a11y, whose rules the file may set.
function addNextPluginConfig(source: ts.SourceFile): string | undefined {
  const entries = findGeneratedNextEntries(source);
  if (!entries?.pluginBinding) {
    return undefined;
  }
  const updated = replaceGeneratedNextEntries(
    source,
    entries,
    `${entries.pluginBinding}.configs['core-web-vitals']`
  );
  return hasNextEntries(updated) ? undefined : updated;
}

function hasNextEntries(content: string): boolean {
  const usage = getEslintConfigNextUsage(content);
  return usage.registersNextPlugin || usage.extendsNextThroughCompat;
}

// `{ plugins: { '@next/next': nextEslintPluginNext } }`
function getGeneratedNextPluginBinding(
  element: ts.Expression,
  bindings: Map<string, string>
): string | undefined {
  if (
    !tsModule.isObjectLiteralExpression(element) ||
    element.properties.length !== 1
  ) {
    return undefined;
  }
  const [plugins] = element.properties;
  if (
    !tsModule.isPropertyAssignment(plugins) ||
    getPropertyName(plugins.name) !== 'plugins' ||
    !tsModule.isObjectLiteralExpression(plugins.initializer) ||
    plugins.initializer.properties.length !== 1
  ) {
    return undefined;
  }
  const [plugin] = plugins.initializer.properties;
  return tsModule.isPropertyAssignment(plugin) &&
    getPropertyName(plugin.name) === '@next/next' &&
    tsModule.isIdentifier(plugin.initializer) &&
    bindings.get(plugin.initializer.text) === NEXT_PLUGIN_IMPORT
    ? plugin.initializer.text
    : undefined;
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
    const source = parseFlatConfig(content);
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

function getConflictingPluginsReason(config: string): string {
  return `${config} registers react, react-hooks, import or jsx-a11y, which eslint-config-next also registers. ESLint fails when two configs register different copies of one plugin`;
}

function getNextPluginConfigNote(
  path: string,
  conflictingConfig: string
): string {
  return [
    `${path} now uses the "core-web-vitals" config of "${NEXT_PLUGIN_IMPORT}" instead of eslint-config-next, because ${getConflictingPluginsReason(conflictingConfig)}.`,
    `The two may be the same copy, which ESLint accepts. To check, spread eslint-config-next/core-web-vitals in place of the "core-web-vitals" config in ${path} and run lint. Keep the spread if lint reports no "Cannot redefine plugin" error.`,
    `Otherwise, files that ${conflictingConfig} does not lint with those plugins get no React, React Hooks, jsx-a11y or import rules.`,
    `Rules and eslint-disable comments that name a react/, jsx-a11y/ or import/ rule, in ${path} or in the files it lints, make lint fail unless another config registers that plugin. Delete or rewrite them.`,
  ].join(' ');
}

function getNextStep(
  path: string,
  source: ts.SourceFile,
  extendsNextThroughCompat: boolean,
  reason: string,
  suggestNextPluginConfig: boolean
): string {
  const problem = extendsNextThroughCompat
    ? 'extends the "next" configs through FlatCompat, which fails because eslint-config-next 16 only ships flat configs'
    : 'registers the "@next/next" plugin directly instead of through eslint-config-next';
  const rules = findRulesFromNextRegisteredPlugins(source);
  const fix = suggestNextPluginConfig
    ? [
        `Replace the Next.js entries with the "core-web-vitals" config of "${NEXT_PLUGIN_IMPORT}", which registers only the Next.js plugin.`,
        ...(rules.length
          ? [
              `Its references to ${rules.join(', ')} then need another config to register those plugins.`,
            ]
          : []),
      ]
    : [
        `Replace the Next.js entries with a spread of the default export of "${NEXT_VITALS_IMPORT}".`,
        ...(rules.length
          ? [
              `Its references to ${rules.join(', ')} keep working after that, because eslint-config-next registers those plugins.`,
            ]
          : []),
      ];
  return [
    `${path} ${problem}.`,
    `The migration did not update it because ${reason}.`,
    ...fix,
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
  const source = parseFlatConfig(content);
  const exportDefault = source.statements.find(
    (statement): statement is ts.ExportAssignment =>
      tsModule.isExportAssignment(statement) && !statement.isExportEquals
  );
  if (
    !exportDefault ||
    !tsModule.isArrayLiteralExpression(exportDefault.expression)
  ) {
    return content;
  }
  let name = CONFIG_VARIABLE;
  for (let suffix = 2; hasIdentifier(source, name); suffix++) {
    name = `${CONFIG_VARIABLE}${suffix}`;
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
      text: `const ${name} = `,
    },
    {
      type: ChangeType.Insert,
      index: exportDefault.end,
      text: `\n\nexport default ${name};`,
    },
  ]);
}

function hasIdentifier(source: ts.SourceFile, name: string): boolean {
  return isReferencedOutside(source, [name], undefined);
}
