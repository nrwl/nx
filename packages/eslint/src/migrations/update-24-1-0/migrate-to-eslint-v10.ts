import {
  addDependenciesToPackageJson,
  detectPackageManager,
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
import {
  acknowledgeBuildScripts,
  readModulePackageJson,
} from '@nx/devkit/internal';
import {
  coerce,
  gt,
  lt,
  satisfies,
  subset,
  validRange,
  type SemVer,
} from 'semver';
import * as ts from 'typescript';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  BASE_ESLINTRC_FILENAMES,
  ESLINT_FLAT_CONFIG_FILENAMES,
  ESLINT_OLD_CONFIG_FILENAMES,
  isEslintConfigFile,
} from '../../utils/config-file';
import { convertToFlatConfigGenerator } from '../../generators/convert-to-flat-config/generator';
import {
  JS_ESLINTRC_FILENAMES,
  readStaticJsEslintrcFromTree,
} from '../../generators/convert-to-flat-config/converters/static-js-config';
import {
  ESLINTRC_ONLY_OPTIONS_FIXES,
  findEslintrcOnlyTargetOptions,
} from '../../generators/convert-to-flat-config/eslintrc-only-target-options';
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
type V9OnlyPlugin = (typeof V9_ONLY_PLUGINS)[number];

// Versions `@nx/react` installs for the ESLint v10 stack
// (`packages/react/src/utils/versions.ts`).
export const ESLINT_PLUGIN_IMPORT_X_VERSION = '^4.17.1';
export const ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION = '7.1.1';

// The first release of each plugin the migration keeps whose peer range admits
// ESLint v10.
const ESLINT_V10_SUPPORT_FLOORS = {
  'eslint-plugin-import-x': '4.16.2',
  'eslint-plugin-react-hooks': '7.1.0',
};

// eslint@10's `engines.node`.
const ESLINT_V10_NODE_RANGE = '^20.19.0 || ^22.13.0 || >=24';

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

  // The conversion deletes the eslintrc files it converts.
  const hadEslintrcConfig = hasEslintrcConfig(tree);
  await convertRemainingEslintrcConfigs(tree, agentContext, nextSteps);
  reportEslintrcOnlyTargetOptions(tree, agentContext, nextSteps);
  const removedPlugins = replaceV9OnlyPlugins(tree, agentContext, nextSteps);
  updateRemainingFileReferences(
    tree,
    removedPlugins,
    hadEslintrcConfig,
    agentContext,
    nextSteps
  );
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
  // The converter leaves a shared eslintrc in place and loads it through
  // FlatCompat, so a listed file can still be in effect.
  const loadedThroughFlatCompat =
    'A file a flat config loads through FlatCompat, with `compat.extends` or the `extends` of a file loaded that way, still applies and can stay. To fold one in anyway, also remove the `compat.extends` entry that loads it.';
  if (rootState.kind === 'flat') {
    // Folding in a file the root eslint.config shadowed turns its rules back on,
    // which differs from restoring enforcement this run just dropped.
    if (ESLINT_FLAT_CONFIG_FILENAMES.some((file) => tree.exists(file))) {
      agentContext.push(
        `These eslintrc files are still in the workspace: ${list}. Unless lint ran with ESLINT_USE_FLAT_CONFIG=false, ESLint v9 resolved the eslint.config file at the workspace root instead of them, so the rules of a listed file that no flat config loads through FlatCompat were not applied before this run. ` +
          `Fold each of those into the flat config that covers the same files, then delete it, and expect new lint errors from rules that were off. ${loadedThroughFlatCompat}`
      );
      nextSteps.push(
        `Unless lint ran with ESLINT_USE_FLAT_CONFIG=false, ESLint v9 resolved the root eslint.config file instead of these eslintrc files, so the rules of the ones no flat config loads through FlatCompat were not applied. Fold them into flat config and delete them, except any a flat config loads that way: ${list}. Folding one in can surface new lint errors.`
      );
      return;
    }
    const baseConfig = BASE_ESLINT_CONFIG_FILENAMES.find((file) =>
      tree.exists(file)
    );
    agentContext.push(
      `These eslintrc files are still in the workspace: ${list}. The workspace root has ${baseConfig} but no eslint.config file, so this migration did not convert them. ` +
        'On ESLint v9, the inferred lint target of a project whose config is an eslintrc file ran ESLint with ESLINT_USE_FLAT_CONFIG=false, which applied that config. ' +
        `ESLint v10 does not read eslintrc files, so the rules of a listed file that no flat config loads through FlatCompat are silently not applied. Convert each of those to a flat config next to it, then delete it. ${loadedThroughFlatCompat}`
    );
    nextSteps.push(
      `ESLint v10 does not read these eslintrc files, which this migration did not convert because the workspace root has ${baseConfig} but no eslint.config file. Convert each to a flat config next to it and delete it, except any a flat config loads through FlatCompat: ${list}.`
    );
    return;
  }

  agentContext.push(
    `These eslintrc files are still in the workspace: ${list}. ESLint v10 removed the eslintrc format, so the rules of a listed file that no flat config loads through FlatCompat are silently not applied. ` +
      `Fold each of those into the flat config that covers the same files, then delete it. ${loadedThroughFlatCompat}`
  );
  nextSteps.push(
    `ESLint v10 no longer reads eslintrc files unless a flat config loads them through FlatCompat. Fold these into flat config and delete them, except any a flat config loads that way: ${list}.`
  );
}

