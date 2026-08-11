import {
  addDependenciesToPackageJson,
  formatFiles,
  getDependencyVersionFromPackageJson,
  getProjects,
  joinPathFragments,
  readJson,
  removeDependenciesFromPackageJson,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { basename } from 'node:path/posix';
import { readModulePackageJson } from '@nx/devkit/internal';
import { coerce, gt, satisfies, subset, validRange, type SemVer } from 'semver';
import * as ts from 'typescript';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  ESLINT_FLAT_CONFIG_FILENAMES,
  ESLINT_OLD_CONFIG_FILENAMES,
} from '../../utils/config-file';
import { convertToFlatConfigGenerator } from '../../generators/convert-to-flat-config/generator';
import {
  JS_ESLINTRC_FILENAMES,
  readStaticJsEslintrcFromTree,
} from '../../generators/convert-to-flat-config/converters/static-js-config';
import { findEslintFile } from '../../generators/utils/eslint-file';

// ESLint plugins with no v10 release. `eslint-plugin-import` has a maintained
// fork (`eslint-plugin-import-x`); the other two have no substitute, so they are
// dropped. Frozen copy of the ESLint <10 React stack `@nx/react` installs
// (`packages/react/src/utils/lint.ts`, `eslintLegacyDependencies`): `@nx/eslint`
// cannot import it, since `@nx/react` is the package that depends on `@nx/eslint`.
export const V9_ONLY_PLUGINS = [
  'eslint-plugin-import',
  'eslint-plugin-jsx-a11y',
  'eslint-plugin-react',
] as const;

// Versions `@nx/react` installs for the ESLint v10 stack
// (`packages/react/src/utils/versions.ts`).
export const ESLINT_PLUGIN_IMPORT_X_VERSION = '4.16.2';
export const ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION = '7.1.1';

// eslint@10's `engines.node`.
const ESLINT_V10_NODE_RANGE = '^20.19.0 || ^22.13.0 || >=24';

const ESLINT_CONFIG_FILENAMES = new Set([
  ...ESLINT_OLD_CONFIG_FILENAMES,
  ...ESLINT_FLAT_CONFIG_FILENAMES,
  ...BASE_ESLINT_CONFIG_FILENAMES,
]);

const SOURCE_FILE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.cjs',
  '.mjs',
  '.ts',
  '.tsx',
  '.cts',
  '.mts',
];

type RootConfigState =
  | { kind: 'flat' | 'convertible' | 'none' }
  | { kind: 'unconvertible'; file: string; reason: string };

/**
 * Hybrid migration paired with `finish-eslint-v10-migration.md`. The
 * deterministic half converts the workspace's eslintrc configs to flat config
 * (ESLint v10 removed the eslintrc format outright) and replaces the ESLint
 * plugins that have no v10 release. Everything it cannot do safely, such
 * as an eslintrc config whose values are computed at runtime or a config that
 * configures a dropped plugin's rules, is returned as `agentContext` for the
 * paired prompt.
 *
 * The pass never runs lint, so it cannot tell whether the workspace is done. It
 * always hands off to the prompt, which validates.
 */
export default async function update(tree: Tree): Promise<{
  nextSteps?: string[];
  agentContext?: string[];
}> {
  const agentContext: string[] = [];
  const nextSteps: string[] = [];

  await convertRemainingEslintrcConfigs(tree, agentContext, nextSteps);
  const removedPlugins = replaceV9OnlyPlugins(tree, agentContext, nextSteps);
  reportRemainingFileReferences(tree, removedPlugins, agentContext, nextSteps);
  reportPluginsWithoutV10Support(tree, agentContext, nextSteps);
  reportNodeVersionRequirement(tree, nextSteps);

  await formatFiles(tree);

  return { nextSteps, agentContext };
}

