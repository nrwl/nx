import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  getDependencyVersionFromPackageJson,
  getProjects,
  installPackagesTask,
  joinPathFragments,
  logger,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readNxJson,
  TargetConfiguration,
  TargetDefaultArrayEntry,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { findEslintFile } from '../utils/eslint-file';
import { hasEslintPlugin } from '../utils/plugin';
import { basename, join } from 'path';
import { assertSupportedEslintVersion } from '../../utils/assert-supported-eslint-version';
import {
  eslintConfigPrettierVersion,
  eslintrcVersion,
  getConvertToFlatConfigVersions,
} from '../../utils/versions';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  ESLINT_FLAT_CONFIG_FILENAMES,
} from '../../utils/config-file';
import { ESLint } from 'eslint';
import {
  convertEslintJsonToFlatConfig,
  renameLegacyEslintrcFile,
} from './converters/json-converter';
import {
  JS_ESLINTRC_FILENAMES,
  readStaticJsEslintrcFromTree,
} from './converters/static-js-config';
import {
  migrateAngularEslintV22FlatConfig,
  resolveAngularEslintVersion,
} from './angular-eslint';
import { type InputDefinition } from '@nx/devkit/internal';
import {
  ESLINT_LINT_EXECUTOR,
  findEslintrcOnlyTargetOptions,
  getEslintPluginTargetNames,
  isEslintTarget,
  isInferredEslintTargetOverride,
  isPluginScopedTargetDefault,
} from './eslintrc-only-target-options';

