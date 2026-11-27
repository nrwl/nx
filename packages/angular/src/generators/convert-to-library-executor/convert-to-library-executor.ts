import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  installPackagesTask,
  logger,
  normalizePath,
  parseJson,
  readJson,
  readNxJson,
  readProjectConfiguration,
  removeDependenciesFromPackageJson,
  updateJson,
  updateProjectConfiguration,
  visitNotIgnoredFiles,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  addBuildTargetDefaults,
  mergeTargetConfigurations,
} from '@nx/devkit/internal';
import {
  createTreeParseConfigHost,
  ensureTypescript,
  extendsResolutionFailed,
  isEntryPointDirectoryExport,
  isLibraryBuilderEntryFile,
  resolveExportTarget,
  type TreeParseConfigHost,
} from '@nx/js/internal';
import {
  dirname as nativeDirname,
  isAbsolute,
  relative as nativeRelative,
  resolve,
  sep,
} from 'node:path';
import { basename, dirname, join, normalize, relative } from 'node:path/posix';
import { realpathSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { assertSupportedAngularVersion } from '../../utils/assert-supported-angular-version';
import { allTargetOptions } from '../../utils/targets';
import {
  acknowledgeAngularBuildScripts,
  acknowledgeLessBuildScripts,
} from '../utils/acknowledge-build-scripts';
import {
  findWorkspaceNgPackagrTargets,
  isSameRoot,
  libraryBuilderExecutors,
  libraryBuilderReplacements,
  ngPackagrExecutors,
  type NgPackagrTargetDeclaration,
} from '../utils/project';
import {
  findConfigFile,
  readRunOptions,
  readTargetDefaults,
  resolveNgPackagrProjectPath,
  resolveTokens,
  toWorkspacePath,
} from '../utils/ng-packagr-config';
import { validateProject } from '../utils/validations';
import {
  getAngularBuildVersionRange,
  supportsLibraryBuilder,
  versions,
} from '../utils/version-utils';
import type { GeneratorOptions } from './schema';

interface NgPackageConfig {
  dest?: string;
  assets?: unknown[];
  allowedNonPeerDependencies?: string[];
  inlineStyleLanguage?: string;
  keepLifecycleScripts?: boolean;
  deleteDestPath?: boolean;
  lib?: {
    entryFile?: string;
    styleIncludePaths?: string[];
    sass?: Record<string, unknown>;
  };
}

interface SecondaryEntryPoint {
  subpath: string;
  entryFile: string;
  configFile: string;
  config: NgPackageConfig | undefined;
}

interface NgPackagrLibrary {
  primaryConfigFile: string;
  config: NgPackageConfig | undefined;
  entryPointExports: Record<string, string>;
  secondaryEntryPoints: SecondaryEntryPoint[];
}

interface ConvertedProject {
  usesLess: boolean;
  ngPackagrConfigs: string[];
}

// Thrown before anything is written, so the library is skipped untouched.
class UnsupportedLibraryError extends Error {}

export async function convertToLibraryExecutor(
  tree: Tree,
  options: GeneratorOptions
) {
  assertSupportedAngularVersion(tree);
  if (!supportsLibraryBuilder(tree, {})) {
    throw new Error(
      'The library builder requires version 22.3.0 or later of "@angular/core" and "@angular/build". ' +
        'Update Angular before converting libraries.'
    );
  }

  const ngPackagrTargets = await findWorkspaceNgPackagrTargets(tree);
  const convertedProjects: ConvertedProject[] = [];
  if (options.project) {
    validateProject(tree, options.project);
    const result = convertProjectTarget(
      tree,
      options.project,
      ngPackagrTargets,
      true
    );
    if (result) {
      convertedProjects.push(result);
    }
  } else {
    for (const [projectName] of getProjects(tree)) {
      logger.info(`Converting project "${projectName}"...`);
      const result = convertProjectTarget(tree, projectName, ngPackagrTargets);

      if (result) {
        convertedProjects.push(result);
        logger.info(`Project "${projectName}" converted successfully.`);
      } else {
        logger.info(
          `Project "${projectName}" could not be converted. See above for more information.`
        );
      }
      logger.info('');
    }
  }

  if (convertedProjects.length) {
    const ngPackagrTargetsRemain =
      (await findWorkspaceNgPackagrTargets(tree)).length > 0;
    updateDependencies(
      tree,
      convertedProjects.some(({ usesLess }) => usesLess),
      ngPackagrTargetsRemain
    );
    const ngPackagrConfigs = new Set(
      convertedProjects.flatMap(({ ngPackagrConfigs }) => ngPackagrConfigs)
    );
    // Another ng-packagr target may read the configurations.
    if (ngPackagrTargetsRemain) {
      logKeptNgPackagrConfigs(ngPackagrConfigs);
    } else {
      for (const configFile of ngPackagrConfigs) {
        tree.delete(configFile);
      }
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return convertedProjects.length ? () => installPackagesTask(tree) : () => {};
}

function convertProjectTarget(
  tree: Tree,
  projectName: string,
  ngPackagrTargets: NgPackagrTargetDeclaration[],
  isProvidedProject = false
): ConvertedProject | null {
  const project = readProjectConfiguration(tree, projectName);
  if (project.projectType !== 'library') {
    if (isProvidedProject) {
      logger.warn(
        `The provided project "${projectName}" is not a library. Skipping conversion.`
      );
    }
    return null;
  }

  const targetName = getTargetToConvert(
    projectName,
    project.targets ?? {},
    isProvidedProject
  );
  if (!targetName) {
    return null;
  }

  const target = project.targets[targetName];
  const projectRoot = normalizeRelativePath(project.root);
  // The conversion rewrites the options the target ran with, including those
  // from target defaults, which may stop applying with the new executor.
  const previousDefaults = readTargetDefaults(
    tree,
    project,
    targetName,
    target.executor
  );
  if (previousDefaults?.options || previousDefaults?.configurations) {
    const { options, configurations } = mergeTargetConfigurations(target, {
      options: previousDefaults.options,
      configurations: previousDefaults.configurations,
    });
    target.options = options;
    target.configurations = configurations;
  }

  const ngPackagrExecutor = target.executor;
  const usesNxExecutor = ngPackagrExecutor.startsWith('@nx/angular:');
  const projectConfigFile = getProjectConfigFile(tree, projectRoot);
  const otherNgPackagrTargets = ngPackagrTargets.filter(
    ({ target, file, root }) =>
      target !== targetName ||
      file !== projectConfigFile ||
      !isSameRoot(root, projectRoot)
  );
  let library: NgPackagrLibrary;
  try {
    assertNoOtherNgPackagrTargets(
      projectRoot,
      projectConfigFile,
      otherNgPackagrTargets
    );
    library = readNgPackagrLibrary(tree, project, target);
    assertLibraryBuilderEntryPoints(
      tree,
      projectRoot,
      library.entryPointExports
    );
    const ngPackagrModes = readNgPackagrCompilationModes(tree, project, target);
    target.executor = libraryBuilderReplacements.get(ngPackagrExecutor);
    const inheritedDefaults = readConvertedTargetDefaults(
      tree,
      project,
      targetName,
      target.executor,
      usesNxExecutor
    );
    migrateTargetOptions(tree, target, projectRoot, library);
    assertRunOptions(target, inheritedDefaults, ngPackagrExecutor);
    keepCompilationModes(
      tree,
      project,
      target,
      inheritedDefaults,
      ngPackagrModes
    );
  } catch (e) {
    if (e instanceof UnsupportedLibraryError) {
      logger.warn(
        `Cannot convert project "${projectName}". ${e.message} Skipping conversion.`
      );
      return null;
    }
    throw e;
  }

  if (usesNxExecutor) {
    addBuildTargetDefaults(tree, '@nx/angular:library', targetName);
  }
  keepTargetDefaults(tree, project, targetName, target, previousDefaults);
  updateOutputs(target, project);
  updateProjectConfiguration(tree, projectName, project);
  // `updateProjectConfiguration` may have written package.json, so the exports
  // go into the updated file.
  updateLibraryPackageJson(
    tree,
    join(projectRoot, 'package.json'),
    library.entryPointExports
  );

  return {
    usesLess: usesLess(tree, project, target),
    ngPackagrConfigs: findRemovableNgPackagrConfigs(projectName, library),
  };
}

// `addBuildTargetDefaults` adds an unfiltered entry for the Nx executor when it
// has none, and that entry wins over the target name entries.
function readConvertedTargetDefaults(
  tree: Tree,
  project: ProjectConfiguration,
  targetName: string,
  executor: string,
  addsExecutorDefaults: boolean
): Partial<TargetConfiguration> | null {
  const targetDefaults = { ...readNxJson(tree)?.targetDefaults };
  if (addsExecutorDefaults) {
    const entries = targetDefaults[executor] ?? [];
    targetDefaults[executor] = [
      ...(Array.isArray(entries) ? entries : [entries]),
      {},
    ];
  }
  return readTargetDefaults(
    tree,
    project,
    targetName,
    executor,
    targetDefaults
  );
}

function assertRunOptions(
  target: TargetConfiguration,
  inheritedDefaults: Partial<TargetConfiguration> | null,
  ngPackagrExecutor: string
): void {
  const configurationNames = new Set([
    undefined,
    ...Object.keys(target.configurations ?? {}),
    ...Object.keys(inheritedDefaults?.configurations ?? {}),
  ]);
  for (const configurationName of configurationNames) {
    const run =
      configurationName === undefined
        ? 'the target'
        : `the "${configurationName}" configuration`;
    const options = readRunOptions(
      target,
      inheritedDefaults,
      configurationName
    );
    // The conversion removes `project` from the target, so it comes from target defaults.
    if (options['project'] !== undefined) {
      throw new UnsupportedLibraryError(
        `Target defaults set the "project" option for ${run}, and the library builder doesn't support it. ` +
          `Limit those target defaults to the "${ngPackagrExecutor}" executor or to the targets that use it.`
      );
    }
    if (typeof options['tsConfig'] !== 'string') {
      throw new UnsupportedLibraryError(
        `The library builder requires the "tsConfig" option, and ${run} doesn't set it.`
      );
    }
  }
}

// The conversion converts one target, in the file `updateProjectConfiguration`
// writes, so any other ng-packagr target of the project would stay.
function assertNoOtherNgPackagrTargets(
  projectRoot: string,
  projectConfigFile: string,
  otherNgPackagrTargets: NgPackagrTargetDeclaration[]
): void {
  const otherTarget = otherNgPackagrTargets.find(({ root }) =>
    isSameRoot(root, projectRoot)
  );
  if (otherTarget?.file === projectConfigFile) {
    throw new UnsupportedLibraryError(
      `The "${otherTarget.target}" target also uses ng-packagr.`
    );
  }
  if (otherTarget) {
    throw new UnsupportedLibraryError(
      `The "${otherTarget.target}" target in "${otherTarget.file}" also uses ng-packagr, and the conversion only updates "${projectConfigFile}".`
    );
  }
}

// The file `updateProjectConfiguration` writes.
function getProjectConfigFile(tree: Tree, projectRoot: string): string {
  const projectJsonPath = join(projectRoot, 'project.json');
  return tree.exists(projectJsonPath)
    ? projectJsonPath
    : join(projectRoot, 'package.json');
}

// Keeps the target properties whose defaults stop applying, or apply with a
// different value, after the executor changes.
function keepTargetDefaults(
  tree: Tree,
  project: ProjectConfiguration,
  targetName: string,
  target: TargetConfiguration,
  previousDefaults: Partial<TargetConfiguration> | null
): void {
  if (!previousDefaults) {
    return;
  }

  const currentDefaults =
    readTargetDefaults(tree, project, targetName, target.executor) ?? {};
  const {
    executor: _executor,
    command: _command,
    options: _options,
    configurations: _configurations,
    ...properties
  } = previousDefaults;
  const targetProperties = target as Record<string, unknown>;
  for (const [key, value] of Object.entries(properties)) {
    if (
      targetProperties[key] === undefined &&
      !isDeepStrictEqual(value, currentDefaults[key])
    ) {
      targetProperties[key] = value;
    }
  }
}

function getTargetToConvert(
  projectName: string,
  targets: Record<string, TargetConfiguration>,
  isProvidedProject: boolean
): string | undefined {
  let targetName: string | undefined;
  for (const [name, target] of Object.entries(targets)) {
    if (libraryBuilderExecutors.has(target.executor)) {
      logger.warn(
        'The project is already using the library builder. Skipping conversion.'
      );
      return undefined;
    }

    if (ngPackagrExecutors.has(target.executor)) {
      if (targetName) {
        logger.warn(
          'The project has more than one target using ng-packagr. Skipping conversion.'
        );
        return undefined;
      }
      targetName = name;
    }
  }

  if (!targetName && isProvidedProject) {
    logger.warn(
      `The provided project "${projectName}" does not have any targets using one of the ` +
        `'@nx/angular:package', '@nx/angular:ng-packagr-lite', '@angular-devkit/build-angular:ng-packagr' ` +
        `and '@angular/build:ng-packagr' executors. Skipping conversion.`
    );
  }

  return targetName;
}

function readNgPackagrLibrary(
  tree: Tree,
  project: ProjectConfiguration,
  target: TargetConfiguration
): NgPackagrLibrary {
  const projectRoot = normalizeRelativePath(project.root);
  const primaryConfigFile = getPrimaryConfigFile(tree, project, target);
  if (/\.[cm]?js$/.test(primaryConfigFile)) {
    throw new UnsupportedLibraryError(
      `JavaScript ng-packagr configuration files ("${primaryConfigFile}") cannot be converted.`
    );
  }

  // ng-packagr reads package.json next to its configuration, and the library
  // builder reads it from the project root.
  if (normalizeRelativePath(dirname(primaryConfigFile)) !== projectRoot) {
    throw new UnsupportedLibraryError(
      `The ng-packagr configuration "${primaryConfigFile}" is not in the project root "${projectRoot || '.'}".`
    );
  }

  let config = readNgPackageConfig(tree, primaryConfigFile);
  // ng-packagr resolves an absolute `dest` for the bundles but joins it to the
  // package directory for the assets.
  if (typeof config?.dest === 'string' && isAbsolute(config.dest)) {
    throw new UnsupportedLibraryError(
      `The ng-packagr "dest" option "${config.dest}" is absolute, and ng-packagr writes its bundles and assets to different directories.`
    );
  }
  const primaryEntryFile = resolveEntryFile(
    tree,
    projectRoot,
    projectRoot,
    config?.lib?.entryFile
  );
  // ng-packagr resolves `dest` against the configuration's directory.
  const secondaryEntryPoints = findSecondaryEntryPoints(
    tree,
    projectRoot,
    normalizeRelativePath(join(projectRoot, config?.dest ?? 'dist'))
  );

  const toExportPath = (path: string) =>
    toRelativePath(relative(projectRoot, path));
  const entryPointExports: Record<string, string> = {
    '.': toExportPath(primaryEntryFile),
  };
  for (const secondary of secondaryEntryPoints) {
    entryPointExports[toRelativePath(secondary.subpath)] = toExportPath(
      secondary.entryFile
    );

    // The library builder has one set of options for every entry point.
    if (secondary.config?.lib) {
      config ??= {};
      config.lib ??= {};
      if (secondary.config.lib.styleIncludePaths?.length) {
        const secondaryDir = dirname(secondary.configFile);
        config.lib.styleIncludePaths ??= [];
        for (const includePath of secondary.config.lib.styleIncludePaths) {
          config.lib.styleIncludePaths.push(
            isAbsolute(includePath)
              ? includePath
              : relative(projectRoot, join(secondaryDir, includePath))
          );
        }
      }
      if (secondary.config.lib.sass) {
        config.lib.sass = mergeSassOptions(
          config.lib.sass ?? {},
          secondary.config.lib.sass
        );
      }
    }
  }

  return {
    primaryConfigFile,
    config,
    entryPointExports,
    secondaryEntryPoints,
  };
}

// The conversion moves the ng-packagr configuration to the base target options,
// so every run of the target must read the same one.
function getPrimaryConfigFile(
  tree: Tree,
  project: ProjectConfiguration,
  target: TargetConfiguration
): string {
  const baseProjectOption = target.options?.['project'];
  const configFile = resolvePrimaryConfigFile(
    tree,
    project,
    target.executor,
    baseProjectOption
  );
  const configFiles = new Set([configFile]);
  for (const options of Object.values(target.configurations ?? {})) {
    configFiles.add(
      resolvePrimaryConfigFile(
        tree,
        project,
        target.executor,
        options?.['project'] ?? baseProjectOption
      )
    );
  }
  if (configFiles.size > 1) {
    throw new UnsupportedLibraryError(
      `The target configurations use different ng-packagr configurations (${[
        ...configFiles,
      ]
        .map((file) => `"${file}"`)
        .join(', ')}).`
    );
  }

  return configFile;
}

function resolvePrimaryConfigFile(
  tree: Tree,
  project: ProjectConfiguration,
  executor: string,
  projectOption: unknown
): string {
  const configPath = toWorkspacePath(
    tree,
    resolveNgPackagrProjectPath(
      tree,
      executor,
      typeof projectOption === 'string'
        ? resolveTokens(projectOption, project)
        : projectOption,
      project.root
    )
  );
  const configFile = findConfigFile(tree, configPath);
  if (!configFile) {
    throw new UnsupportedLibraryError(
      tree.exists(configPath)
        ? `The ng-packagr project directory "${configPath || '.'}" has no ng-package.json or ng-package.js file.`
        : `The ng-packagr configuration "${configPath || '.'}" doesn't exist.`
    );
  }
  // ng-packagr validates the whole file against its configuration schema,
  // which rejects the package.json fields.
  if (isPackageJson(configFile)) {
    throw new UnsupportedLibraryError(
      `ng-packagr doesn't support "${configFile}" as its configuration.`
    );
  }
  return configFile;
}

function readNgPackageConfig(
  tree: Tree,
  filePath: string
): NgPackageConfig | undefined {
  let json: unknown;
  try {
    json = readJson(tree, filePath);
  } catch (e) {
    throw new UnsupportedLibraryError(
      `"${filePath}" could not be parsed: ${(e as Error).message}`
    );
  }
  return isJsonObject(json) ? (json as NgPackageConfig) : undefined;
}

// ng-packagr defaults `lib.entryFile` to src/public_api.ts and resolves it
// against the configuration's directory.
function resolveEntryFile(
  tree: Tree,
  projectRoot: string,
  dir: string,
  configuredEntryFile = 'src/public_api.ts'
): string {
  const entryFile = toWorkspacePath(
    tree,
    resolve(tree.root, dir, normalize(configuredEntryFile))
  );
  if (!tree.isFile(entryFile)) {
    throw new UnsupportedLibraryError(
      `The entry file "${entryFile}" doesn't exist.`
    );
  }
  if (
    !isInDirectory(
      resolve(tree.root, entryFile),
      resolve(tree.root, projectRoot)
    )
  ) {
    throw new UnsupportedLibraryError(
      `The entry file "${entryFile}" is outside the project root "${projectRoot || '.'}", and the library builder only builds files inside it.`
    );
  }
  return entryFile;
}

// ng-packagr finds secondary entry points by their ng-package.json.
function findSecondaryEntryPoints(
  tree: Tree,
  projectRoot: string,
  destDir: string
): SecondaryEntryPoint[] {
  const secondaryEntryPoints: SecondaryEntryPoint[] = [];
  const directories = [projectRoot];
  for (const dir of directories) {
    const configFile = join(dir, 'ng-package.json');
    if (dir !== projectRoot && tree.isFile(configFile)) {
      const config = readNgPackageConfig(tree, configFile);
      // ng-packagr's schema for secondary entry points has no other options.
      const unsupportedOption = Object.keys(config ?? {}).find(
        (key) => key !== '$schema' && key !== 'lib'
      );
      if (unsupportedOption) {
        throw new UnsupportedLibraryError(
          `ng-packagr rejects the "${unsupportedOption}" option in the secondary entry point configuration "${configFile}".`
        );
      }
      if (isSymbolicLinkPath(tree, projectRoot, dir)) {
        throw new UnsupportedLibraryError(
          `The secondary entry point directory "${dir}" is a symbolic link or is inside one, and the conversion doesn't support it.`
        );
      }
      secondaryEntryPoints.push({
        subpath: relative(projectRoot, dir),
        entryFile: resolveEntryFile(
          tree,
          projectRoot,
          dir,
          config?.lib?.entryFile
        ),
        configFile,
        config,
      });
    }

    for (const child of tree.children(dir)) {
      // ng-packagr's search skips these directories.
      if (child === 'node_modules' || child.startsWith('.')) {
        continue;
      }
      const childPath = join(dir, child);
      if (childPath !== destDir && !tree.isFile(childPath)) {
        directories.push(childPath);
      }
    }
  }

  return secondaryEntryPoints;
}

function migrateTargetOptions(
  tree: Tree,
  target: TargetConfiguration,
  projectRoot: string,
  { config, secondaryEntryPoints }: NgPackagrLibrary
): void {
  const options = (target.options ??= {});
  const development = target.configurations?.['development'];
  const devTsConfig = development?.['tsConfig'];
  if (typeof options['tsConfig'] !== 'string') {
    if (typeof devTsConfig === 'string') {
      options['tsConfig'] = devTsConfig;
      delete development['tsConfig'];
    } else if (tree.exists(join(projectRoot, 'tsconfig.lib.json'))) {
      options['tsConfig'] = join(projectRoot, 'tsconfig.lib.json');
    }
  } else if (devTsConfig === options['tsConfig']) {
    delete development['tsConfig'];
  }

  if (typeof options['outputPath'] !== 'string') {
    // ng-packagr writes to `dist` within the package directory when `dest` is not set.
    options['outputPath'] = join(projectRoot, config?.dest ?? 'dist');
  }

  const assets = (config?.assets ?? []).map((asset) =>
    toAssetPattern(tree, projectRoot, asset)
  );
  // ng-packagr copies the README.md of every entry point, and the library
  // builder only the one in the project root.
  for (const { subpath } of secondaryEntryPoints) {
    const entryPointDir = join(projectRoot, subpath);
    if (tree.isFile(join(entryPointDir, 'README.md'))) {
      assets.push({ glob: 'README.md', input: entryPointDir, output: subpath });
    }
  }
  if (assets.length) {
    options['assets'] = [
      ...(Array.isArray(options['assets']) ? options['assets'] : []),
      ...assets,
    ];
  }

  if (config?.lib?.styleIncludePaths?.length || config?.lib?.sass) {
    const stylePreprocessorOptions = isJsonObject(
      options['stylePreprocessorOptions']
    )
      ? { ...options['stylePreprocessorOptions'] }
      : {};
    if (config.lib.styleIncludePaths?.length) {
      const includePaths = Array.isArray(
        stylePreprocessorOptions['includePaths']
      )
        ? stylePreprocessorOptions['includePaths']
        : [];
      stylePreprocessorOptions['includePaths'] = [
        ...new Set([
          ...includePaths,
          // ng-packagr keeps an absolute include path, and the library
          // builder resolves the others against the workspace root.
          ...config.lib.styleIncludePaths.map((path) =>
            isAbsolute(path) ? path : join(projectRoot, path)
          ),
        ]),
      ];
    }
    if (config.lib.sass) {
      stylePreprocessorOptions['sass'] = mergeSassOptions(
        isJsonObject(stylePreprocessorOptions['sass'])
          ? stylePreprocessorOptions['sass']
          : {},
        config.lib.sass
      );
    }
    options['stylePreprocessorOptions'] = stylePreprocessorOptions;
  }

  if (config?.allowedNonPeerDependencies?.length) {
    options['allowedNonPeerDependencies'] = config.allowedNonPeerDependencies;
  }
  if (config?.inlineStyleLanguage) {
    options['inlineStyleLanguage'] = config.inlineStyleLanguage;
  }
  if (config?.keepLifecycleScripts !== undefined) {
    options['keepLifecycleScripts'] = config.keepLifecycleScripts;
  }
  if (config?.deleteDestPath !== undefined) {
    options['deleteOutputPath'] = config.deleteDestPath;
  }

  for (const [, targetOptions] of allTargetOptions(target)) {
    delete targetOptions['project'];
  }
}

// ng-packagr reads a string asset as a directory, a file or a glob, relative to
// the package directory.
function toAssetPattern(
  tree: Tree,
  projectRoot: string,
  asset: unknown
): unknown {
  if (typeof asset === 'string') {
    const assetPath = join(projectRoot, asset);
    if (tree.isFile(assetPath)) {
      return {
        glob: basename(asset),
        input: toAssetPath(dirname(assetPath)),
        output: toAssetPath(dirname(asset)),
      };
    }
    if (tree.exists(assetPath)) {
      return {
        glob: '**/*',
        input: toAssetPath(assetPath),
        output: toAssetPath(asset),
      };
    }
    return { glob: asset, input: toAssetPath(projectRoot), output: '.' };
  }
  if (isJsonObject(asset) && typeof asset['input'] === 'string') {
    return { ...asset, input: join(projectRoot, asset['input']) };
  }
  return asset;
}

function toAssetPath(assetPath: string): string {
  return normalizeRelativePath(assetPath) || '.';
}

function mergeSassOptions(
  existing: Record<string, unknown>,
  added: Record<string, unknown>
): Record<string, unknown> {
  const sass = { ...existing };
  for (const [key, value] of Object.entries(added)) {
    if (Array.isArray(value)) {
      const current = Array.isArray(sass[key]) ? sass[key] : [];
      sass[key] = [...new Set([...current, ...value])];
    }
  }
  return sass;
}

// ng-packagr compiles with its own partial default when no tsconfig is passed.
// A passed tsconfig replaces that default, so one without a mode compiles in full.
function readNgPackagrCompilationModes(
  tree: Tree,
  project: ProjectConfiguration,
  target: TargetConfiguration
): Map<string | undefined, string> {
  const readMode = (tsConfig: unknown) =>
    typeof tsConfig === 'string'
      ? (readCompilationMode(tree, project, tsConfig) ?? 'full')
      : 'partial';
  const baseTsConfig = target.options?.['tsConfig'];
  const modes = new Map<string | undefined, string>([
    [undefined, readMode(baseTsConfig)],
  ]);
  for (const [name, options] of Object.entries(target.configurations ?? {})) {
    modes.set(name, readMode(options?.['tsConfig'] ?? baseTsConfig));
  }
  return modes;
}

// The library builder takes the option, then the tsconfig, then defaults to partial.
function keepCompilationModes(
  tree: Tree,
  project: ProjectConfiguration,
  target: TargetConfiguration,
  inheritedDefaults: Partial<TargetConfiguration> | null,
  ngPackagrModes: Map<string | undefined, string>
): void {
  for (const [configurationName, ngPackagrMode] of ngPackagrModes) {
    const runOptions = readRunOptions(
      target,
      inheritedDefaults,
      configurationName
    );
    const libraryBuilderMode =
      runOptions['compilationMode'] ??
      readCompilationMode(tree, project, runOptions['tsConfig']) ??
      'partial';
    if (libraryBuilderMode !== ngPackagrMode) {
      const options =
        configurationName === undefined
          ? target.options
          : target.configurations[configurationName];
      options['compilationMode'] = ngPackagrMode;
    }
  }
}

function readCompilationMode(
  tree: Tree,
  project: ProjectConfiguration,
  tsConfigPath: unknown
): string | undefined {
  return typeof tsConfigPath === 'string'
    ? resolveCompilationMode(
        tree,
        createTreeParseConfigHost(tree),
        resolve(tree.root, resolveTokens(tsConfigPath, project)),
        new Set()
      )
    : undefined;
}

// Reads `angularCompilerOptions`, else `bazelOptions.angularCompilerOptions`, like the
// Angular compiler: a config's own options win over its `extends` entries, and
// later entries win over earlier ones.
function resolveCompilationMode(
  tree: Tree,
  host: TreeParseConfigHost,
  tsConfigPath: string,
  visited: Set<string>
): string | undefined {
  if (visited.has(tsConfigPath)) {
    return undefined;
  }
  visited.add(tsConfigPath);

  const tsConfig = readTsConfig(host, tsConfigPath);
  const compilationMode = (
    tsConfig?.angularCompilerOptions ??
    tsConfig?.bazelOptions?.angularCompilerOptions
  )?.compilationMode;
  if (typeof compilationMode === 'string') {
    return compilationMode;
  }

  const parents: unknown[] = Array.isArray(tsConfig?.extends)
    ? tsConfig.extends
    : [tsConfig?.extends];
  for (const parent of parents.reverse()) {
    if (typeof parent !== 'string') {
      continue;
    }
    const parentPath = resolveExtendedConfig(host, tsConfigPath, parent);
    if (!parentPath) {
      // The Angular compiler skips an entry it can't resolve. When TypeScript
      // can't resolve it either, it isn't installed, so it might set a mode.
      if (extendsTsConfigFails(host, tsConfigPath, parent)) {
        throw new UnsupportedLibraryError(
          `Could not resolve "${parent}", which "${normalizePath(nativeRelative(tree.root, tsConfigPath))}" extends, to read the compilation mode.`
        );
      }
      continue;
    }
    const parentMode = resolveCompilationMode(tree, host, parentPath, visited);
    if (parentMode) {
      return parentMode;
    }
  }
  return undefined;
}

// Matches `getExtendedConfigPath` in @angular/compiler-cli.
function resolveExtendedConfig(
  host: TreeParseConfigHost,
  tsConfigPath: string,
  extendsValue: string
): string | undefined {
  for (const candidate of [extendsValue, `${extendsValue}.json`]) {
    if (candidate.startsWith('.') || isAbsolute(candidate)) {
      const candidatePath = resolve(nativeDirname(tsConfigPath), candidate);
      if (
        host.fileExists(candidatePath) ||
        host.directoryExists(candidatePath)
      ) {
        return candidatePath;
      }
    } else {
      const ts = ensureTypescript();
      const { resolvedModule } = ts.nodeModuleNameResolver(
        candidate,
        tsConfigPath,
        {
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          resolveJsonModule: true,
        },
        host
      );
      if (resolvedModule) {
        return resolvedModule.resolvedFileName;
      }
    }
  }
  return undefined;
}

function extendsTsConfigFails(
  host: TreeParseConfigHost,
  tsConfigPath: string,
  extendsValue: string
): boolean {
  const { errors } = ensureTypescript().parseJsonConfigFileContent(
    { extends: extendsValue, files: [] },
    host,
    nativeDirname(tsConfigPath)
  );
  return extendsResolutionFailed(errors);
}

function readTsConfig(host: TreeParseConfigHost, tsConfigPath: string): any {
  const content = host.fileExists(tsConfigPath)
    ? host.readFile(tsConfigPath)
    : undefined;
  if (content === undefined) {
    return undefined;
  }
  try {
    return parseJson(content);
  } catch {
    // The Angular compiler skips a tsconfig that can't be parsed.
    return undefined;
  }
}

function updateOutputs(
  target: TargetConfiguration,
  project: ProjectConfiguration
): void {
  if (!target.outputs || typeof target.options['outputPath'] !== 'string') {
    return;
  }

  const outputPath = normalizeRelativePath(target.options['outputPath']);
  const outputs = target.outputs.map((output) =>
    !output.startsWith('!') &&
    normalizeRelativePath(resolveTokens(output, project)) === outputPath
      ? '{options.outputPath}'
      : output
  );
  target.outputs = [...new Set(outputs)];
}

// The configurations the upstream migration deletes. A secondary configuration
// stays when its entry file is outside its directory, because Nx reads it to
// find the files of that entry point.
function findRemovableNgPackagrConfigs(
  projectName: string,
  library: NgPackagrLibrary
): string[] {
  const configFiles = library.primaryConfigFile.endsWith('ng-package.json')
    ? [library.primaryConfigFile]
    : [];
  const keptConfigFiles: string[] = [];
  for (const { subpath, configFile } of library.secondaryEntryPoints) {
    const key = toRelativePath(subpath);
    const entryFile = library.entryPointExports[key];
    if (isEntryPointDirectoryExport(key, entryFile)) {
      configFiles.push(configFile);
    } else {
      keptConfigFiles.push(`  - ${configFile} ("${key}": "${entryFile}")`);
    }
  }
  if (keptConfigFiles.length) {
    logger.info(
      `These secondary entry points of project "${projectName}" have their entry file outside their directory, so their ng-package.json files stay. ` +
        'The module boundaries lint rule and the Tailwind content globs read them to find the files of each entry point:\n' +
        keptConfigFiles.join('\n')
    );
  }
  return configFiles;
}

function logKeptNgPackagrConfigs(configFiles: Set<string>): void {
  if (configFiles.size) {
    logger.info(
      'The converted libraries no longer use these ng-packagr configuration files. ' +
        'They stay because other targets still use ng-packagr. Delete them once no ng-packagr build reads them:\n' +
        [...configFiles].map((configFile) => `  - ${configFile}`).join('\n')
    );
  }
}

// The real path of a directory differs from its path when the directory is a
// symbolic link or inside one. A directory that isn't on disk is neither.
function isSymbolicLinkPath(
  tree: Tree,
  projectRoot: string,
  dir: string
): boolean {
  let realDir: string;
  let realRoot: string;
  try {
    realDir = realpathSync.native(resolve(tree.root, dir));
    realRoot = realpathSync.native(resolve(tree.root, projectRoot));
  } catch {
    return false;
  }
  return realDir !== resolve(realRoot, relative(projectRoot, dir));
}

// Matches `normalizeEntryPoints` in the library builder, which throws for an
// invalid entry point and skips a secondary one that isn't TypeScript.
function assertLibraryBuilderEntryPoints(
  tree: Tree,
  projectRoot: string,
  entryPointExports: Record<string, string>
): void {
  const packageJsonPath = join(projectRoot, 'package.json');
  let packageJson: unknown;
  try {
    packageJson = readJson(tree, packageJsonPath);
  } catch (e) {
    throw new UnsupportedLibraryError(
      `The library builder reads "${packageJsonPath}", which could not be read: ${(e as Error).message}`
    );
  }
  const packageName = isJsonObject(packageJson) ? packageJson.name : undefined;
  if (typeof packageName !== 'string' || !packageName) {
    throw new UnsupportedLibraryError(
      `The library builder requires a "name" in "${packageJsonPath}".`
    );
  }

  const absoluteRoot = resolve(tree.root, projectRoot);
  const bundleNames = new Map<string, string>();
  const builtSubpaths = new Set<string>();
  const exports = mergeEntryPointExports(
    (packageJson as Record<string, unknown>).exports,
    entryPointExports
  );
  for (const [key, value] of Object.entries(exports)) {
    const target = resolveExportTarget(value);
    if (!target || !isLibraryBuilderEntryFile(target)) {
      continue;
    }
    const posixKey = key.replace(/\\/g, '/').replace(/\/+$/, '');
    const isPrimary = posixKey === '.' || posixKey === '';
    const name = isPrimary
      ? '.'
      : posixKey.startsWith('./')
        ? posixKey.slice(2)
        : posixKey;
    if (name !== '.' && (name.startsWith('/') || name.includes('..'))) {
      throw new UnsupportedLibraryError(
        `The library builder rejects the "${key}" export, because an entry point key must be a relative subpath without "..".`
      );
    }
    if (!isInDirectory(resolve(absoluteRoot, target), absoluteRoot)) {
      throw new UnsupportedLibraryError(
        `The library builder rejects the "${key}" export, because "${target}" is outside the project root "${projectRoot || '.'}".`
      );
    }
    const bundleName = (
      name === '.'
        ? packageName.replace(/^@/, '')
        : `${packageName.replace(/^@/, '')}-${name}`
    )
      .replace(/\//g, '-')
      .toLowerCase();
    const otherKey = bundleNames.get(bundleName);
    if (otherKey) {
      throw new UnsupportedLibraryError(
        `The library builder rejects the "${otherKey}" and "${key}" exports, because both produce the "${bundleName}" bundle.`
      );
    }
    bundleNames.set(bundleName, key);
    builtSubpaths.add(isPrimary ? '.' : `./${name}`);
  }

  for (const [subpath, entryFile] of Object.entries(entryPointExports)) {
    if (!builtSubpaths.has(subpath)) {
      throw new UnsupportedLibraryError(
        `The library builder only builds ".ts" and ".mts" entry files, and the "${subpath}" entry point uses "${entryFile}".`
      );
    }
  }
}

function mergeEntryPointExports(
  exports: unknown,
  entryPointExports: Record<string, string>
): Record<string, unknown> {
  let merged: Record<string, unknown> = {};
  if (isJsonObject(exports)) {
    const keys = Object.keys(exports);
    if (keys.some((key) => key.startsWith('.'))) {
      merged = { ...exports };
    } else if (keys.length > 0) {
      merged = { '.': exports };
    }
  }
  for (const [subpath, entryFile] of Object.entries(entryPointExports)) {
    merged[subpath] = isJsonObject(merged[subpath])
      ? { ...merged[subpath], default: entryFile }
      : entryFile;
  }
  return merged;
}

function updateLibraryPackageJson(
  tree: Tree,
  packageJsonPath: string,
  entryPointExports: Record<string, string>
): void {
  updateJson(tree, packageJsonPath, (json) => {
    delete json.ngPackage;
    // The library builder adds tslib to the built package.json when the output imports it.
    for (const dependencyType of [
      'dependencies',
      'peerDependencies',
      'devDependencies',
      'optionalDependencies',
    ]) {
      if (isJsonObject(json[dependencyType])) {
        delete json[dependencyType].tslib;
        if (Object.keys(json[dependencyType]).length === 0) {
          delete json[dependencyType];
        }
      }
    }

    json.exports = mergeEntryPointExports(json.exports, entryPointExports);
    return json;
  });
}

function usesLess(
  tree: Tree,
  project: ProjectConfiguration,
  target: TargetConfiguration
): boolean {
  for (const [, options] of allTargetOptions(target)) {
    if (options['inlineStyleLanguage'] === 'less') {
      return true;
    }
  }

  let hasLessFiles = false;
  visitNotIgnoredFiles(tree, project.root, (file) => {
    hasLessFiles ||= file.endsWith('.less');
  });
  return hasLessFiles;
}

function updateDependencies(
  tree: Tree,
  usesLess: boolean,
  ngPackagrTargetsRemain: boolean
): void {
  const devDependencies: Record<string, string> = {
    '@angular/build': getAngularBuildVersionRange(tree),
  };
  acknowledgeAngularBuildScripts(tree);
  // ng-packagr depends on less, while @angular/build leaves it optional.
  if (usesLess) {
    devDependencies['less'] = versions(tree).lessVersion;
    acknowledgeLessBuildScripts(tree);
  }
  addDependenciesToPackageJson(tree, {}, devDependencies, undefined, true);

  if (!ngPackagrTargetsRemain) {
    removeDependenciesFromPackageJson(tree, ['ng-packagr'], ['ng-packagr']);
  }
}

function normalizeRelativePath(path: string): string {
  const normalized = normalize(path).replace(/^\/+|\/+$/g, '');
  return normalized === '.' ? '' : normalized;
}

function toRelativePath(path: string): string {
  return path.startsWith('./') || path.startsWith('../') ? path : `./${path}`;
}

function isInDirectory(absolutePath: string, absoluteDir: string): boolean {
  const relativePath = nativeRelative(absoluteDir, absolutePath);
  return (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function isPackageJson(filePath: string): boolean {
  return filePath === 'package.json' || filePath.endsWith('/package.json');
}

function isJsonObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default convertToLibraryExecutor;