async function convertRemainingEslintrcConfigs(
  tree: Tree,
  agentContext: string[],
  nextSteps: string[]
): Promise<void> {
  // The generator deletes the files it converts, so capture the ones it will
  // skip before running it.
  const unconvertibleProjectConfigs = findUnconvertibleProjectConfigs(tree);
  const rootState = detectRootConfigState(tree);

  if (rootState.kind === 'convertible') {
    const hadEslintJs =
      getDependencyVersionFromPackageJson(tree, '@eslint/js') !== null;
    let converted = false;
    try {
      await convertToFlatConfigGenerator(tree, {
        keepExistingVersions: true,
        skipFormat: true,
      });
      converted = true;
    } catch (e) {
      // A config the converter cannot read (malformed JSON, an unresolvable
      // reference) must not abort the whole migration and take the plugin
      // replacement down with it. The conversion is not atomic, so what it had
      // already rewritten when it threw is kept and has to be reported as such.
      agentContext.push(
        `Converting the workspace to flat config failed partway with: ${
          e instanceof Error ? e.message : e
        }. The workspace can be left half-converted: check which configs were rewritten, convert the eslintrc files that are still there by hand, ` +
          'delete every .eslintignore, and update any nx.json or project.json input that still points at an eslintrc file.'
      );
      nextSteps.push(
        'Converting the ESLint configs to flat config failed partway, so the workspace may be half-converted; the eslintrc files that are still there need to be converted manually.'
      );
    }
    if (converted) {
      reportNewEslintJsRecommendedRules(
        tree,
        hadEslintJs,
        agentContext,
        nextSteps
      );
    }
  }

  if (
    rootState.kind === 'unconvertible' &&
    !unconvertibleProjectConfigs.some(({ path }) => path === rootState.file)
  ) {
    // A standalone workspace has a project rooted at `.`, so the root config is
    // already in the list the project scan produced.
    unconvertibleProjectConfigs.unshift({
      path: rootState.file,
      reason: rootState.reason,
    });
  }

  if (unconvertibleProjectConfigs.length > 0) {
    const details = unconvertibleProjectConfigs
      .map(({ path, reason }) => `${path} (${reason})`)
      .join('; ');
    agentContext.push(
      `These JavaScript-based ESLint configs could not be converted automatically: ${details}. ` +
        'Convert each one to a flat config (eslint.config.mjs) by hand, preserving its rules, plugins, parser options and overrides, ' +
        'then delete the original file and update any nx.json or project.json input that referenced it.'
    );
    nextSteps.push(
      `Convert these JavaScript-based ESLint configs to flat config manually: ${unconvertibleProjectConfigs
        .map(({ path }) => path)
        .join(', ')}.`
    );
  }

  // ESLint v10 ignores eslintrc files entirely, so any left behind stops being
  // applied without an error. Report them wherever they came from.
  const remaining = findRemainingEslintrcConfigs(
    tree,
    new Set(unconvertibleProjectConfigs.map(({ path }) => path))
  );
  if (remaining.length === 0) {
    return;
  }

  const list = remaining.join(', ');
  // A flat config at the root already won over every eslintrc below it on
  // ESLint v9, so those files were dead before this migration ran. Folding them
  // in turns their rules back on, which is a different decision from restoring
  // enforcement this run just dropped.
  if (rootState.kind === 'flat') {
    agentContext.push(
      `These eslintrc files are still in the workspace: ${list}. The workspace already had a flat config at its root, so ESLint resolved that one instead and the rules these files hold have not been applied for a while. ` +
        'Fold each one into the flat config that covers the same files, then delete it, and expect new lint errors from rules that were effectively off.'
    );
    nextSteps.push(
      `The root flat config was already shadowing these eslintrc files; fold them into flat config and delete them: ${list}. The rules they hold are not in effect today, so folding them in can surface new lint errors.`
    );
    return;
  }

  agentContext.push(
    `These eslintrc files are still in the workspace: ${list}. ESLint v10 removed the eslintrc format, so it no longer reads them and the rules they hold are silently not applied. ` +
      'Fold each one into the flat config that covers the same files, then delete it.'
  );
  nextSteps.push(
    `ESLint v10 no longer reads eslintrc files; fold these into flat config and delete them: ${list}.`
  );
}