export async function convertToFlatConfigGenerator(
  tree: Tree,
  options: ConvertToFlatConfigGeneratorSchema
): Promise<void | GeneratorCallback> {
  assertSupportedEslintVersion(tree);

  // Already on flat config at the root? There is nothing to convert.
  const hasRootFlatConfig = [
    ...ESLINT_FLAT_CONFIG_FILENAMES,
    ...BASE_ESLINT_CONFIG_FILENAMES,
  ].some((file) => tree.exists(file));
  if (hasRootFlatConfig) {
    return;
  }

  const eslintFile = findEslintFile(tree);
  if (!eslintFile) {
    throw new Error('Could not find root eslint file');
  }
  if (JS_ESLINTRC_FILENAMES.includes(eslintFile)) {
    const result = readStaticJsEslintrcFromTree(tree, '', eslintFile);
    if (result.kind === 'unsupported') {
      throw new Error(
        `Cannot convert "${eslintFile}" automatically because ${result.reason}. Convert it to flat config manually.`
      );
    }
  }

  options.eslintConfigFormat ??= 'mjs';

  const rootConversions = planRootConversions(
    tree,
    eslintFile,
    options.eslintConfigFormat
  );
  const nxJson = readNxJson(tree);
  const projectPlans = [...getProjects(tree)].map(
    ([project, projectConfig]) => ({
      project,
      projectConfig,
      plan: planProjectConversion(
        tree,
        project,
        projectConfig,
        nxJson,
        rootConversions,
        options.eslintConfigFormat
      ),
    })
  );
  const convertedEslintrcFiles = new Set(
    [
      ...rootConversions,
      ...projectPlans.flatMap(({ plan }) =>
        plan.kind === 'convert' ? [plan.conversion] : []
      ),
    ].map(({ root, source }) => joinPathFragments(root, source))
  );

  const eslintIgnoreFiles = new Set<string>(['.eslintignore']);
  const targetDefaultIgnorePaths = findTargetDefaultIgnorePaths(tree);

  for (const conversion of rootConversions) {
    convertConfigToFlatConfig(
      tree,
      conversion,
      options.eslintConfigFormat,
      [...targetDefaultIgnorePaths.values()],
      convertedEslintrcFiles,
      options.keepExistingVersions
    );
  }
  removeEslintrcOnlyTargetDefaultOptions(tree, targetDefaultIgnorePaths);
  for (const ignorePath of targetDefaultIgnorePaths.values()) {
    eslintIgnoreFiles.add(ignorePath);
  }

  for (const { project, projectConfig, plan } of projectPlans) {
    switch (plan.kind) {
      case 'convert':
        convertProjectToFlatConfig(
          tree,
          project,
          projectConfig,
          readNxJson(tree),
          plan.conversion,
          eslintIgnoreFiles,
          options.eslintConfigFormat,
          convertedEslintrcFiles,
          options.keepExistingVersions
        );
        break;
      case 'flat':
        // The project lints with a flat config: its own, or the root one from here on.
        removeEslintrcOnlyTargetOptions(
          tree,
          project,
          projectConfig,
          readNxJson(tree),
          new Map()
        );
        break;
      case 'skip':
        logger.warn(plan.reason);
        break;
      default: {
        const unhandled: never = plan;
        throw new Error(
          `Unhandled conversion plan: ${JSON.stringify(unhandled)}`
        );
      }
    }
  }

  // Flat config never reads an ignore file. Keep one another tool may read,
  // such as .gitignore, or one a remaining `ignore-path` still names.
  const referencedIgnoreFiles = findReferencedIgnoreFiles(tree);
  for (const ignoreFile of eslintIgnoreFiles) {
    if (
      basename(ignoreFile).includes('eslintignore') &&
      !referencedIgnoreFiles.has(joinPathFragments(ignoreFile))
    ) {
      tree.delete(ignoreFile);
    }
  }

  // replace references in nx.json and project.json files
  updateNxJsonConfig(tree, options.eslintConfigFormat);
  updateProjectConfigsInputs(tree, options.eslintConfigFormat);

  // The converter carries angular-eslint's removed eslintrc configs over as
  // FlatCompat shims; on v22 those no longer resolve, so reconcile them to the
  // flat-native config before formatting (no-op below v22).
  await migrateAngularEslintV22FlatConfig(tree);

  const leftover = findEslintrcOnlyTargetOptions(tree);
  if (leftover.length > 0) {
    logger.warn(
      `These lint targets still carry ESLint options that flat config does not support: ${leftover.join('; ')}. ` +
        'ESLint rejects "ignore-path", "no-eslintrc" and "resolve-plugins-relative-to" as invalid options. "rulesdir" never reaches ESLint, because the task does not pass a list option on, so the rules in that directory are not loaded. ' +
        'Move the patterns of an "ignore-path" file into the flat config\'s "ignores" only when no configuration, project or narrower "targetDefaults" entry replaces that "ignore-path". Otherwise pass them as "--ignore-pattern" flags in the "args" of the runs that used the file, because flat config "ignores" apply to every run. ' +
        'Load the "rulesdir" rules through a local plugin, pass a "resolve-plugins-relative-to" directory to FlatCompat as "resolvePluginsRelativeTo", and delete "no-eslintrc".'
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => installPackagesTask(tree);
}

export default convertToFlatConfigGenerator;

interface EslintrcConversion {
  root: string;
  source: string;
  target: string;
  config: ESLint.ConfigData;
}

type ProjectConversionPlan =
  | { kind: 'convert'; conversion: EslintrcConversion }
  | { kind: 'flat' }
  | { kind: 'skip'; reason: string };

function planRootConversions(
  tree: Tree,
  eslintFile: string,
  format: 'cjs' | 'mjs'
): EslintrcConversion[] {
  // Every generated config extends the root one, so a root config that holds
  // nothing cannot be skipped the way a project's can: the conversion would
  // leave every project pointing at a file that was never written.
  const planRoot = (source: string, target: string): EslintrcConversion => {
    const config = readEslintrcConfig(tree, '', source);
    if (!config) {
      throw new Error(
        `Cannot convert "${source}": it does not hold an ESLint configuration. Delete it or convert it to flat config manually.`
      );
    }
    return { root: '', source, target, config };
  };

  const conversions: EslintrcConversion[] = [];
  if (/\.base\.(js|json|yml|yaml)$/.test(eslintFile)) {
    conversions.push(planRoot(eslintFile, `eslint.base.config.${format}`));
  }
  // A workspace can ship `.eslintrc.base.json` without a sibling root config, so
  // only convert the non-base root config when it actually exists.
  const rootEslintFile = eslintFile.replace('.base.', '.');
  if (tree.exists(rootEslintFile)) {
    conversions.push(planRoot(rootEslintFile, `eslint.config.${format}`));
  }
  return conversions;
}

function hasMatchingEslintTargetDefault(
  projectConfig: ProjectConfiguration,
  targetDefaults: NxJsonConfiguration['targetDefaults']
): boolean {
  if (!projectConfig.targets || !targetDefaults) {
    return false;
  }

  return Object.entries(targetDefaults).some(([targetName, value]) => {
    if (projectConfig.targets[targetName] === undefined) {
      return false;
    }
    if (targetName === ESLINT_LINT_EXECUTOR) {
      return true;
    }
    // A target default value can be a plain config object or an array of
    // filtered entries; match against the filter-less (catch-all) entry.
    const targetConfig = Array.isArray(value)
      ? value.find((e) => e.filter === undefined)
      : value;
    return targetConfig ? isEslintTarget(targetConfig) : false;
  });
}

function planProjectConversion(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration,
  nxJson: NxJsonConfiguration,
  rootConversions: EslintrcConversion[],
  format: 'cjs' | 'mjs'
): ProjectConversionPlan {
  const eslintFile = findEslintFile(tree, projectConfig.root);
  if (
    !eslintFile ||
    ESLINT_FLAT_CONFIG_FILENAMES.includes(eslintFile) ||
    // A root project's eslintrc is the root config, which converts on its own.
    rootConversions.some(
      ({ source }) =>
        source === joinPathFragments(projectConfig.root, eslintFile)
    )
  ) {
    return { kind: 'flat' };
  }
  // `findEslintFile` returns an eslintrc ahead of a flat config in the same directory.
  const flatFile = ESLINT_FLAT_CONFIG_FILENAMES.find((file) =>
    tree.exists(joinPathFragments(projectConfig.root, file))
  );
  if (flatFile) {
    return {
      kind: 'skip',
      reason: `Skipping "${project}": it has both ${eslintFile} and ${flatFile}. Keep the configuration the project needs in ${flatFile} and delete ${eslintFile}.`,
    };
  }
  if (JS_ESLINTRC_FILENAMES.includes(eslintFile)) {
    const result = readStaticJsEslintrcFromTree(
      tree,
      projectConfig.root,
      eslintFile
    );
    if (result.kind === 'unsupported') {
      return {
        kind: 'skip',
        reason: `Skipping "${project}": ${eslintFile} is a JavaScript-based ESLint config that cannot be converted automatically because ${result.reason}. Convert it to flat config manually.`,
      };
    }
  }

  if (
    getEslintTargetNames(projectConfig).length === 0 &&
    !hasMatchingEslintTargetDefault(projectConfig, nxJson.targetDefaults) &&
    !hasEslintPlugin(tree)
  ) {
    return {
      kind: 'skip',
      reason: `Skipping "${project}": found ${eslintFile} but no ESLint lint target detected. Convert manually if needed.`,
    };
  }

  const config = readEslintrcConfig(tree, projectConfig.root, eslintFile);
  if (!config) {
    // An empty or comment-only file parses to nothing. It carries no rules, so
    // there is nothing to convert, but leaving it behind silently would hide it.
    return {
      kind: 'skip',
      reason: `Skipping "${projectConfig.root}/${eslintFile}": it does not hold an ESLint configuration. Delete it or convert it to flat config manually.`,
    };
  }
  return {
    kind: 'convert',
    conversion: {
      root: projectConfig.root,
      source: eslintFile,
      target: `eslint.config.${format}`,
      config,
    },
  };
}

function getEslintTargetNames(projectConfig: ProjectConfiguration): string[] {
  return Object.keys(projectConfig.targets ?? {}).filter((t) =>
    isEslintTarget(projectConfig.targets[t])
  );
}

function convertProjectToFlatConfig(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration,
  nxJson: NxJsonConfiguration,
  conversion: EslintrcConversion,
  eslintIgnoreFiles: Set<string>,
  format: 'cjs' | 'mjs',
  convertedEslintrcFiles: ReadonlySet<string>,
  keepExistingVersions?: boolean
) {
  // Clean up obsolete target options
  let ignorePath: string | undefined;
  const eslintTargets = getEslintTargetNames(projectConfig);
  for (const target of eslintTargets) {
    if (projectConfig.targets[target].options?.eslintConfig) {
      delete projectConfig.targets[target].options.eslintConfig;
    }
    if (projectConfig.targets[target].options?.ignorePath) {
      ignorePath = projectConfig.targets[target].options.ignorePath;
      delete projectConfig.targets[target].options.ignorePath;
    }
  }
  if (eslintTargets.length > 0) {
    updateProjectConfiguration(tree, project, projectConfig);
  }

  const inferredTargetIgnorePaths = findInferredTargetIgnorePaths(
    tree,
    projectConfig,
    nxJson
  );
  convertConfigToFlatConfig(
    tree,
    conversion,
    format,
    [
      ...(ignorePath ? [ignorePath] : []),
      ...inferredTargetIgnorePaths.values(),
    ],
    convertedEslintrcFiles,
    keepExistingVersions
  );
  // Only once the config is gone: flat config never reads .eslintignore, but an
  // eslintrc that is still there does.
  eslintIgnoreFiles.add(`${projectConfig.root}/.eslintignore`);
  if (ignorePath) {
    eslintIgnoreFiles.add(ignorePath);
  }
  for (const ignoreFile of inferredTargetIgnorePaths.values()) {
    eslintIgnoreFiles.add(ignoreFile);
  }
  removeEslintrcOnlyTargetOptions(
    tree,
    project,
    projectConfig,
    nxJson,
    inferredTargetIgnorePaths
  );
}

// The executor conversion copied `ignore-path` verbatim, so it may be relative
// to the project root, where the inferred target runs, or to the workspace
// root, where the executor ran. One a configuration replaces stays put.
function findInferredTargetIgnorePaths(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  nxJson: NxJsonConfiguration
): Map<string, string> {
  const pluginTargetNames = getEslintPluginTargetNames(nxJson);
  const ignorePaths = new Map<string, string>();
  for (const [targetName, target] of Object.entries(
    projectConfig.targets ?? {}
  )) {
    const value = target.options?.['ignore-path'];
    if (
      typeof value !== 'string' ||
      target.options.cwd !== undefined ||
      !isInferredEslintTargetOverride(targetName, target, pluginTargetNames) ||
      setsConfigurationIgnorePath(target) ||
      getPluginScopedTargetDefaults(nxJson, targetName).some(
        setsConfigurationIgnorePath
      )
    ) {
      continue;
    }
    const resolved = [joinPathFragments(projectConfig.root, value), value].find(
      (candidate) => tree.exists(candidate)
    );
    if (resolved) {
      ignorePaths.set(targetName, resolved);
    }
  }
  return ignorePaths;
}

function removeEslintrcOnlyTargetOptions(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration,
  nxJson: NxJsonConfiguration,
  foldedIgnorePaths: Map<string, string>
) {
  const pluginTargetNames = getEslintPluginTargetNames(nxJson);
  let changed = false;
  for (const [targetName, target] of Object.entries(
    projectConfig.targets ?? {}
  )) {
    if (
      !isInferredEslintTargetOverride(targetName, target, pluginTargetNames)
    ) {
      continue;
    }
    for (const options of [
      target.options,
      ...Object.values(target.configurations ?? {}),
    ]) {
      if (options?.['no-eslintrc'] !== undefined) {
        delete options['no-eslintrc'];
        changed = true;
      }
    }
    if (foldedIgnorePaths.has(targetName)) {
      delete target.options['ignore-path'];
      changed = true;
    }
  }
  if (changed) {
    updateProjectConfiguration(tree, project, projectConfig);
  }
}

// A hoisted `ignore-path` holds the executor's workspace-relative path. Like the
// root `.eslintignore`, it goes into the root config, so only when no narrower
// entry, configuration or project sets another `ignore-path` for the target.
function findTargetDefaultIgnorePaths(tree: Tree): Map<string, string> {
  const ignorePaths = new Map<string, string>();
  if (!tree.exists('nx.json')) {
    return ignorePaths;
  }
  const nxJson: NxJsonConfiguration = readJson(tree, 'nx.json');
  const pluginTargetNames = getEslintPluginTargetNames(nxJson);
  const projects = [...getProjects(tree).values()];
  for (const targetName of Object.keys(nxJson.targetDefaults ?? {})) {
    const entries = getPluginScopedTargetDefaults(nxJson, targetName);
    const setting = entries.filter((entry) => setsIgnorePath(entry.options));
    const ignorePath = setting[0]?.options['ignore-path'];
    if (
      !pluginTargetNames.has(targetName) ||
      setting.length !== 1 ||
      !isWorkspaceWidePluginTargetDefault(setting[0]) ||
      typeof ignorePath !== 'string' ||
      !tree.exists(ignorePath) ||
      entries.some(setsConfigurationIgnorePath) ||
      projects.some((project) => {
        const target = project.targets?.[targetName];
        return (
          target !== undefined &&
          isInferredEslintTargetOverride(
            targetName,
            target,
            pluginTargetNames
          ) &&
          (setsIgnorePath(target.options) ||
            setsConfigurationIgnorePath(target))
        );
      })
    ) {
      continue;
    }
    ignorePaths.set(targetName, ignorePath);
  }
  return ignorePaths;
}

function removeEslintrcOnlyTargetDefaultOptions(
  tree: Tree,
  foldedIgnorePaths: Map<string, string>
) {
  if (!tree.exists('nx.json')) {
    return;
  }
  updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
    for (const targetName of Object.keys(json.targetDefaults ?? {})) {
      for (const entry of getPluginScopedTargetDefaults(json, targetName)) {
        for (const options of [
          entry.options,
          ...Object.values(entry.configurations ?? {}),
        ]) {
          delete options?.['no-eslintrc'];
        }
        if (
          foldedIgnorePaths.has(targetName) &&
          setsIgnorePath(entry.options)
        ) {
          delete entry.options['ignore-path'];
        }
      }
    }
    return json;
  });
}

