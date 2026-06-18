import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  getDependencyVersionFromPackageJson,
  getProjects,
  installPackagesTask,
  logger,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readNxJson,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { InputDefinition } from 'nx/src/config/workspace-json-project-json';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { findEslintFile } from '../utils/eslint-file';
import { hasEslintPlugin } from '../utils/plugin';
import { basename, join } from 'path';
import { assertSupportedEslintVersion } from '../../utils/assert-supported-eslint-version';
import {
  eslintConfigPrettierVersion,
  eslintrcVersion,
  eslintVersion,
  typescriptESLintVersion,
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
  if (eslintFile.endsWith('.js')) {
    throw new Error(
      'Only json and yaml eslint config files are supported for conversion'
    );
  }

  options.eslintConfigFormat ??= 'mjs';

  const eslintIgnoreFiles = new Set<string>(['.eslintignore']);

  // convert root eslint config to eslint.config.cjs or eslint.base.config.mjs based on eslintConfigFormat
  convertRootToFlatConfig(
    tree,
    eslintFile,
    options.eslintConfigFormat,
    options.keepExistingVersions
  );

  // convert project eslint files to eslint.config.cjs
  const projects = getProjects(tree);
  for (const [project, projectConfig] of projects) {
    convertProjectToFlatConfig(
      tree,
      project,
      projectConfig,
      readNxJson(tree),
      eslintIgnoreFiles,
      options.eslintConfigFormat,
      options.keepExistingVersions
    );
  }

  // delete all .eslintignore files
  for (const ignoreFile of eslintIgnoreFiles) {
    tree.delete(ignoreFile);
  }

  // replace references in nx.json and project.json files
  updateNxJsonConfig(tree, options.eslintConfigFormat);
  updateProjectConfigsInputs(tree, options.eslintConfigFormat);
  // install missing packages

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => installPackagesTask(tree);
}

export default convertToFlatConfigGenerator;

function convertRootToFlatConfig(
  tree: Tree,
  eslintFile: string,
  format: 'cjs' | 'mjs',
  keepExistingVersions?: boolean
) {
  if (/\.base\.(js|json|yml|yaml)$/.test(eslintFile)) {
    convertConfigToFlatConfig(
      tree,
      '',
      eslintFile,
      `eslint.base.config.${format}`,
      format,
      undefined,
      keepExistingVersions
    );
  }
  // A workspace can ship `.eslintrc.base.json` without a sibling root config, so
  // only convert the non-base root config when it actually exists.
  const rootEslintFile = eslintFile.replace('.base.', '.');
  if (tree.exists(rootEslintFile)) {
    convertConfigToFlatConfig(
      tree,
      '',
      rootEslintFile,
      `eslint.config.${format}`,
      format,
      undefined,
      keepExistingVersions
    );
  }
}

const ESLINT_LINT_EXECUTOR = '@nx/eslint:lint';