// The flat-config conversion pulls `eslint:recommended` from `@eslint/js`, whose
// v10 recommended set is wider than the one ESLint v9 applied. The converter
// keeps the workspace on its installed ESLint major, so check what it landed on
// rather than assuming v10.
function reportNewEslintJsRecommendedRules(
  tree: Tree,
  hadEslintJs: boolean,
  agentContext: string[],
  nextSteps: string[]
): void {
  const added = getDependencyVersionFromPackageJson(tree, '@eslint/js');
  if (hadEslintJs || (coerce(added)?.major ?? 0) < 10) {
    return;
  }

  nextSteps.push(
    'The conversion added @eslint/js, which now supplies the recommended set the eslintrc config took from "eslint:recommended". Its ESLint v10 release enables three rules the v9 one did not: no-unassigned-vars, no-useless-assignment and preserve-caught-error.'
  );
  agentContext.push(
    'The conversion added @eslint/js to package.json to replace an "eslint:recommended" extends. Its recommended set enables no-unassigned-vars, no-useless-assignment and preserve-caught-error, which the workspace was not running before, so expect those three to account for newly reported errors when lint runs.'
  );
}

function detectRootConfigState(tree: Tree): RootConfigState {
  const hasFlatConfig = [
    ...ESLINT_FLAT_CONFIG_FILENAMES,
    ...BASE_ESLINT_CONFIG_FILENAMES,
  ].some((file) => tree.exists(file));
  if (hasFlatConfig) {
    return { kind: 'flat' };
  }

  // Past the flat check this can only be an eslintrc file, and which one decides
  // the state has to be the one the generator picks: it reads that file and no
  // other, so asking about a different one reports a config the generator would
  // never have opened and skips a conversion that would have gone through.
  const file = findEslintFile(tree);
  if (file === null) {
    return { kind: 'none' };
  }
  if (JS_ESLINTRC_FILENAMES.includes(file)) {
    const result = readStaticJsEslintrcFromTree(tree, '', file);
    return result.kind === 'config'
      ? { kind: 'convertible' }
      : { kind: 'unconvertible', file, reason: result.reason };
  }

  return { kind: 'convertible' };
}

function findUnconvertibleProjectConfigs(
  tree: Tree
): Array<{ path: string; reason: string }> {
  const configs: Array<{ path: string; reason: string }> = [];
  for (const [, projectConfig] of getProjects(tree)) {
    for (const filename of JS_ESLINTRC_FILENAMES) {
      const path = joinPathFragments(projectConfig.root, filename);
      if (!tree.exists(path)) {
        continue;
      }
      const result = readStaticJsEslintrcFromTree(
        tree,
        projectConfig.root,
        filename
      );
      if (result.kind === 'unsupported') {
        configs.push({ path, reason: result.reason });
      }
    }
  }
  return configs;
}

function findRemainingEslintrcConfigs(
  tree: Tree,
  alreadyReported: Set<string>
): string[] {
  const remaining: string[] = [];
  visitNotIgnoredFiles(tree, '', (path) => {
    const filename = basename(path);
    if (
      (ESLINT_OLD_CONFIG_FILENAMES.includes(filename) ||
        filename === '.eslintrc.base.json') &&
      !alreadyReported.has(path)
    ) {
      remaining.push(path);
    }
  });
  return remaining;
}