// The files a remaining `ignore-path` may name, under either base it can be
// relative to.
function findReferencedIgnoreFiles(tree: Tree): Set<string> {
  const referenced = new Set<string>();
  const collect = (root: string, target: Partial<TargetConfiguration>) => {
    for (const options of [
      target.options,
      ...Object.values(target.configurations ?? {}),
    ]) {
      const value = options?.['ignore-path'];
      if (typeof value === 'string') {
        referenced.add(joinPathFragments(root, value));
        referenced.add(joinPathFragments(value));
      }
    }
  };
  for (const [, projectConfig] of getProjects(tree)) {
    for (const target of Object.values(projectConfig.targets ?? {})) {
      collect(projectConfig.root, target);
    }
  }
  for (const value of Object.values(readNxJson(tree)?.targetDefaults ?? {})) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      collect('', entry);
    }
  }
  return referenced;
}

function getPluginScopedTargetDefaults(
  nxJson: NxJsonConfiguration,
  targetName: string
): TargetDefaultArrayEntry[] {
  const value = nxJson.targetDefaults?.[targetName];
  return Array.isArray(value) ? value.filter(isPluginScopedTargetDefault) : [];
}

function setsIgnorePath(options: Record<string, unknown> | undefined): boolean {
  return options?.['ignore-path'] !== undefined;
}

