import {
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  logger,
  parseJson,
  updateJson,
  visitNotIgnoredFiles,
  type ProjectGraph,
  type TargetDependencyConfig,
  type Tree,
} from '@nx/devkit';
import {
  normalizeDependencyConfigDefinition,
  parseNxDirectives,
} from '@nx/devkit/internal';
import { basename } from 'node:path';
import * as ts from 'typescript';
import { useFlatConfig } from '../../../internal';
import {
  determineEslintConfigFormat,
  isEslintConfigFileSupported,
} from '../../generators/utils/eslint-file';
import {
  addBlockToFlatConfigExport,
  findExportDefault,
  findModuleExports,
  generateFlatOverride,
  isEsmExport,
} from '../../generators/utils/flat-config/ast-utils';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
  ESLINT_CONFIG_FILENAMES,
  ESLINT_FLAT_CONFIG_FILENAMES,
  ESLINT_OLD_CONFIG_FILENAMES,
} from '../../utils/config-file';

const RULE = '@nx/directive-checks';
const LINT_CONFIG_FILES = new Set([
  ...ESLINT_CONFIG_FILENAMES,
  ...BASE_ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
]);
// Directives the rule checks; a lone `@nx-target-name` doesn't trigger it.
const TRIGGER_DIRECTIVES = ['depends-on', 'ignore-server-inputs'];

export default async function update(tree: Tree) {
  const flatConfig = useFlatConfig(tree) && !hasOnlyEslintrcBaseConfig(tree);
  const sharedConfig = findSharedConfig(tree, flatConfig);
  if (!sharedConfig || !isEslintConfigFileSupported(sharedConfig)) {
    return;
  }

  let usesNxEslintPlugin = false;
  let ruleConfigured = false;
  visitNotIgnoredFiles(tree, '', (path) => {
    if (!LINT_CONFIG_FILES.has(basename(path))) {
      return;
    }
    const content = tree.read(path, 'utf-8');
    usesNxEslintPlugin ||= /@nx[/"']/.test(content);
    ruleConfigured ||= content.includes(RULE);
  });
  if (!usesNxEslintPlugin || ruleConfigured) {
    return;
  }

  if (!(await hasDirectiveFiles(tree))) {
    return;
  }

  // ESLint fails on an `@nx/` rule for a file the plugin isn't registered for,
  // so only the shapes Nx generates count as registering it for every file.
  const registersNxPlugin = flatConfig
    ? flatConfigRegistersNxPlugin(tree, sharedConfig)
    : eslintrcRegistersNxPlugin(tree, sharedConfig);
  if (!registersNxPlugin) {
    logger.warn(
      `Could not verify that \`${sharedConfig}\` registers the \`@nx\` ESLint plugin for the files \`${RULE}\` checks, so the rule was not added. Your files use \`@nx-depends-on\` or \`@nx-ignore-server-inputs\`, so add the rule to an ESLint config that registers \`@nx\` for those files.`
    );
    return;
  }

  // Without `files`, the rule covers every file the config already lints, and
  // ESLint selects no new files it may lack a parser for.
  if (flatConfig) {
    const content = tree.read(sharedConfig, 'utf-8');
    tree.write(
      sharedConfig,
      addBlockToFlatConfigExport(
        content,
        generateFlatOverride(
          { rules: { [RULE]: 'error' } },
          determineEslintConfigFormat(content)
        )
      )
    );
  } else {
    updateJson(tree, sharedConfig, (json) => {
      json.rules = { ...json.rules, [RULE]: 'error' };
      return json;
    });
  }

  await formatFiles(tree);
}

/**
 * The root config that project configs extend: the root base config when there
 * is one, since the root config then belongs to the root project. Unlike
 * `findEslintFile`, it only looks at files in the format ESLint loads.
 */
function findSharedConfig(tree: Tree, flatConfig: boolean): string | undefined {
  const candidates = flatConfig
    ? [...BASE_ESLINT_CONFIG_FILENAMES, ...ESLINT_FLAT_CONFIG_FILENAMES]
    : [baseEsLintConfigFile, ...ESLINT_OLD_CONFIG_FILENAMES];
  return candidates.find((file) => tree.exists(file));
}

// `useFlatConfig` ignores `.eslintrc.base.json`, so it reads a workspace whose
// only root config is that file as flat config.
function hasOnlyEslintrcBaseConfig(tree: Tree): boolean {
  return (
    process.env.ESLINT_USE_FLAT_CONFIG !== 'true' &&
    tree.exists(baseEsLintConfigFile) &&
    ![...BASE_ESLINT_CONFIG_FILENAMES, ...ESLINT_FLAT_CONFIG_FILENAMES].some(
      (file) => tree.exists(file)
    )
  );
}

// Top-level `plugins` apply to every file; `overrides` don't.
function eslintrcRegistersNxPlugin(tree: Tree, config: string): boolean {
  const { plugins } = parseJson(tree.read(config, 'utf-8'));
  return (
    Array.isArray(plugins) &&
    plugins.some((plugin) => plugin === '@nx' || plugin === '@nx/eslint-plugin')
  );
}

// Only a `...nx.configs['flat/base']` element directly in the exported array
// applies to every file.
function flatConfigRegistersNxPlugin(tree: Tree, config: string): boolean {
  const source = ts.createSourceFile(
    config,
    tree.read(config, 'utf-8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const elements = isEsmExport(source)
    ? findExportDefault(source)
    : findModuleExports(source);
  const modules = defaultImports(source);
  return (elements ?? []).some((element) => {
    if (!ts.isSpreadElement(element)) {
      return false;
    }
    const spread = element.expression;
    return (
      ts.isElementAccessExpression(spread) &&
      ts.isStringLiteral(spread.argumentExpression) &&
      spread.argumentExpression.text === 'flat/base' &&
      ts.isPropertyAccessExpression(spread.expression) &&
      spread.expression.name.text === 'configs' &&
      ts.isIdentifier(spread.expression.expression) &&
      modules.get(spread.expression.expression.text) === '@nx/eslint-plugin'
    );
  });
}

/** Module of each `import x from 'm'` and top-level `const x = require('m')`. */
function defaultImports(source: ts.SourceFile): Map<string, string> {
  const modules = new Map<string, string>();
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause?.name &&
      !statement.importClause.isTypeOnly &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      modules.set(
        statement.importClause.name.text,
        statement.moduleSpecifier.text
      );
    } else if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.flags & ts.NodeFlags.Const
    ) {
      for (const { name, initializer } of statement.declarationList
        .declarations) {
        if (
          ts.isIdentifier(name) &&
          initializer &&
          ts.isCallExpression(initializer) &&
          ts.isIdentifier(initializer.expression) &&
          initializer.expression.text === 'require' &&
          initializer.arguments.length === 1 &&
          ts.isStringLiteral(initializer.arguments[0])
        ) {
          modules.set(name.text, initializer.arguments[0].text);
        }
      }
    }
  }
  return modules;
}