// Returns the plugins it removed, so the file scan knows which references are
// now dangling.
function replaceV9OnlyPlugins(
  tree: Tree,
  agentContext: string[],
  nextSteps: string[]
): string[] {
  const declared = V9_ONLY_PLUGINS.filter(
    (plugin) => getDependencyVersionFromPackageJson(tree, plugin) !== null
  );
  const reactHooksSpecifier = getDependencyVersionFromPackageJson(
    tree,
    'eslint-plugin-react-hooks'
  );
  // Only a plain semver range names a version to compare against. A protocol
  // specifier (`workspace:*`, `npm:...`) or a dist tag does not, and rewriting
  // one would swap the resolution the workspace chose for a literal version.
  const reactHooksMajor =
    reactHooksSpecifier && validRange(reactHooksSpecifier)
      ? (coerce(reactHooksSpecifier)?.major ?? null)
      : null;
  const reactHooksV7Major = Number(
    ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION.split('.')[0]
  );
  if (reactHooksSpecifier !== null && reactHooksMajor === null) {
    agentContext.push(
      `eslint-plugin-react-hooks is declared as "${reactHooksSpecifier}", which names no version to compare, so it was left as it is. Its ESLint v10 support starts at v${reactHooksV7Major}: resolve what that specifier points at and update it at its source if it is below that.`
    );
    nextSteps.push(
      `eslint-plugin-react-hooks is declared as "${reactHooksSpecifier}" and was not updated. Check that it resolves to v${reactHooksV7Major} or later, where its ESLint v10 support starts.`
    );
  }
  const needsReactHooksBump =
    reactHooksMajor !== null && reactHooksMajor < reactHooksV7Major;

  if (declared.length === 0 && !needsReactHooksBump) {
    return [];
  }

  if (declared.length > 0) {
    removeDependenciesFromPackageJson(tree, [...declared], [...declared]);
  }

  const devDependencies: Record<string, string> = {};
  if (
    declared.includes('eslint-plugin-import') &&
    getDependencyVersionFromPackageJson(tree, 'eslint-plugin-import-x') === null
  ) {
    devDependencies['eslint-plugin-import-x'] = ESLINT_PLUGIN_IMPORT_X_VERSION;
  }
  if (needsReactHooksBump) {
    devDependencies['eslint-plugin-react-hooks'] =
      ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION;
  }
  if (Object.keys(devDependencies).length > 0) {
    addDependenciesToPackageJson(tree, {}, devDependencies);
  }

  const changes: string[] = [];
  if (declared.length > 0) {
    changes.push(
      `removed ${declared.join(', ')} (no ESLint v10 release)${
        devDependencies['eslint-plugin-import-x']
          ? ' and installed eslint-plugin-import-x in place of eslint-plugin-import'
          : ''
      }`
    );
  }
  if (needsReactHooksBump) {
    changes.push(
      `updated eslint-plugin-react-hooks to ${ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION}, whose "recommended" preset also enables the React Compiler rules`
    );
    agentContext.push(
      `eslint-plugin-react-hooks moved to ${ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION}, and its "recommended" preset grew from 2 rules to 16: it adds the React Compiler set, 12 of them at error severity. A config that pulls that preset directly reports errors it never reported before. ` +
        "@nx/eslint-plugin's flat/react, flat/react-base and flat/react-jsx presets pin rules-of-hooks and exhaustive-deps on ESLint v10, so a config that reaches the rules through one of them is unaffected. " +
        'The new errors come from a changed preset default rather than from the user, so turn a rule off in the flat config with a short comment rather than editing source, and never weaken rules-of-hooks or exhaustive-deps.'
    );
  }
  nextSteps.push(
    `Updated the ESLint plugins for v10: ${changes.join(
      ', '
    )}. Re-run lint to confirm the rule set still matches your expectations.`
  );

  return [...declared];
}

// What the dependency changes left behind in the workspace's own files, plus the
// one source-level break ESLint v10 introduces on its own.
function reportRemainingFileReferences(
  tree: Tree,
  removedPlugins: string[],
  agentContext: string[],
  nextSteps: string[]
): void {
  const { references, directives, eslintEnv } = findRemovedPluginUsages(
    tree,
    removedPlugins
  );
  if (references.length > 0) {
    agentContext.push(
      `These files reference plugins that were removed because they have no ESLint v10 release: ${formatUsages(
        references
      )}. Any ESLint config that reaches one of them fails to load as it is. ` +
        'Rewrite each eslint-plugin-import usage to eslint-plugin-import-x (the plugin key and its rule prefix both become "import-x"), ' +
        'and delete the eslint-plugin-react and eslint-plugin-jsx-a11y plugin registrations along with the rules that use their prefixes. ' +
        'Those two have no ESLint v10 substitute, so their rules cannot be preserved.'
    );
    nextSteps.push(
      `These files still reference the removed plugins and must be updated before ESLint can load the config: ${references
        .map(({ path }) => path)
        .join(', ')}.`
    );
  }
  if (directives.length > 0) {
    agentContext.push(
      `These source files carry ESLint directive comments naming rules the workspace can no longer resolve: ${formatUsages(
        directives
      )}. A directive for an unknown rule is itself a lint error, so lint fails until each one is handled. ` +
        'Rewrite an "import/" prefix to "import-x/", and delete the directives naming a "react/" or "jsx-a11y/" rule along with any inline configuration of them.'
    );
    nextSteps.push(
      `These source files disable or configure rules from the removed plugins, which now fails lint: ${directives
        .map(({ path }) => path)
        .join(', ')}.`
    );
  }
  if (eslintEnv.length > 0) {
    agentContext.push(
      `These source files carry /* eslint-env */ comments: ${eslintEnv.join(
        ', '
      )}. ESLint v9 only warned that flat config ignores them; v10 reports each one as an error ("/* eslint-env */ comments are no longer supported"), so lint fails while they are there. ` +
        "Replace each with an equivalent /* global */ comment, or move the globals it declared into the covering flat config's languageOptions.globals, then delete the comment. " +
        'Deleting one without replacing what it declared turns its globals into no-undef errors.'
    );
    nextSteps.push(
      `ESLint v10 reports /* eslint-env */ comments as errors; replace them with /* global */ comments or languageOptions.globals in: ${eslintEnv.join(
        ', '
      )}.`
    );
  }
}