function setsConfigurationIgnorePath(
  target: Partial<TargetConfiguration>
): boolean {
  return Object.values(target.configurations ?? {}).some(setsIgnorePath);
}

function isWorkspaceWidePluginTargetDefault(
  entry: TargetDefaultArrayEntry
): boolean {
  return (
    isPluginScopedTargetDefault(entry) && Object.keys(entry.filter).length === 1
  );
}

interface InputRewriteContext {
  tree: Tree;
  format: 'cjs' | 'mjs';
  // The roots `{projectRoot}` stands for: one project's, or every project's in nx.json.
  projectRoots: readonly string[];
  // Every project's root: without a project graph, a dependency input may reach any of them.
  dependencyRoots: readonly string[];
}

// Rewrites input entries that reference legacy eslintrc / `.eslintignore`
// files to their flat-config counterparts, then dedupes so the rewrite doesn't produce
// duplicates of entries that already pointed at the flat config. Leaves non-string /
// non-fileset inputs (runtime/env/dependentTasksOutputFiles/etc.) untouched.
function rewriteLegacyInputs(
  inputs: Array<string | InputDefinition>,
  context: InputRewriteContext
): Array<string | InputDefinition> {
  const seenStrings = new Set<string>();
  const result: Array<string | InputDefinition> = [];
  for (const entry of inputs) {
    if (typeof entry === 'string') {
      // Nx reads `^{projectRoot}/...` and `^{workspaceRoot}/...` as dependency filesets.
      const roots = entry.startsWith('^')
        ? context.dependencyRoots
        : context.projectRoots;
      for (const rewritten of rewriteLegacyPattern(entry, roots, context)) {
        if (seenStrings.has(rewritten)) continue;
        seenStrings.add(rewritten);
        result.push(rewritten);
      }
    } else if ('fileset' in entry) {
      const roots =
        'dependencies' in entry && entry.dependencies
          ? context.dependencyRoots
          : context.projectRoots;
      for (const rewritten of rewriteLegacyPattern(
        entry.fileset,
        roots,
        context
      )) {
        // Preserve the original reference when nothing changed so downstream identity
        // checks (e.g. `inputsEqual`) don't see a spurious mutation.
        result.push(
          rewritten === entry.fileset ? entry : { ...entry, fileset: rewritten }
        );
      }
    } else {
      result.push(entry);
    }
  }
  return result;
}