function isEslintTarget(target: { executor?: string; command?: string }) {
  return (
    target.executor === ESLINT_LINT_EXECUTOR ||
    target.command?.includes('eslint')
  );
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

function convertProjectToFlatConfig(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration,
  nxJson: NxJsonConfiguration,
  eslintIgnoreFiles: Set<string>,
  format: 'cjs' | 'mjs',
  keepExistingVersions?: boolean
) {
  const eslintFile = findEslintFile(tree, projectConfig.root);
  if (!eslintFile) {
    return;
  }
  if (eslintFile === '.eslintrc.js' || eslintFile === '.eslintrc.cjs') {
    logger.warn(
      `Skipping "${project}": ${eslintFile} is a JavaScript-based ESLint config, which cannot be converted automatically. Convert it to flat config manually.`
    );
    return;
  }
  if (eslintFile.endsWith('.js')) {
    // Already on a JavaScript-based flat config (eslint.config.js); nothing to convert.
    return;
  }

  // Clean up obsolete target options and detect explicit ESLint targets
  let ignorePath: string | undefined;
  const eslintTargets = projectConfig.targets
    ? Object.keys(projectConfig.targets).filter((t) =>
        isEslintTarget(projectConfig.targets[t])
      )
    : [];
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
  const hasEslintTargetDefaults = hasMatchingEslintTargetDefault(
    projectConfig,
    nxJson.targetDefaults
  );

  if (
    eslintTargets.length === 0 &&
    !hasEslintTargetDefaults &&
    !hasEslintPlugin(tree)
  ) {
    logger.warn(
      `Skipping "${project}": found ${eslintFile} but no ESLint lint target detected. Convert manually if needed.`
    );
    return;
  }

  convertConfigToFlatConfig(
    tree,
    projectConfig.root,
    eslintFile,
    `eslint.config.${format}`,
    format,
    ignorePath,
    keepExistingVersions
  );
  eslintIgnoreFiles.add(`${projectConfig.root}/.eslintignore`);
  if (ignorePath) {
    eslintIgnoreFiles.add(ignorePath);
  }
}

// Rewrites input entries that reference legacy `.eslintrc[.base].json` / `.eslintignore`
// files to their flat-config counterparts, then dedupes so the rewrite doesn't produce
// duplicates of entries that already pointed at the flat config. Leaves non-string /
// non-fileset inputs (runtime/env/dependentTasksOutputFiles/etc.) untouched.
function rewriteLegacyInputs(
  inputs: Array<string | InputDefinition>,
  format: 'cjs' | 'mjs'
): Array<string | InputDefinition> {
  const seenStrings = new Set<string>();
  const result: Array<string | InputDefinition> = [];
  for (const entry of inputs) {
    if (typeof entry === 'string') {
      const rewritten = renameLegacyEslintrcFile(entry, format);
      if (seenStrings.has(rewritten)) continue;
      seenStrings.add(rewritten);
      result.push(rewritten);
    } else if ('fileset' in entry) {
      const rewritten = renameLegacyEslintrcFile(entry.fileset, format);
      // Preserve the original reference when nothing changed so downstream identity
      // checks (e.g. `inputsEqual`) don't see a spurious mutation.
      result.push(
        rewritten === entry.fileset ? entry : { ...entry, fileset: rewritten }
      );
    } else {
      result.push(entry);
    }
  }
  return result;
}

// Adds `value` to `inputs` (after rewriting) when the rewritten set doesn't already contain it.
function ensureInputPresent(
  inputs: Array<string | InputDefinition>,
  value: string,
  format: 'cjs' | 'mjs'
): Array<string | InputDefinition> {
  const rewritten = rewriteLegacyInputs(inputs, format);
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
            format
          )
        : rewriteLegacyInputs(target.inputs, format);
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
                format
              )
            : rewriteLegacyInputs(inputs, format);
      }
    }
    return json;
  });
}

// Walks every project's `targets.*.inputs` and `namedInputs.*`, rewriting stale references.
function updateProjectConfigsInputs(tree: Tree, format: 'cjs' | 'mjs') {
  for (const [project, projectConfig] of getProjects(tree)) {
    let changed = false;
    if (projectConfig.targets) {
      for (const target of Object.values(projectConfig.targets)) {
        if (!target.inputs) continue;
        const rewritten = rewriteLegacyInputs(target.inputs, format);
        if (!inputsEqual(target.inputs, rewritten)) {
          target.inputs = rewritten;
          changed = true;
        }
      }
    }
    if (projectConfig.namedInputs) {
      for (const [name, inputs] of Object.entries(projectConfig.namedInputs)) {
        const rewritten = rewriteLegacyInputs(inputs, format);
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
  root: string,
  source: string,
  target: string,
  format: 'cjs' | 'mjs',
  ignorePath?: string,
  keepExistingVersions?: boolean
) {
  const ignorePaths = ignorePath
    ? [ignorePath, `${root}/.eslintignore`]
    : [`${root}/.eslintignore`];

  // `.eslintrc` (no extension) is JSON by convention.
  if (source.endsWith('.json') || basename(source) === '.eslintrc') {
    const config: ESLint.ConfigData = readJson(tree, `${root}/${source}`);
    const conversionResult = convertEslintJsonToFlatConfig(
      tree,
      root,
      config,
      ignorePaths,
      format
    );
    return processConvertedConfig(
      tree,
      root,
      source,
      target,
      conversionResult,
      keepExistingVersions
    );
  }
  if (source.endsWith('.yaml') || source.endsWith('.yml')) {
    const originalContent = tree.read(`${root}/${source}`, 'utf-8');
    const { load } = require('@zkochan/js-yaml');
    const config = load(originalContent, {
      json: true,
      filename: source,
    }) as ESLint.ConfigData;
    const conversionResult = convertEslintJsonToFlatConfig(
      tree,
      root,
      config,
      ignorePaths,
      format
    );
    return processConvertedConfig(
      tree,
      root,
      source,
      target,
      conversionResult,
      keepExistingVersions
    );
  }
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

  // Once converted to flat config, the workspace should use the latest ESLint
  // stack. Install the versions directly instead of routing through
  // `versions(tree)`, which keys off the pre-conversion declared ESLint version.
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

  // Direct invocation is an opt-in upgrade, so by default existing pins are
  // overwritten to land the workspace on the latest flat-config-ready stack.
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