type PluginUsage = { path: string; matched: string[] };

function formatUsages(usages: PluginUsage[]): string {
  return usages
    .map(({ path, matched }) => `${path} (${matched.join(', ')})`)
    .join('; ');
}

// One walk for everything ESLint v10 can no longer resolve, including the
// /* eslint-env */ comments it turned from a warning into an error.
function findRemovedPluginUsages(
  tree: Tree,
  plugins: readonly string[]
): {
  references: PluginUsage[];
  directives: PluginUsage[];
  eslintEnv: string[];
} {
  const references: PluginUsage[] = [];
  const directives: PluginUsage[] = [];
  const eslintEnv: string[] = [];

  const matchers = plugins.map((plugin) => {
    // A rule id drops the `eslint-plugin-` prefix, so `eslint-plugin-jsx-a11y`
    // owns the `jsx-a11y/` rules.
    const prefix = plugin.replace('eslint-plugin-', '');
    return {
      plugin,
      prefix,
      // `eslint-plugin-import` must not match `eslint-plugin-import-x`.
      packageName: new RegExp(`${escapeRegExp(plugin)}(?![\\w-])`),
      // Anchored, so a relative import of a local file that happens to be named
      // after the plugin is not read as the package. Subpaths still match.
      moduleSpecifier: new RegExp(`^${escapeRegExp(plugin)}(?![\\w-])`),
      ruleId: new RegExp(`['"\`]${escapeRegExp(prefix)}/`),
    };
  });

  visitNotIgnoredFiles(tree, '', (path) => {
    const isConfig = ESLINT_CONFIG_FILENAMES.has(basename(path));
    if (
      !isConfig &&
      !SOURCE_FILE_EXTENSIONS.some((ext) => path.endsWith(ext))
    ) {
      return;
    }
    const content = tree.read(path, 'utf-8');
    if (!content) {
      return;
    }

    if (isConfig) {
      // A config is hand-written and small, so naming the package anywhere in it
      // is a registration. A quoted rule id is only conclusive here: in source,
      // `'react/jsx-runtime'` is an import path that reads exactly like one.
      const matchedPlugins = matchers
        .filter(
          ({ packageName, ruleId }) =>
            packageName.test(content) || ruleId.test(content)
        )
        .map(({ plugin }) => plugin);
      if (matchedPlugins.length > 0) {
        references.push({ path, matched: matchedPlugins });
      }
      return;
    }

    // Every form this scan looks for spells out `eslint`, so nothing else is
    // worth parsing.
    if (!content.includes('eslint')) {
      return;
    }
    const sourceFile = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      false
    );

    // Only what the file actually resolves counts as a reference: a config
    // breaks on a specifier it resolves, not on a string that spells the
    // package out.
    const specifiers = collectModuleSpecifiers(sourceFile);
    const matchedPlugins = matchers
      .filter(({ moduleSpecifier }) =>
        specifiers.some((specifier) => moduleSpecifier.test(specifier))
      )
      .map(({ plugin }) => plugin);
    if (matchedPlugins.length > 0) {
      references.push({ path, matched: matchedPlugins });
    }

    const code = blankOutLiterals(sourceFile, content);
    const matchedPrefixes = matchers
      .filter(({ prefix }) => hasEslintDirectiveFor(code, prefix))
      .map(({ prefix }) => prefix);
    if (matchedPrefixes.length > 0) {
      directives.push({ path, matched: matchedPrefixes });
    }
    if (hasEslintEnvComment(code)) {
      eslintEnv.push(path);
    }
  });

  return { references, directives, eslintEnv };
}