// A pattern keeps its original form while a file it names is still in the tree, so
// task hashes keep covering that file. It also takes the flat-config name when a root
// without that file has a flat config, converted now or before, and takes only that
// name when no file it names remains. A glob, which can match both kinds, gets both.
function rewriteLegacyPattern(
  pattern: string,
  roots: readonly string[],
  context: InputRewriteContext
): string[] {
  const renamed = renameLegacyEslintrcFile(pattern, context.format);
  if (renamed === pattern) {
    return [pattern];
  }
  const files = resolveLiteralFileset(pattern.replace(/^[!^]/, ''), roots);
  if (!files) {
    return [pattern, renamed];
  }
  if (!files.some((file) => context.tree.exists(file))) {
    return [renamed];
  }
  return files.some(
    (file) =>
      !context.tree.exists(file) &&
      context.tree.exists(renameLegacyEslintrcFile(file, context.format))
  )
    ? [pattern, renamed]
    : [pattern];
}

// Resolves a fileset that names one file under a root token to workspace paths.
// Returns undefined for a glob or a fileset without a leading root token.
function resolveLiteralFileset(
  fileset: string,
  projectRoots: readonly string[]
): string[] | undefined {
  const match = /^\{(projectRoot|workspaceRoot)\}\/(.+)$/.exec(fileset);
  if (!match || /[*?[\]{}()|]/.test(match[2])) {
    return undefined;
  }
  const [, token, path] = match;
  return token === 'workspaceRoot'
    ? [joinPathFragments(path)]
    : projectRoots.map((root) => joinPathFragments(root, path));
}

