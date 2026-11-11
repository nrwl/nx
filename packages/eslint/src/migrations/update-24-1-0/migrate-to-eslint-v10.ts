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
  getResolvedPackageVersion,
  readModulePackageJson,
} from '@nx/devkit/internal';
import {
  coerce,
  gt,
  lt,
  major,
  minVersion,
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
import { ESLINT_V10_FLOORS } from '../../utils/versions';

// The ESLint <10 React plugins `@nx/react` installs that have no release
// supporting v10 (`eslintLegacyDependencies` in `packages/react/src/utils/lint.ts`,
// minus react-hooks). `eslint-plugin-import` has a maintained fork
// (`eslint-plugin-import-x`); Nx picks no replacement for the other two, so they
// are dropped. `@nx/eslint` cannot import the list from `@nx/react`, which
// depends on it.
export const V9_ONLY_PLUGINS = [
  'eslint-plugin-import',
  'eslint-plugin-jsx-a11y',
  'eslint-plugin-react',
] as const;
type V9OnlyPlugin = (typeof V9_ONLY_PLUGINS)[number];

const ESLINT_PLUGIN_IMPORT_X_VERSION = '^4.17.1';
const ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION = '7.1.1';

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

// The prompt skips the search behind a scan that found nothing, so a scan that
// did not run must say so rather than report `none`.
type ScanResult = 'none' | 'reported below' | `not run, ${string}`;

/**
 * Hybrid migration paired with `finish-eslint-v10-migration.md`. The
 * deterministic half converts the workspace's eslintrc configs to flat config
 * (ESLint v10 removed the eslintrc format outright) and replaces the ESLint
 * plugins that have no v10 release. Everything it cannot do safely, such
 * as an eslintrc config whose values are computed at runtime or a config that
 * imports a dropped plugin, is returned as `agentContext` for the paired prompt,
 * after a first entry that gives the result of every scan.
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

  const eslintrcConfigs = await convertRemainingEslintrcConfigs(
    tree,
    agentContext,
    nextSteps
  );
  const targetOptions = reportEslintrcOnlyTargetOptions(
    tree,
    agentContext,
    nextSteps
  );
  const removedPlugins = replaceV9OnlyPlugins(tree, agentContext, nextSteps);
  const fileReferences = updateRemainingFileReferences(
    tree,
    removedPlugins,
    agentContext,
    nextSteps
  );
  const peerRanges = reportPluginsWithoutV10Support(
    tree,
    agentContext,
    nextSteps
  );
  const nodeRange = reportNodeVersionRequirement(tree, nextSteps);

  agentContext.unshift(
    `Pre-pass scan results: eslintrc configs left: ${eslintrcConfigs}; ` +
      `eslintrc-only lint target options: ${targetOptions}; ` +
      `plugins removed: ${removedPlugins.join(', ') || 'none'}; ` +
      `imports and eslintrc mentions of a removed plugin: ${fileReferences.references}; ` +
      `directive comments naming a removed plugin's rules: ${fileReferences.directives}; ` +
      `/* eslint-env */ comments: ${fileReferences.eslintEnv}; ` +
      `root dependencies whose ESLint peer range excludes the installed ESLint: ${peerRanges}; ` +
      `root engines.node: ${nodeRange}.`
  );

  await formatFiles(tree);

  return { nextSteps, agentContext };
}

async function convertRemainingEslintrcConfigs(
  tree: Tree,
  agentContext: string[],
  nextSteps: string[]
): Promise<ScanResult> {
  // The generator deletes the files it converts, so capture the ones it will
  // skip before running it.
  const unconvertibleProjectConfigs = findUnconvertibleProjectConfigs(tree);
  const rootState = detectRootConfigState(tree);

  let result: ScanResult = 'none';
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
      result = 'reported below';
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
    result = 'reported below';
  }

  // ESLint v10 no longer reads eslintrc files itself, so one left behind stops
  // applying without an error unless a flat config loads it through FlatCompat.
  const remaining = findRemainingEslintrcConfigs(
    tree,
    new Set(unconvertibleProjectConfigs.map(({ path }) => path))
  );
  if (remaining.length === 0) {
    return result;
  }

  const list = remaining.join(', ');
  // A converted `.eslintrc.base.json` with no sibling root config also leaves a
  // base-only root, so only a root that was flat before the run counts.
  const baseConfig =
    rootState.kind === 'flat' &&
    !ESLINT_FLAT_CONFIG_FILENAMES.some((file) => tree.exists(file))
      ? BASE_ESLINT_CONFIG_FILENAMES.find((file) => tree.exists(file))
      : undefined;
  const notConverted = baseConfig
    ? ` The workspace root has ${baseConfig} but no eslint.config file, so this migration did not convert them.`
    : '';
  agentContext.push(
    `These eslintrc files are still in the workspace: ${list}.${notConverted} ESLint v10 does not read eslintrc files, so the rules of a listed file that no flat config loads through FlatCompat are not applied. ` +
      'Convert each of those: fold it into the flat config that covers the same files, or write a flat config next to it where none does, then delete it. ' +
      'If lint already ran on flat config before this run, the rules of such a file were already off, so converting it can surface new lint errors. ' +
      'A file a flat config loads through FlatCompat, with `compat.extends` or the `extends` of a file loaded that way, still applies and can stay. To fold one in anyway, also remove the `compat.extends` entry that loads it.'
  );
  nextSteps.push(
    `ESLint v10 no longer reads eslintrc files unless a flat config loads them through FlatCompat.${notConverted} Convert these to flat config and delete them, except any a flat config loads that way: ${list}. Converting one whose rules were already off can surface new lint errors.`
  );
  return 'reported below';
}

// The conversion drops `no-eslintrc` from inferred-target overrides and the
// `@nx/eslint/plugin` targetDefaults; every other eslintrc-only option stays.
function reportEslintrcOnlyTargetOptions(
  tree: Tree,
  agentContext: string[],
  nextSteps: string[]
): ScanResult {
  const leftover = findEslintrcOnlyTargetOptions(tree);
  if (leftover.length === 0) {
    return 'none';
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
  return 'reported below';
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
    reactHooks !== null &&
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
  const importXUpdated =
    installImportX &&
    importX !== null &&
    isUpdated(
      tree,
      'eslint-plugin-import-x',
      importX,
      ESLINT_PLUGIN_IMPORT_X_VERSION,
      agentContext,
      nextSteps
    );
  const reactHooksUpdated =
    needsReactHooksBump &&
    isUpdated(
      tree,
      'eslint-plugin-react-hooks',
      reactHooks,
      ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION,
      agentContext,
      nextSteps
    );
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
  if (importXUpdated) {
    changes.push(
      `updated eslint-plugin-import-x to ${ESLINT_PLUGIN_IMPORT_X_VERSION}`
    );
  }
  // v7 added the React Compiler rules to the preset, so a 7.0 install has them.
  const reactHooksGainsCompilerRules =
    reactHooksUpdated && major(reactHooks.version) < 7;
  if (reactHooksUpdated) {
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
        "@nx/eslint-plugin's flat/react and flat/react-jsx presets pin rules-of-hooks and exhaustive-deps on ESLint v10, so a config that reaches the rules through one of them is unaffected. " +
        'The new errors come from a changed preset default rather than from the user, so turn a rule off in the flat config with a short comment rather than editing source, and never weaken rules-of-hooks or exhaustive-deps.'
    );
  }
  if (changes.length > 0) {
    nextSteps.push(
      `Updated the ESLint plugins for v10: ${changes.join(
        ', '
      )}. Re-run lint to confirm the rule set still matches your expectations.`
    );
  }

  return [...declared];
}

// `version` is the installed version when it satisfies `specifier`, else the
// floor of the declared range. It is null for a specifier that resolves to no
// version, such as `workspace:*` or a dist tag with nothing installed.
type DeclaredVersion = { specifier: string; version: string | null };

function readDeclaredVersion(tree: Tree, name: string): DeclaredVersion | null {
  const specifier = getDependencyVersionFromPackageJson(tree, name);
  if (specifier === null) {
    return null;
  }
  return { specifier, version: getResolvedPackageVersion(tree, name) };
}

type ReplacementPlugin = 'eslint-plugin-import-x' | 'eslint-plugin-react-hooks';

// Only a version range is rewritten. Replacing a protocol (`workspace:*`,
// `npm:...`) or a dist tag would swap the resolution the workspace chose for a
// literal version.
function isBelowV10Support(
  name: ReplacementPlugin,
  { specifier, version }: DeclaredVersion,
  agentContext: string[],
  nextSteps: string[]
): boolean {
  if (version !== null && !lt(version, ESLINT_V10_FLOORS[name])) {
    return false;
  }
  if (version !== null && validRange(specifier)) {
    return true;
  }
  reportNotUpdated(name, specifier, agentContext, nextSteps);
  return false;
}

// `addDependenciesToPackageJson` compares a range by its first version, so it
// keeps a range such as `<5 >=4.10.0` that starts below the floor.
function isUpdated(
  tree: Tree,
  name: ReplacementPlugin,
  { specifier }: DeclaredVersion,
  version: string,
  agentContext: string[],
  nextSteps: string[]
): boolean {
  if (getDependencyVersionFromPackageJson(tree, name) === version) {
    return true;
  }
  reportNotUpdated(name, specifier, agentContext, nextSteps);
  return false;
}

function reportNotUpdated(
  name: ReplacementPlugin,
  specifier: string,
  agentContext: string[],
  nextSteps: string[]
): void {
  const floor = ESLINT_V10_FLOORS[name];
  agentContext.push(
    `${name} is declared as "${specifier}", which this migration does not rewrite, so it was left as it is. Its ESLint v10 support starts at ${floor}: resolve what that specifier points at and update it at its source if it is below that.`
  );
  nextSteps.push(
    `${name} is declared as "${specifier}" and was not updated. Check that it resolves to ${floor} or later, where its ESLint v10 support starts.`
  );
}

// What the dependency changes left behind in the workspace's own files, plus the
// /* eslint-env */ comments ESLint v10 rejects. Reports them, except one comment
// Nx generated, which it deletes.
function updateRemainingFileReferences(
  tree: Tree,
  removedPlugins: V9OnlyPlugin[],
  agentContext: string[],
  nextSteps: string[]
): { references: ScanResult; directives: ScanResult; eslintEnv: ScanResult } {
  const {
    imports,
    mentions,
    deletedGeneratedDirectives,
    directives,
    eslintEnv,
    declaresEslintConfigNext,
  } = fixAndCollectFileReferences(tree, removedPlugins);

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
  if (deletedGeneratedDirectives.length > 0) {
    nextSteps.push(
      `Deleted the "/* eslint-disable jsx-a11y/accessible-emoji */" comment Nx generated at the top of these files, because eslint-plugin-jsx-a11y was removed: ${deletedGeneratedDirectives.join(
        ', '
      )}.`
    );
  }
  if (directives.length > 0) {
    agentContext.push(
      `These source files carry ESLint directive comments naming rules from plugins this migration removed: ${formatUsages(
        directives
      )}. A directive naming a rule no config defines is itself a lint error, but another config, such as eslint-config-expo, can still register one of these plugins. ` +
        `Edit only the comments lint reports as "Definition for rule '...' was not found". Rewrite an "import/" prefix to "import-x/". Remove a "react/" or "jsx-a11y/" rule from an eslint-disable or eslint-enable list, delete the inline configuration of one, and delete a comment left with no rule. ` +
        'Before deleting a comment that is alone on its line, check the lines above it. An eslint-disable-next-line comment on the line directly above would then apply to the code below. So would a @ts-ignore comment with only blank lines or // comments between, because TypeScript skips those.'
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
  if (eslintEnv.length > 0) {
    agentContext.push(
      `These source files carry /* eslint-env */ comments: ${eslintEnv.join(
        ', '
      )}. ESLint v9 applied them only on eslintrc and warned about them on flat config; v10 reports each one as an error ("/* eslint-env */ comments are no longer supported"). ` +
        "Replace each with an equivalent /* global */ comment, or move the globals it declared into the covering flat config's languageOptions.globals, then delete the comment. " +
        'Deleting one without replacing what it declared can turn its globals into no-undef errors.'
    );
    nextSteps.push(
      `ESLint v10 reports /* eslint-env */ comments as errors; replace them with /* global */ comments or languageOptions.globals in: ${eslintEnv.join(
        ', '
      )}.`
    );
  }

  const eslintEnvResult: ScanResult =
    eslintEnv.length > 0 ? 'reported below' : 'none';
  // These scans only look for this run's removals, so a plugin an earlier run
  // or the user removed can still be referenced.
  if (removedPlugins.length === 0) {
    return {
      references: 'not run, this run removed no plugin',
      directives: 'not run, this run removed no plugin',
      eslintEnv: eslintEnvResult,
    };
  }
  return {
    references:
      imports.length > 0 || mentions.length > 0 ? 'reported below' : 'none',
    directives: declaresEslintConfigNext
      ? 'not run, eslint-config-next is declared'
      : directives.length > 0
        ? 'reported below'
        : 'none',
    eslintEnv: eslintEnvResult,
  };
}

type PluginUsage = { path: string; matched: string[] };

function formatUsages(usages: PluginUsage[]): string {
  return usages
    .map(({ path, matched }) => `${path} (${matched.join(', ')})`)
    .join('; ');
}

// The Expo and React Native welcome page Nx generates starts with this comment.
// jsx-a11y deprecated the rule and none of its presets enable it, so deleting
// the comment changes lint results only where a config enables the rule by name.
const GENERATED_JSX_A11Y_DIRECTIVE =
  /^\/\* eslint-disable jsx-a11y\/accessible-emoji \*\/\r?\n/;

// One walk for everything ESLint v10 can no longer resolve, including the
// /* eslint-env */ comments it turned from a warning into an error.
function fixAndCollectFileReferences(
  tree: Tree,
  plugins: readonly V9OnlyPlugin[]
): {
  imports: PluginUsage[];
  mentions: PluginUsage[];
  deletedGeneratedDirectives: string[];
  directives: PluginUsage[];
  eslintEnv: string[];
  declaresEslintConfigNext: boolean;
} {
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
      // A rule id (`"jsx-a11y/alt-text"`) or a config pulled in through
      // `extends` (`"plugin:jsx-a11y/recommended"`).
      jsonPrefixed: new RegExp(`['"](?:plugin:)?${escapeRegExp(prefix)}/`),
      // YAML leaves both unquoted, as a list item, a mapping key or a flow entry.
      yamlPrefixed: new RegExp(
        `[\\s\\[{,'"](?:plugin:)?${escapeRegExp(prefix)}/`
      ),
      // A rule id in a directive. `@eslint-react/` must not match `react/`.
      ruleId: new RegExp(`(?<![\\w@/.-])${escapeRegExp(prefix)}/`),
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
  const deletesGeneratedDirective =
    checkDirectives && plugins.includes('eslint-plugin-jsx-a11y');
  const imports: PluginUsage[] = [];
  const deletedGeneratedDirectives: string[] = [];
  const directives: PluginUsage[] = [];
  const eslintEnv: string[] = [];
  for (const path of sourceFiles) {
    let content = tree.read(path, 'utf-8');
    // Every form this scan looks for spells out `eslint`, so nothing else is
    // worth parsing.
    if (!content?.includes('eslint')) {
      continue;
    }
    if (
      deletesGeneratedDirective &&
      GENERATED_JSX_A11Y_DIRECTIVE.test(content)
    ) {
      content = content.replace(GENERATED_JSX_A11Y_DIRECTIVE, '');
      tree.write(path, content);
      deletedGeneratedDirectives.push(path);
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

    const reported = new Set<string>();
    let hasEslintEnv = false;
    for (const comment of collectComments(sourceFile)) {
      const directive = readDirective(content, comment);
      if (!directive) {
        continue;
      }
      if (directive.label === 'eslint-env') {
        hasEslintEnv = true;
        continue;
      }
      if (!checkDirectives || !RULE_DIRECTIVES.has(directive.label)) {
        continue;
      }
      for (const { prefix, ruleId } of matchers) {
        if (ruleId.test(directive.value)) {
          reported.add(prefix);
        }
      }
    }

    if (reported.size > 0) {
      directives.push({ path, matched: [...reported] });
    }
    if (hasEslintEnv) {
      eslintEnv.push(path);
    }
  }

  return {
    imports,
    mentions,
    deletedGeneratedDirectives,
    directives,
    eslintEnv,
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

// ESLint's directive grammar (`parseDirective` in @eslint/plugin-kit): the label
// is the first word of the text before a ` -- ` justification.
const DIRECTIVE_JUSTIFICATION = /\s-{2,}\s/;
const DIRECTIVE_LABEL = /^([a-z]+(?:-[a-z]+)*)(?:\s|$)/;
// The directives that name rule ids: inline configuration and the
// disable/enable lists.
const RULE_DIRECTIVES = new Set([
  'eslint',
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

function readDirective(
  content: string,
  { kind, pos, end }: ts.CommentRange
): { label: string; value: string } | undefined {
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

  return { label, value: directive.slice(label.length).trim() };
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
): ScanResult {
  if (!tree.exists('package.json')) {
    return 'not run, the workspace root has no package.json';
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
    return 'not run, eslint does not resolve from the workspace root';
  }
  // Every peer range read below comes from node_modules, so the scan only answers
  // for a tree the install has already updated. When package.json is ahead of
  // what is installed (`nx migrate --run-migrations --skipInstall`), the ranges
  // it would read are the pre-migration ones and the verdict would be worthless.
  if (isInstallBehindDeclaredRange(tree, 'eslint', eslintVersion)) {
    agentContext.push(
      `The check for ESLint plugins without a v10 release did not run: it reads each plugin's peerDependencies from node_modules, which still holds ESLint ${eslintVersion.version}. ` +
        'Install the updated dependencies before linting, and treat a plugin that throws at lint time as a version problem rather than a rule violation.'
    );
    nextSteps.push(
      `Skipped the check for ESLint plugins that declare no v10 support, because node_modules still holds ESLint ${eslintVersion.version}. Install the updated dependencies, then run lint.`
    );
    return `not run, node_modules still holds ESLint ${eslintVersion.version}`;
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
    const installedVersion = readInstalledVersion(name);
    if (
      installedVersion &&
      isInstallBehindDeclaredRange(tree, name, installedVersion)
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
    return 'none';
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
  return 'reported below';
}

// A specifier that is not a range, such as `workspace:*`, says nothing about
// what should be installed.
function isInstallBehindDeclaredRange(
  tree: Tree,
  name: string,
  installed: SemVer
): boolean {
  const declared = getDependencyVersionFromPackageJson(tree, name);
  const floor = validRange(declared) ? minVersion(declared) : null;
  return floor !== null && gt(floor, installed);
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
// range that allows an unsupported Node or, when it declares none, when the
// Node running the migration is too old.
function reportNodeVersionRequirement(tree: Tree, nextSteps: string[]): string {
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

  if (!declaredRange) {
    return 'not declared';
  }
  return isSupported
    ? `"${declaredRange}", which ESLint v10 supports`
    : `"${declaredRange}", which allows Node.js versions ESLint v10 rejects`;
}

function isSubsetOfSupportedNodeRange(range: string): boolean {
  try {
    return subset(range, ESLINT_V10_NODE_RANGE);
  } catch {
    // An unparseable range cannot be cleared, so surface the requirement.
    return false;
  }
}