// The conversion drops `no-eslintrc`; the other options stay on the target.
function reportEslintrcOnlyTargetOptions(
  tree: Tree,
  agentContext: string[],
  nextSteps: string[]
): void {
  const leftover = findEslintrcOnlyTargetOptions(tree);
  if (leftover.length === 0) {
    return;
  }
  const list = leftover.join('; ');
  agentContext.push(
    `These lint targets still carry ESLint CLI options that only exist for eslintrc: ${list}. ESLint v10 rejects "ignore-path", "no-eslintrc" and "resolve-plugins-relative-to" as invalid options, so those targets fail until the options are gone. ` +
      '"rulesdir" never reaches ESLint, because the task does not pass a list option on, so the rules in that directory are not loaded. ' +
      'Follow the section on eslintrc-only lint target options.'
  );
  nextSteps.push(
    `Replace the eslintrc-only ESLint options these lint targets still carry, since ESLint v10 does not support them: ${list}. ${ESLINTRC_ONLY_OPTIONS_FIXES}`
  );
}

// The flat-config conversion pulls `eslint:recommended` from `@eslint/js`, whose
// v10 recommended set is wider than the one ESLint v9 applied. The converter
// keeps the workspace on its ESLint major, so check what it landed on
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
    'The conversion added @eslint/js, which now supplies the "eslint:recommended" set to converted configs and to eslintrc files loaded through FlatCompat. Its ESLint v10 release enables three rules the v9 one did not: no-unassigned-vars, no-useless-assignment and preserve-caught-error. They apply only where a config extends "eslint:recommended".'
  );
  agentContext.push(
    'The conversion added @eslint/js to package.json. Converted configs and eslintrc files loaded through FlatCompat take the "eslint:recommended" set from it. Its recommended set enables no-unassigned-vars, no-useless-assignment and preserve-caught-error, which the workspace was not running before. Where a config extends "eslint:recommended", expect those three to account for newly reported errors when lint runs.'
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

  // Past the flat check this can only be an eslintrc file. Check the one the
  // generator picks by filename precedence. A file the generator does not plan
  // cannot block the conversion, so reporting it would skip one that goes through.
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
    if (isEslintrcFile(path) && !alreadyReported.has(path)) {
      remaining.push(path);
    }
  });
  return remaining;
}

function isEslintrcFile(path: string): boolean {
  const filename = basename(path);
  return (
    ESLINT_OLD_CONFIG_FILENAMES.includes(filename) ||
    BASE_ESLINTRC_FILENAMES.includes(filename)
  );
}