// Adds `value` to `inputs` (after rewriting) when the rewritten set doesn't already contain it.
function ensureInputPresent(
  inputs: Array<string | InputDefinition>,
  value: string,
  context: InputRewriteContext
): Array<string | InputDefinition> {
  const rewritten = rewriteLegacyInputs(inputs, context);
  if (!rewritten.some((entry) => entry === value)) {
    rewritten.push(value);
  }
  return rewritten;
}

// Updates nx.json: rewrites stale eslintrc/eslintignore references across all targetDefaults
// inputs and namedInputs, and ensures lint targets include the new flat config file as an input
// (and `production` excludes it). Handles both the legacy record shape and the new array shape
// of `targetDefaults`.
function updateNxJsonConfig(tree: Tree, format: 'cjs' | 'mjs') {
  if (!tree.exists('nx.json')) {
    return;
  }
  const allRoots = [...getProjects(tree).values()].map(({ root }) => root);
  const context: InputRewriteContext = {
    tree,
    format,
    projectRoots: allRoots,
    dependencyRoots: allRoots,
  };
  updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
    const rewriteTargetInputs = (
      target: Partial<TargetConfiguration>,
      isLintTarget: boolean
    ) => {
      if (!target.inputs) return;
      target.inputs = isLintTarget
        ? ensureInputPresent(
            target.inputs,
            `{workspaceRoot}/eslint.config.${format}`,
            context
          )
        : rewriteLegacyInputs(target.inputs, context);
    };
    if (json.targetDefaults) {
      for (const [name, value] of Object.entries(json.targetDefaults)) {
        const isLintTarget = name === 'lint' || name === ESLINT_LINT_EXECUTOR;
        // A target default value can be a plain config object or an array of
        // filtered entries; rewrite inputs on each entry in the array case.
        if (Array.isArray(value)) {
          for (const entry of value) {
            rewriteTargetInputs(entry, isLintTarget);
          }
        } else {
          rewriteTargetInputs(value, isLintTarget);
        }
      }
    }
    if (json.namedInputs) {
      for (const [name, inputs] of Object.entries(json.namedInputs)) {
        json.namedInputs[name] =
          name === 'production'
            ? ensureInputPresent(
                inputs,
                `!{projectRoot}/eslint.config.${format}`,
                context
              )
            : rewriteLegacyInputs(inputs, context);
      }
    }
    return json;
  });
}