const BLOCK_COMMENT = /\/\*([\s\S]*?)\*\//g;
const LINE_COMMENT = /\/\/(.*)/g;
// The rule-id-carrying directives ESLint reads from a block comment:
// `eslint-disable`, `eslint-enable`, the two `-line` forms, and the inline
// `eslint <rule>: <severity>`.
const BLOCK_DIRECTIVE =
  /^\s*eslint(?:-disable(?:-next-line|-line)?|-enable)?\s/;
// A line comment carries only the two `-line` forms; ESLint reads
// `// eslint-disable react/no-danger` as ordinary prose.
const LINE_DIRECTIVE = /^\s*eslint-disable-(?:next-)?line\s/;
const ESLINT_ENV_DIRECTIVE = /^\s*eslint-env\s/;
// Literal kinds whose own text can spell out a directive comment.
const LITERAL_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.JsxText,
]);

// Every specifier that stops resolving once the package is gone. `require.resolve`
// counts: it never loads the module, but it throws MODULE_NOT_FOUND all the same.
function collectModuleSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const { moduleSpecifier } = node;
      if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
        specifiers.push(moduleSpecifier.text);
      }
    } else if (
      ts.isExternalModuleReference(node) &&
      ts.isStringLiteralLike(node.expression)
    ) {
      specifiers.push(node.expression.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    } else if (ts.isCallExpression(node)) {
      const { expression } = node;
      const resolvesModule =
        expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(expression) && expression.text === 'require') ||
        (ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          expression.expression.text === 'require' &&
          expression.name.text === 'resolve');
      const [firstArgument] = node.arguments;
      if (
        resolvesModule &&
        firstArgument &&
        ts.isStringLiteralLike(firstArgument)
      ) {
        specifiers.push(firstArgument.text);
      }
    }
    node.forEachChild(collect);
  };
  sourceFile.forEachChild(collect);

  return specifiers;
}

// Blanks out every literal so the comment scans below cannot mistake a quoted
// directive for a real one.
function blankOutLiterals(sourceFile: ts.SourceFile, content: string): string {
  const literals: [start: number, end: number][] = [];
  const collectLiterals = (node: ts.Node): void => {
    if (LITERAL_KINDS.has(node.kind)) {
      literals.push([node.getStart(sourceFile), node.end]);
      return;
    }
    node.forEachChild(collectLiterals);
  };
  sourceFile.forEachChild(collectLiterals);

  let code = '';
  let cursor = 0;
  for (const [start, end] of literals) {
    // Newlines are kept so a line comment still ends where it did.
    code +=
      content.slice(cursor, start) +
      content.slice(start, end).replace(/[^\n]/g, ' ');
    cursor = end;
  }

  return code + content.slice(cursor);
}

// Unlike the rule directives, `eslint-env` is only read from a block comment:
// ESLint treats `// eslint-env node` as ordinary prose.
function hasEslintEnvComment(content: string): boolean {
  return [...content.matchAll(BLOCK_COMMENT)].some(([, body]) =>
    ESLINT_ENV_DIRECTIVE.test(body)
  );
}