// Atomized e2e targets are named `<ciTargetName>--<file path in the project>`,
// so the graph narrows the search to the files that can carry the directives.
// Both parts can contain `--`, so the `<ciTargetName>` target's `dependsOn`,
// which lists its atomized targets, marks where the file path starts.
async function hasDirectiveFiles(tree: Tree): Promise<boolean> {
  let graph: ProjectGraph;
  try {
    graph = await createProjectGraphAsync();
  } catch (e) {
    logger.warn(
      `Could not create the project graph to look for Nx directives, so \`${RULE}\` was not added. Add it to your ESLint config if your files use \`@nx-depends-on\` or \`@nx-ignore-server-inputs\`.\n${e.message}`
    );
    return false;
  }

  for (const node of Object.values(graph.nodes)) {
    const targets = node.data.targets ?? {};
    const targetNames = Object.keys(targets);
    for (const [ciTargetName, ciTarget] of Object.entries(targets)) {
      const atomizedTargetNames = (ciTarget.dependsOn ?? [])
        .flatMap((dependency) =>
          projectTargetNames(dependency, node.name, graph, targetNames)
        )
        .filter(
          (name) =>
            name.startsWith(`${ciTargetName}--`) && Object.hasOwn(targets, name)
        );
      for (const targetName of atomizedTargetNames) {
        const file = joinPathFragments(
          node.data.root,
          targetName.slice(ciTargetName.length + 2)
        );
        if (!tree.exists(file) || !tree.isFile(file)) {
          continue;
        }
        const directives = parseNxDirectives(tree.read(file, 'utf-8'));
        if (TRIGGER_DIRECTIVES.some((name) => directives.has(name))) {
          return true;
        }
      }
    }
  }
  return false;
}

// The targets of `project` that a `dependsOn` entry selects, resolved the way
// the task graph resolves them.
function projectTargetNames(
  dependency: string | TargetDependencyConfig,
  project: string,
  graph: ProjectGraph,
  targetNames: string[]
): string[] {
  try {
    return (
      normalizeDependencyConfigDefinition(
        // The normalizer writes `projects` onto the object it gets.
        typeof dependency === 'string' ? dependency : { ...dependency },
        project,
        graph,
        targetNames
      )
        // A `^` entry leaves `projects` unset.
        .filter((config) => config.projects?.includes(project))
        .map((config) => config.target)
    );
  } catch {
    // The task graph rejects the entry too, e.g. a legacy `projects: 'self'`.
    return [];
  }
}