// Walks every project's `targets.*.inputs` and `namedInputs.*`, rewriting stale references.
function updateProjectConfigsInputs(tree: Tree, format: 'cjs' | 'mjs') {
  const projects = getProjects(tree);
  const dependencyRoots = [...projects.values()].map(({ root }) => root);
  for (const [project, projectConfig] of projects) {
    const context: InputRewriteContext = {
      tree,
      format,
      projectRoots: [projectConfig.root],
      dependencyRoots,
    };
    let changed = false;
    if (projectConfig.targets) {
      for (const target of Object.values(projectConfig.targets)) {
        if (!target.inputs) continue;
        const rewritten = rewriteLegacyInputs(target.inputs, context);
        if (!inputsEqual(target.inputs, rewritten)) {
          target.inputs = rewritten;
          changed = true;
        }
      }
    }
    if (projectConfig.namedInputs) {
      for (const [name, inputs] of Object.entries(projectConfig.namedInputs)) {
        const rewritten = rewriteLegacyInputs(inputs, context);
        if (!inputsEqual(inputs, rewritten)) {
          projectConfig.namedInputs[name] = rewritten;
          changed = true;
        }
      }
    }
    if (changed) {
      updateProjectConfiguration(tree, project, projectConfig);
    }
  }
}

function inputsEqual(
  a: ReadonlyArray<string | InputDefinition>,
  b: ReadonlyArray<string | InputDefinition>
): boolean {
  return a.length === b.length && a.every((entry, i) => entry === b[i]);
}