function hasEslintDirectiveFor(content: string, prefix: string): boolean {
  const carriesRule = (body: string, directive: RegExp): boolean =>
    directive.test(body) && body.includes(`${prefix}/`);

  return (
    [...content.matchAll(BLOCK_COMMENT)].some(([, body]) =>
      carriesRule(body, BLOCK_DIRECTIVE)
    ) ||
    [...content.matchAll(LINE_COMMENT)].some(([, body]) =>
      carriesRule(body, LINE_DIRECTIVE)
    )
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Reports the packages whose own manifest rules the new ESLint out. Declaring an
// `eslint` peer is the signal, not the package name: `typescript-eslint` and
// `angular-eslint` carry rules without being named like plugins. Nothing enforces
// a peer range at lint time, so these surface as a crash or a wrong result rather
// than a load error, and a clean result proves nothing: an open range (`>=8`) or
// a missing peer passes without the package ever having been built against v10.
function reportPluginsWithoutV10Support(
  tree: Tree,
  agentContext: string[],
  nextSteps: string[]
): void {
  if (!tree.exists('package.json')) {
    return;
  }

  const eslintVersion = readInstalledVersion('eslint');
  if (!eslintVersion) {
    return;
  }
  // Every peer range read below comes from node_modules, so the scan only answers
  // for a tree the install has already updated. When package.json is ahead of
  // what is installed (`nx migrate --run-migrations --skipInstall`), the ranges
  // it would read are the pre-migration ones and the verdict would be worthless.
  const declared = coerce(getDependencyVersionFromPackageJson(tree, 'eslint'));
  if (declared && gt(declared, eslintVersion)) {
    agentContext.push(
      `The check for ESLint plugins without a v10 release did not run: it reads each plugin's peerDependencies from node_modules, which still holds ESLint ${eslintVersion.version}. ` +
        'Install the updated dependencies before linting, and treat a plugin that throws at lint time as a version problem rather than a rule violation.'
    );
    nextSteps.push(
      `Skipped the check for ESLint plugins that declare no v10 support, because node_modules still holds ESLint ${eslintVersion.version}. Install the updated dependencies, then run lint.`
    );
    return;
  }

  const { dependencies = {}, devDependencies = {} } = readJson(
    tree,
    'package.json'
  );
  const incompatible: Array<{ name: string; range: string }> = [];
  for (const name of new Set([
    ...Object.keys(dependencies),
    ...Object.keys(devDependencies),
  ])) {
    // The same staleness applies per package, and this migration creates it
    // itself: the plugins it just bumped are still installed at the version
    // whose peer range rules ESLint v10 out, which is why they were bumped.
    const declaredVersion = coerce(
      getDependencyVersionFromPackageJson(tree, name)
    );
    const installedVersion = readInstalledVersion(name);
    if (
      declaredVersion &&
      installedVersion &&
      gt(declaredVersion, installedVersion)
    ) {
      continue;
    }

    const range = readInstalledEslintPeerRange(name);
    if (
      range &&
      validRange(range) &&
      !satisfies(eslintVersion, range, { includePrerelease: true })
    ) {
      incompatible.push({ name, range });
    }
  }

  if (incompatible.length === 0) {
    return;
  }

  agentContext.push(
    `These packages declare an ESLint peer range that excludes ESLint ${
      eslintVersion.version
    }: ${incompatible
      .map(({ name, range }) => `${name} (peer eslint ${range})`)
      .join(
        ', '
      )}. Update each one to a release that supports ESLint v10, or drop it along with the rules it provides. ` +
      'This check only sees the packages whose peer range rules ESLint v10 out; one with an open range or no ESLint peer at all can still fail, so treat a clean run of lint as the real answer.'
  );
  nextSteps.push(
    `These packages declare no support for ESLint ${
      eslintVersion.version
    } and need updating or replacing: ${incompatible
      .map(({ name }) => name)
      .join(', ')}.`
  );
}

function readInstalledVersion(name: string): SemVer | null {
  try {
    return coerce(readModulePackageJson(name).packageJson.version);
  } catch {
    return null;
  }
}

function readInstalledEslintPeerRange(name: string): string | null {
  try {
    return (
      readModulePackageJson(name).packageJson.peerDependencies?.eslint ?? null
    );
  } catch {
    // Not installed, or not resolvable from the workspace root. Either way
    // there is no peer range to read, so there is nothing to report.
    return null;
  }
}

// ESLint v10 raised its Node floor. Point it out when the workspace declares a
// range that allows an unsupported Node, or when the Node running the migration
// is already too old.
function reportNodeVersionRequirement(tree: Tree, nextSteps: string[]): void {
  const declaredRange = tree.exists('package.json')
    ? readJson(tree, 'package.json').engines?.node
    : undefined;
  const isSupported = declaredRange
    ? isSubsetOfSupportedNodeRange(declaredRange)
    : satisfies(process.versions.node, ESLINT_V10_NODE_RANGE);

  if (!isSupported) {
    nextSteps.push(
      `ESLint v10 requires Node.js ${ESLINT_V10_NODE_RANGE}${
        declaredRange
          ? `, but this workspace declares "engines.node": "${declaredRange}"`
          : `, and this run used Node.js ${process.versions.node}`
      }. Update the Node.js version used to lint.`
    );
  }
}

function isSubsetOfSupportedNodeRange(range: string): boolean {
  try {
    return subset(range, ESLINT_V10_NODE_RANGE);
  } catch {
    // An unparseable range cannot be cleared, so surface the requirement.
    return false;
  }
}