// Whether ESLint could have applied an /* eslint-env */ comment: only the
// eslintrc format reads them, from an eslintrc file or package.json's
// `eslintConfig`.
function hasEslintrcConfig(tree: Tree): boolean {
  let found = false;
  visitNotIgnoredFiles(tree, '', (path) => {
    if (found) {
      return;
    }
    if (isEslintrcFile(path)) {
      found = true;
    } else if (basename(path) === 'package.json') {
      try {
        found = readJson(tree, path).eslintConfig !== undefined;
      } catch {
        // A manifest that does not parse might carry one.
        found = true;
      }
    }
  });
  return found;
}

// Returns the plugins it removed, so the file scan knows which references are
// now dangling.
function replaceV9OnlyPlugins(
  tree: Tree,
  agentContext: string[],
  nextSteps: string[]
): V9OnlyPlugin[] {
  const declared = V9_ONLY_PLUGINS.filter(
    (plugin) => getDependencyVersionFromPackageJson(tree, plugin) !== null
  );
  const importX = readDeclaredVersion(tree, 'eslint-plugin-import-x');
  const reactHooks = readDeclaredVersion(tree, 'eslint-plugin-react-hooks');
  const installImportX = importX
    ? isBelowV10Support(
        'eslint-plugin-import-x',
        importX,
        agentContext,
        nextSteps
      )
    : declared.includes('eslint-plugin-import');
  const needsReactHooksBump =
    !!reactHooks &&
    isBelowV10Support(
      'eslint-plugin-react-hooks',
      reactHooks,
      agentContext,
      nextSteps
    );

  if (declared.length === 0 && !installImportX && !needsReactHooksBump) {
    return [];
  }

  if (declared.length > 0) {
    removeDependenciesFromPackageJson(tree, [...declared], [...declared]);
  }

  const devDependencies: Record<string, string> = {};
  if (installImportX) {
    devDependencies['eslint-plugin-import-x'] = ESLINT_PLUGIN_IMPORT_X_VERSION;
  }
  if (needsReactHooksBump) {
    devDependencies['eslint-plugin-react-hooks'] =
      ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION;
  }
  if (Object.keys(devDependencies).length > 0) {
    addDependenciesToPackageJson(tree, {}, devDependencies);
  }
  if (devDependencies['eslint-plugin-import-x']) {
    // eslint-plugin-import-x depends on unrs-resolver, whose postinstall only
    // fetches a fallback binding for platforms its prebuilt bindings miss.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      'unrs-resolver': false,
    });
  }

  const changes: string[] = [];
  if (declared.length > 0) {
    changes.push(
      `removed ${declared.join(', ')} (no ESLint v10 release)${
        installImportX && !importX
          ? ' and installed eslint-plugin-import-x in place of eslint-plugin-import'
          : ''
      }`
    );
  }
  if (installImportX && importX) {
    changes.push(
      `updated eslint-plugin-import-x to ${ESLINT_PLUGIN_IMPORT_X_VERSION}`
    );
  }
  // v7 added the React Compiler rules to the preset, so a 7.0 install has them.
  const reactHooksGainsCompilerRules =
    needsReactHooksBump && reactHooks.version.major < 7;
  if (needsReactHooksBump) {
    changes.push(
      `updated eslint-plugin-react-hooks to ${ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION}${
        reactHooksGainsCompilerRules
          ? ', whose "recommended" preset also enables the React Compiler rules'
          : ''
      }`
    );
  }
  if (reactHooksGainsCompilerRules) {
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

type DeclaredVersion = { specifier: string; version: SemVer | null };

// `version` is null for a specifier that names no version: a protocol
// (`workspace:*`, `npm:...`) or a dist tag. Rewriting one would swap the
// resolution the workspace chose for a literal version.
function readDeclaredVersion(tree: Tree, name: string): DeclaredVersion | null {
  const specifier = getDependencyVersionFromPackageJson(tree, name);
  if (specifier === null) {
    return null;
  }
  return {
    specifier,
    version: validRange(specifier) ? coerce(specifier) : null,
  };
}

// Reports a specifier it cannot compare, and leaves it as it is.
function isBelowV10Support(
  name: keyof typeof ESLINT_V10_SUPPORT_FLOORS,
  { specifier, version }: DeclaredVersion,
  agentContext: string[],
  nextSteps: string[]
): boolean {
  const floor = ESLINT_V10_SUPPORT_FLOORS[name];
  if (version) {
    return lt(version, floor);
  }
  agentContext.push(
    `${name} is declared as "${specifier}", which names no version to compare, so it was left as it is. Its ESLint v10 support starts at ${floor}: resolve what that specifier points at and update it at its source if it is below that.`
  );
  nextSteps.push(
    `${name} is declared as "${specifier}" and was not updated. Check that it resolves to ${floor} or later, where its ESLint v10 support starts.`
  );
  return false;
}

// What the dependency changes left behind in the workspace's own files, plus the
// /* eslint-env */ comments ESLint v10 rejects. Edits the comments it can fix
// exactly and reports the rest.
function updateRemainingFileReferences(
  tree: Tree,
  removedPlugins: V9OnlyPlugin[],
  hadEslintrcConfig: boolean,
  agentContext: string[],
  nextSteps: string[]
): void {
  const {
    imports,
    mentions,
    cleanedDirectives,
    directives,
    deletedEslintEnv,
    eslintEnv,
    keptComments,
    declaresEslintConfigNext,
  } = fixAndCollectFileReferences(tree, removedPlugins, hadEslintrcConfig);

  if (imports.length > 0 || mentions.length > 0) {
    const found: string[] = [];
    if (imports.length > 0) {
      found.push(
        `These files import plugins this migration removed because they have no ESLint v10 release: ${formatUsages(imports)}.`
      );
    }
    if (mentions.length > 0) {
      found.push(
        `These eslintrc files name plugins this migration removed: ${formatUsages(mentions)}.`
      );
    }
    agentContext.push(
      `${found.join(' ')} ` +
        'Rewrite each eslint-plugin-import usage to eslint-plugin-import-x: the plugin key, its rule prefix and its "import/" settings keys all become "import-x". ' +
        'Delete the eslint-plugin-react and eslint-plugin-jsx-a11y plugin registrations along with the rules that use their prefixes. ' +
        'Those two have no ESLint v10 substitute, so their rules cannot be preserved.'
    );
    nextSteps.push(
      `Update these files, which import or name a plugin this migration removed: ${[
        ...imports,
        ...mentions,
      ]
        .map(({ path }) => path)
        .join(', ')}.`
    );
  }
  if (cleanedDirectives.length > 0) {
    nextSteps.push(
      `Removed the rules of the plugins this migration removed from the ESLint directive comments in these files, and deleted the comments left with no rule: ${formatUsages(
        cleanedDirectives
      )}.`
    );
  }
  if (directives.length > 0) {
    agentContext.push(
      `These source files carry ESLint directive comments naming rules from plugins this migration removed: ${formatUsages(
        directives
      )}. A directive naming a rule no config defines is itself a lint error. ` +
        'Rewrite an "import/" prefix to "import-x/", and delete the inline configuration of a "react/" or "jsx-a11y/" rule.'
    );
    nextSteps.push(
      `These source files have ESLint directive comments naming rules from the removed plugins: ${directives
        .map(({ path }) => path)
        .join(', ')}.`
    );
  }
  if (removedPlugins.length > 0 && declaresEslintConfigNext) {
    agentContext.push(
      'eslint-config-next is declared, and it registers eslint-plugin-react, eslint-plugin-jsx-a11y and eslint-plugin-import itself, so the ESLint directive comments naming their rules were not checked. ' +
        `Fix the ones lint reports as "Definition for rule '...' was not found", and leave the rest.`
    );
  }
  if (removedPlugins.length > 0) {
    nextSteps.push(
      `${
        declaresEslintConfigNext
          ? 'eslint-config-next is declared and registers the removed plugins itself, so the ESLint directive comments naming their rules were left as they are. '
          : ''
      }Run lint to find the directive comments that still name a rule from a removed plugin. For files no lint target covers, search for "react/", "jsx-a11y/" and "import/" in directive comments, and confirm each hit with "npx eslint <file>" before editing it.`
    );
  }
  if (deletedEslintEnv.length > 0) {
    nextSteps.push(
      `Deleted the /* eslint-env */ comments, which ESLint v10 reports as errors, from these files. The workspace had no eslintrc config, so ESLint never applied their globals: ${deletedEslintEnv.join(
        ', '
      )}.`
    );
  }
  if (keptComments.length > 0) {
    agentContext.push(
      `These source files carry /* eslint-env */ comments, or directive comments naming only rules of the plugins this migration removed, that ESLint v10 reports as errors: ${keptComments.join(
        ', '
      )}. The migration left them because a comment ends on the nearest non-blank line above each one. ` +
        'Removing or blanking such a line puts the code below under an eslint-disable-next-line or @ts-ignore comment there, since @ts-ignore skips blank lines. ' +
        'Delete each one, then decide whether that comment should apply to the code below. ' +
        'Delete a left /* eslint-env */ comment without adding /* global */ comments, because this migration leaves one only when no eslintrc config applied its globals.'
    );
    nextSteps.push(
      `Left /* eslint-env */ comments and directive comments naming only the removed plugins' rules in these files, because a comment ends on the line above each one: ${keptComments.join(
        ', '
      )}. ESLint v10 reports them as errors. Delete each one by hand, and check what an eslint-disable-next-line or @ts-ignore comment above it applies to afterwards.`
    );
  }
  if (eslintEnv.length > 0) {
    agentContext.push(
      `These source files carry /* eslint-env */ comments: ${eslintEnv.join(
        ', '
      )}. ESLint v9 only warned that flat config ignores them; v10 reports each one as an error ("/* eslint-env */ comments are no longer supported"). ` +
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

// What happens to a removed plugin's rule in a disable or enable directive.
// Nothing replaces eslint-plugin-react or eslint-plugin-jsx-a11y, so their rules
// are dropped. An `import/` rule is reported: whether it moves to
// eslint-plugin-import-x depends on the rule and on the key a config registers
// the fork under.
const DIRECTIVE_RULE_HANDLING: Record<V9OnlyPlugin, 'remove' | 'report'> = {
  'eslint-plugin-import': 'report',
  'eslint-plugin-jsx-a11y': 'remove',
  'eslint-plugin-react': 'remove',
};

// One walk for everything ESLint v10 can no longer resolve, including the
// /* eslint-env */ comments it turned from a warning into an error.
function fixAndCollectFileReferences(
  tree: Tree,
  plugins: readonly V9OnlyPlugin[],
  hadEslintrcConfig: boolean
): {
  imports: PluginUsage[];
  mentions: PluginUsage[];
  cleanedDirectives: PluginUsage[];
  directives: PluginUsage[];
  deletedEslintEnv: string[];
  eslintEnv: string[];
  keptComments: string[];
  declaresEslintConfigNext: boolean;
} {
  const matchers = plugins.map((plugin) => {
    // A rule id drops the `eslint-plugin-` prefix, so `eslint-plugin-jsx-a11y`
    // owns the `jsx-a11y/` rules.
    const prefix = plugin.replace('eslint-plugin-', '');
    return {
      plugin,
      prefix,
      handling: DIRECTIVE_RULE_HANDLING[plugin],
      // `eslint-plugin-import` must not match `eslint-plugin-import-x`.
      packageName: new RegExp(`${escapeRegExp(plugin)}(?![\\w-])`),
      // Anchored, so a relative import of a local file that happens to be named
      // after the plugin is not read as the package. Subpaths still match.
      moduleSpecifier: new RegExp(`^${escapeRegExp(plugin)}(?![\\w-])`),
      // A rule id (`"jsx-a11y/alt-text"`) or a config pulled in through
      // `extends` (`"plugin:jsx-a11y/recommended"`).
      jsonPrefixed: new RegExp(`['"](?:plugin:)?${escapeRegExp(prefix)}/`),
      // YAML leaves both unquoted, as a list item, a mapping key or a flow entry.
      yamlPrefixed: new RegExp(
        `[\\s\\[{,'"](?:plugin:)?${escapeRegExp(prefix)}/`
      ),
      // A rule id in an inline `eslint` config. `@eslint-react/` must not match
      // `react/`.
      inlineRuleId: new RegExp(`(?<![\\w@/.-])${escapeRegExp(prefix)}/`),
    };
  });

  const mentions: PluginUsage[] = [];
  const sourceFiles: string[] = [];
  let declaresEslintConfigNext = false;
  visitNotIgnoredFiles(tree, '', (path) => {
    if (SOURCE_FILE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
      sourceFiles.push(path);
    } else if (basename(path) === 'package.json') {
      declaresEslintConfigNext ||= declaresEslintConfigNextIn(tree, path);
    } else if (isEslintConfigFile(path)) {
      // A JSON or YAML eslintrc that stays, so any mention of a plugin's package
      // or a quoted rule id counts. ESLint parses a bare `.eslintrc` as YAML too.
      const content = tree.read(path, 'utf-8');
      const isYaml = /\.ya?ml$/.test(path) || basename(path) === '.eslintrc';
      const matched = matchers
        .filter(
          (matcher) =>
            matcher.packageName.test(content) ||
            (isYaml ? matcher.yamlPrefixed : matcher.jsonPrefixed).test(content)
        )
        .map(({ plugin }) => plugin);
      if (matched.length > 0) {
        mentions.push({ path, matched });
      }
    }
  });

  // eslint-config-next registers all three plugins itself, so their rules still
  // resolve in the files a config that spreads it lints.
  const checkDirectives = matchers.length > 0 && !declaresEslintConfigNext;
  const imports: PluginUsage[] = [];
  const cleanedDirectives: PluginUsage[] = [];
  const directives: PluginUsage[] = [];
  const deletedEslintEnv: string[] = [];
  const eslintEnv: string[] = [];
  const keptComments: string[] = [];
  for (const path of sourceFiles) {
    const content = tree.read(path, 'utf-8');
    // Every form this scan looks for spells out `eslint`, so nothing else is
    // worth parsing.
    if (!content?.includes('eslint')) {
      continue;
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
    const imported = matchers
      .filter(({ moduleSpecifier }) =>
        specifiers.some((specifier) => moduleSpecifier.test(specifier))
      )
      .map(({ plugin }) => plugin);
    if (imported.length > 0) {
      imports.push({ path, matched: imported });
    }

    const edits: { start: number; end: number; text: string }[] = [];
    const cleaned = new Set<string>();
    const reported = new Set<string>();
    let reportsEslintEnv = false;
    let deletesEslintEnv = false;
    let keepsComment = false;
    const comments = collectComments(sourceFile);
    const code = blankComments(content, comments);
    // A comment this scan deletes no longer sits above the next one.
    const remaining = new Set(comments);
    for (const comment of comments) {
      const directive = readDirective(content, comment);
      if (!directive) {
        continue;
      }
      if (directive.label === 'eslint-env') {
        // Only the eslintrc format applies the globals one declares.
        if (hadEslintrcConfig) {
          reportsEslintEnv = true;
          continue;
        }
        const edit = deleteComment(content, code, comment, remaining);
        if (edit) {
          edits.push(edit);
          remaining.delete(comment);
          deletesEslintEnv = true;
        } else {
          keepsComment = true;
        }
        continue;
      }
      if (!checkDirectives) {
        continue;
      }
      if (directive.label === 'eslint') {
        for (const { prefix, inlineRuleId } of matchers) {
          if (inlineRuleId.test(directive.value)) {
            reported.add(prefix);
          }
        }
        continue;
      }
      if (!LIST_DIRECTIVES.has(directive.label)) {
        continue;
      }
      const kept: string[] = [];
      const removed: string[] = [];
      for (const entry of directive.value.split(',').map((e) => e.trim())) {
        // ESLint's `parseListConfig` strips the quotes around a rule id.
        const ruleId = entry.replace(/^(['"]?)(.*)\1$/s, '$2');
        const matcher = matchers.find(({ prefix }) =>
          ruleId.startsWith(`${prefix}/`)
        );
        if (matcher?.handling === 'remove') {
          removed.push(matcher.prefix);
          continue;
        }
        if (matcher?.handling === 'report') {
          reported.add(matcher.prefix);
        }
        if (entry) {
          kept.push(entry);
        }
      }
      if (removed.length === 0) {
        continue;
      }
      if (kept.length > 0) {
        edits.push({
          start: comment.pos,
          end: comment.end,
          text: formatListDirective(
            directive,
            kept,
            content.slice(comment.pos, comment.end)
          ),
        });
      } else {
        const edit = deleteComment(content, code, comment, remaining);
        if (!edit) {
          keepsComment = true;
          continue;
        }
        edits.push(edit);
        remaining.delete(comment);
      }
      removed.forEach((prefix) => cleaned.add(prefix));
    }

    if (edits.length > 0) {
      let updated = content;
      for (const { start, end, text } of edits.sort(
        (a, b) => b.start - a.start
      )) {
        updated = updated.slice(0, start) + text + updated.slice(end);
      }
      tree.write(path, updated);
    }
    if (cleaned.size > 0) {
      cleanedDirectives.push({ path, matched: [...cleaned] });
    }
    if (reported.size > 0) {
      directives.push({ path, matched: [...reported] });
    }
    if (reportsEslintEnv) {
      eslintEnv.push(path);
    }
    if (deletesEslintEnv) {
      deletedEslintEnv.push(path);
    }
    if (keepsComment) {
      keptComments.push(path);
    }
  }

  return {
    imports,
    mentions,
    cleanedDirectives,
    directives,
    deletedEslintEnv,
    eslintEnv,
    keptComments,
    declaresEslintConfigNext,
  };
}

// A manifest that does not parse might declare it.
function declaresEslintConfigNextIn(tree: Tree, path: string): boolean {
  let manifest: Record<string, Record<string, string> | undefined>;
  try {
    manifest = readJson(tree, path);
  } catch {
    return true;
  }
  return [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ].some((section) => manifest[section]?.['eslint-config-next'] !== undefined);
}

// Every comment in the file, read from the trivia before each token the parser
// produced, so the text of a string, template or JSX element never reads as one.
function collectComments(sourceFile: ts.SourceFile): ts.CommentRange[] {
  const comments = new Map<number, ts.CommentRange>();
  const visit = (node: ts.Node): void => {
    // JSDoc nodes sit inside the comment that holds them, and JSX text has no
    // trivia.
    if (
      node.kind === ts.SyntaxKind.JsxText ||
      (node.kind >= ts.SyntaxKind.FirstJSDocNode &&
        node.kind <= ts.SyntaxKind.LastJSDocNode)
    ) {
      return;
    }
    const children = node.getChildren(sourceFile);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    // TypeScript calls the comments before the first line break "trailing" and
    // the rest "leading", so a token's trivia needs both.
    for (const comment of [
      ...(ts.getTrailingCommentRanges(sourceFile.text, node.pos) ?? []),
      ...(ts.getLeadingCommentRanges(sourceFile.text, node.pos) ?? []),
    ]) {
      comments.set(comment.pos, comment);
    }
  };
  visit(sourceFile);

  return [...comments.values()];
}

function blankComments(content: string, comments: ts.CommentRange[]): string {
  const chars = content.split('');
  for (const { pos, end } of comments) {
    chars.fill(' ', pos, end);
  }
  return chars.join('');
}

// ESLint's directive grammar (`parseDirective` in @eslint/plugin-kit): the label
// is the first word of the text before a ` -- ` justification.
const DIRECTIVE_JUSTIFICATION = /\s-{2,}\s/;
const DIRECTIVE_LABEL = /^([a-z]+(?:-[a-z]+)*)(?:\s|$)/;
// The directives that take a list of rule ids.
const LIST_DIRECTIVES = new Set([
  'eslint-disable',
  'eslint-disable-line',
  'eslint-disable-next-line',
  'eslint-enable',
]);
// ESLint reads any other line comment, `// eslint-env node` included, as prose.
const LINE_COMMENT_DIRECTIVES = new Set([
  'eslint-disable-line',
  'eslint-disable-next-line',
]);

type Directive = {
  isLine: boolean;
  label: string;
  value: string;
  // With its leading whitespace, so it can be written back as it was.
  justification: string;
};

function readDirective(
  content: string,
  { kind, pos, end }: ts.CommentRange
): Directive | undefined {
  const isLine = kind === ts.SyntaxKind.SingleLineCommentTrivia;
  // An unterminated block comment is a syntax error ESLint never gets past.
  if (!isLine && !content.startsWith('*/', end - 2)) {
    return undefined;
  }
  const body = content.slice(pos + 2, isLine ? end : end - 2);
  const justification = DIRECTIVE_JUSTIFICATION.exec(body);
  const directive = (
    justification ? body.slice(0, justification.index) : body
  ).trim();
  const label = DIRECTIVE_LABEL.exec(directive)?.[1];
  if (!label || (isLine && !LINE_COMMENT_DIRECTIVES.has(label))) {
    return undefined;
  }

  return {
    isLine,
    label,
    value: directive.slice(label.length).trim(),
    justification: justification
      ? body.slice(justification.index).trimEnd()
      : '',
  };
}

// ASI treats a comment holding a line break as one, so a rewritten block comment
// keeps the break the original had.
function formatListDirective(
  directive: Directive,
  ruleIds: string[],
  original: string
): string {
  const text = `${directive.label} ${ruleIds.join(', ')}${directive.justification}`;
  if (directive.isLine) {
    return `// ${text}`;
  }
  return LINE_TERMINATOR.test(original) ? `/* ${text}\n*/` : `/* ${text} */`;
}

const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;

// Takes the whole line when the comment is alone on it, and the whitespace before
// it when it ends a line of code. Makes no edit on a line holding only comments
// right under another comment. `code` is `content` with its comments blanked.
function deleteComment(
  content: string,
  code: string,
  { pos, end }: ts.CommentRange,
  remaining: Set<ts.CommentRange>
): { start: number; end: number; text: string } | undefined {
  const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
  const newline = content.indexOf('\n', end);
  const lineEnd = newline === -1 ? content.length : newline;
  const before = content.slice(lineStart, pos);
  const after = content.slice(end, lineEnd);
  const breaksLine = LINE_TERMINATOR.test(content.slice(pos, end));
  if (
    code.slice(lineStart, pos).trim() === '' &&
    (code.slice(end, lineEnd).trim() === '' || breaksLine)
  ) {
    // Only comments share this line, and the scan may delete them all. Emptying
    // or removing it would put the code below under a next-line directive above,
    // such as eslint-disable-next-line or @ts-ignore, which skips blank lines.
    const lastAbove = content.slice(0, lineStart).trimEnd().length;
    const aboveStart = content.lastIndexOf('\n', lastAbove - 1) + 1;
    if (
      [...remaining].some(
        (other) => other.end > aboveStart && other.end <= lineStart
      )
    ) {
      return undefined;
    }
  }
  if (after.trim() !== '') {
    // ASI treats a comment holding a line break as one, and a comment between
    // two tokens keeps them apart.
    const text = breaksLine
      ? '\n'
      : /\S$/.test(before) && /^\S/.test(after)
        ? ' '
        : '';
    return { start: pos, end, text };
  }
  if (before.trim() !== '') {
    return { start: lineStart + before.trimEnd().length, end, text: '' };
  }
  return {
    start: lineStart,
    end: newline === -1 ? lineEnd : newline + 1,
    text: '',
  };
}

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
    // `requires` passes on the version package.json moves eslint to, so the
    // migration also runs on a tree where eslint does not resolve at all.
    agentContext.push(
      "The check for ESLint plugins without a v10 release did not run: it reads each plugin's peerDependencies from node_modules, and eslint does not resolve from the workspace root. " +
        'Install the updated dependencies before linting, and treat a plugin that throws at lint time as a version problem rather than a rule violation.'
    );
    nextSteps.push(
      'Skipped the check for ESLint plugins that declare no v10 support, because eslint does not resolve from the workspace root. Install the updated dependencies, then run lint.'
    );
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
    `These packages declare an ESLint peer range that excludes ESLint ${
      eslintVersion.version
    }, so update or replace them: ${incompatible
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