function convertConfigToFlatConfig(
  tree: Tree,
  { root, source, target, config }: EslintrcConversion,
  format: 'cjs' | 'mjs',
  extraIgnorePaths: string[],
  convertedEslintrcFiles: ReadonlySet<string>,
  keepExistingVersions?: boolean
): void {
  const ignorePaths = [
    ...new Set([...extraIgnorePaths, joinPathFragments(root, '.eslintignore')]),
  ];

  const conversionResult = convertEslintJsonToFlatConfig(
    tree,
    root,
    config,
    ignorePaths,
    format,
    convertedEslintrcFiles
  );
  processConvertedConfig(
    tree,
    root,
    source,
    target,
    conversionResult,
    keepExistingVersions
  );
}

// JavaScript-based configs are read statically, never executed, so only the ones
// the caller already validated get this far.
function readEslintrcConfig(
  tree: Tree,
  root: string,
  source: string
): ESLint.ConfigData | null {
  // `.eslintrc` (no extension) is JSON by convention.
  if (source.endsWith('.json') || basename(source) === '.eslintrc') {
    return readJson(tree, `${root}/${source}`);
  }
  if (source.endsWith('.yaml') || source.endsWith('.yml')) {
    const { load } = require('@zkochan/js-yaml');
    return load(tree.read(`${root}/${source}`, 'utf-8'), {
      json: true,
      filename: source,
    }) as ESLint.ConfigData;
  }
  if (JS_ESLINTRC_FILENAMES.includes(source)) {
    const result = readStaticJsEslintrcFromTree(tree, root, source);
    return result.kind === 'config' ? result.config : null;
  }
  return null;
}

function processConvertedConfig(
  tree: Tree,
  root: string,
  source: string,
  target: string,
  {
    content,
    addESLintRC,
    addESLintJS,
  }: { content: string; addESLintRC: boolean; addESLintJS: boolean },
  keepExistingVersions?: boolean
) {
  // remove original config file
  tree.delete(join(root, source));

  // save new
  tree.write(join(root, target), content);

  // Conversion changes the config format, not the ESLint major. Resolve the
  // stack from the workspace's version so an existing v9 workspace stays on v9 (a
  // forced v10 bump strands v9-only plugins) and a v10 workspace is not
  // downgraded.
  const { eslintVersion, typescriptESLintVersion } =
    getConvertToFlatConfigVersions(tree);
  const devDependencies: Record<string, string> = {
    eslint: eslintVersion,
    'eslint-config-prettier': eslintConfigPrettierVersion,
    'typescript-eslint': typescriptESLintVersion,
    '@typescript-eslint/eslint-plugin': typescriptESLintVersion,
    '@typescript-eslint/parser': typescriptESLintVersion,
  };

  if (getDependencyVersionFromPackageJson(tree, '@typescript-eslint/utils')) {
    devDependencies['@typescript-eslint/utils'] = typescriptESLintVersion;
  }
  if (
    getDependencyVersionFromPackageJson(tree, '@typescript-eslint/type-utils')
  ) {
    devDependencies['@typescript-eslint/type-utils'] = typescriptESLintVersion;
  }

  // add missing packages
  if (addESLintRC) {
    devDependencies['@eslint/eslintrc'] = eslintrcVersion;
  }

  if (addESLintJS) {
    devDependencies['@eslint/js'] = eslintVersion;
  }

  // The flat/angular presets import the umbrella `angular-eslint` package; add
  // it when the converted config references them so the result resolves.
  if (content.includes('flat/angular')) {
    devDependencies['angular-eslint'] = resolveAngularEslintVersion(tree);
  }

  // Direct invocation is an opt-in conversion, so by default existing pins are
  // overwritten to land the workspace on the resolved flat-config-ready stack.
  // Migrations pass `keepExistingVersions` so the version bump stays owned by
  // `packageJsonUpdates` and only newly added packages are installed here.
  addDependenciesToPackageJson(
    tree,
    {},
    devDependencies,
    'package.json',
    keepExistingVersions
  );
}
