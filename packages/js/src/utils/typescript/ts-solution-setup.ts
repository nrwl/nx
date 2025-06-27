import {
  globAsync,
  joinPathFragments,
  offsetFromRoot,
  output,
  type ProjectConfiguration,
  readJson,
  readNxJson,
  type Tree,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import { basename, dirname, join } from 'node:path/posix';
import { FsTree } from 'nx/src/generators/tree';
import {
  getPackageManagerWorkspacesPatterns,
  getProjectPackageManagerWorkspaceState,
  isUsingPackageManagerWorkspaces,
} from '../package-manager-workspaces';
import { getNeededCompilerOptionOverrides } from './configuration';

export function isUsingTypeScriptPlugin(tree: Tree): boolean {
  const nxJson = readNxJson(tree);

  return (
    nxJson?.plugins?.some((p) =>
      typeof p === 'string'
        ? p === '@nx/js/typescript'
        : p.plugin === '@nx/js/typescript'
    ) ?? false
  );
}

export function isUsingTsSolutionSetup(tree?: Tree): boolean {
  tree ??= new FsTree(workspaceRoot, false);

  return (
    isUsingPackageManagerWorkspaces(tree) &&
    isWorkspaceSetupWithTsSolution(tree)
  );
}

function isWorkspaceSetupWithTsSolution(tree: Tree): boolean {
  if (!tree.exists('tsconfig.base.json') || !tree.exists('tsconfig.json')) {
    return false;
  }

  const tsconfigJson = readJson(tree, 'tsconfig.json');
  if (tsconfigJson.extends !== './tsconfig.base.json') {
    return false;
  }

  /**
   * New setup:
   * - `files` is defined and set to an empty array
   * - `references` is defined and set to an empty array
   * - `include` is not defined or is set to an empty array
   */
  if (
    !tsconfigJson.files ||
    tsconfigJson.files.length > 0 ||
    !tsconfigJson.references ||
    !!tsconfigJson.include?.length
  ) {
    return false;
  }

  const baseTsconfigJson = readJson(tree, 'tsconfig.base.json');
  if (
    !baseTsconfigJson.compilerOptions ||
    !baseTsconfigJson.compilerOptions.composite ||
    baseTsconfigJson.compilerOptions.declaration === false
  ) {
    return false;
  }

  const { compilerOptions, ...rest } = baseTsconfigJson;
  if (Object.keys(rest).length > 0) {
    return false;
  }

  return true;
}

export function assertNotUsingTsSolutionSetup(
  tree: Tree,
  pluginName: string,
  generatorName: string
): void {
  if (
    process.env.NX_IGNORE_UNSUPPORTED_TS_SETUP === 'true' ||
    !isUsingTsSolutionSetup(tree)
  ) {
    return;
  }

  const artifactString =
    generatorName === 'init'
      ? `"@nx/${pluginName}" plugin`
      : `"@nx/${pluginName}:${generatorName}" generator`;
  output.error({
    title: `The ${artifactString} doesn't yet support the existing TypeScript setup`,
    bodyLines: [
      `We're working hard to support the existing TypeScript setup with the ${artifactString}. We'll soon release a new version of Nx with support for it.`,
    ],
  });

  throw new Error(
    `The ${artifactString} doesn't yet support the existing TypeScript setup. See the error above.`
  );
}

export function findRuntimeTsConfigName(
  projectRoot: string,
  tree?: Tree
): string | null {
  tree ??= new FsTree(workspaceRoot, false);
  if (tree.exists(joinPathFragments(projectRoot, 'tsconfig.app.json')))
    return 'tsconfig.app.json';
  if (tree.exists(joinPathFragments(projectRoot, 'tsconfig.lib.json')))
    return 'tsconfig.lib.json';
  return null;
}

export function updateTsconfigFiles(
  tree: Tree,
  projectRoot: string,
  runtimeTsconfigFileName: string,
  compilerOptions: Record<string, string | boolean | string[]>,
  exclude: string[] = [],
  rootDir = 'src'
) {
  if (!isUsingTsSolutionSetup(tree)) {
    return;
  }

  const offset = offsetFromRoot(projectRoot);
  const runtimeTsconfigPath = `${projectRoot}/${runtimeTsconfigFileName}`;
  const specTsconfigPath = `${projectRoot}/tsconfig.spec.json`;

  if (tree.exists(runtimeTsconfigPath)) {
    updateJson(tree, runtimeTsconfigPath, (json) => {
      json.extends = joinPathFragments(offset, 'tsconfig.base.json');

      json.compilerOptions = {
        ...json.compilerOptions,
        outDir: 'dist',
        rootDir,
        ...compilerOptions,
      };

      if (rootDir && rootDir !== '.') {
        // when rootDir is different from '.', the tsbuildinfo file is output
        // at `<outDir>/<relative path to config from rootDir>/`, so we need
        // to set it explicitly to ensure it's output to the outDir
        // https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile
        json.compilerOptions.tsBuildInfoFile = join(
          json.compilerOptions.outDir,
          basename(runtimeTsconfigFileName, '.json') + '.tsbuildinfo'
        );
      } else if (json.compilerOptions.tsBuildInfoFile) {
        // when rootDir is '.' or not set, it would be output to the outDir, so
        // we don't need to set it explicitly
        delete json.compilerOptions.tsBuildInfoFile;
      }

      // don't duplicate compiler options from base tsconfig
      json.compilerOptions = getNeededCompilerOptionOverrides(
        tree,
        json.compilerOptions,
        'tsconfig.base.json'
      );

      const excludeSet: Set<string> = json.exclude
        ? new Set(['out-tsc', 'dist', ...json.exclude, ...exclude])
        : new Set(exclude);
      json.exclude = Array.from(excludeSet);

      return json;
    });
  }

  if (tree.exists(specTsconfigPath)) {
    updateJson(tree, specTsconfigPath, (json) => {
      json.extends = joinPathFragments(offset, 'tsconfig.base.json');
      json.compilerOptions = {
        ...json.compilerOptions,
        ...compilerOptions,
      };
      // don't duplicate compiler options from base tsconfig
      json.compilerOptions = getNeededCompilerOptionOverrides(
        tree,
        json.compilerOptions,
        'tsconfig.base.json'
      );
      const runtimePath = `./${runtimeTsconfigFileName}`;
      json.references ??= [];
      if (!json.references.some((x) => x.path === runtimePath)) {
        json.references.push({ path: runtimePath });
      }
      return json;
    });
  }

  if (tree.exists('tsconfig.json')) {
    updateJson(tree, 'tsconfig.json', (json) => {
      const projectPath = './' + projectRoot;
      json.references ??= [];
      if (!json.references.some((x) => x.path === projectPath)) {
        json.references.push({ path: projectPath });
      }
      return json;
    });
  }
}

export async function addProjectToTsSolutionWorkspace(
  tree: Tree,
  projectDir: string
) {
  const state = getProjectPackageManagerWorkspaceState(tree, projectDir);
  if (state === 'included') {
    return;
  }

  // If dir is "libs/foo", we try to use "libs/*" but we only do it if it's
  // safe to do so. So, we first check if adding that pattern doesn't result
  // in extra projects being matched. If extra projects are matched, or the
  // dir is just "foo" then we add it as is.
  const baseDir = dirname(projectDir);
  let pattern = projectDir;
  if (baseDir !== '.') {
    const patterns = getPackageManagerWorkspacesPatterns(tree);
    const projectsBefore =
      patterns.length > 0 ? await globAsync(tree, patterns) : [];
    patterns.push(`${baseDir}/*/package.json`);
    const projectsAfter = await globAsync(tree, patterns);

    if (projectsBefore.length + 1 === projectsAfter.length) {
      // Adding the pattern to the parent directory only results in one extra
      // project being matched, which is the project we're adding. It's safe
      // to add the pattern to the parent directory.
      pattern = `${baseDir}/*`;
    }
  }

  if (tree.exists('pnpm-workspace.yaml')) {
    const { load, dump } = require('@zkochan/js-yaml');
    const workspaceFile = tree.read('pnpm-workspace.yaml', 'utf-8');
    const yamlData = load(workspaceFile) ?? {};
    yamlData.packages ??= [];

    if (!yamlData.packages.includes(pattern)) {
      yamlData.packages.push(pattern);
      tree.write(
        'pnpm-workspace.yaml',
        dump(yamlData, { indent: 2, quotingType: '"', forceQuotes: true })
      );
    }
  } else {
    // Update package.json
    const packageJson = readJson(tree, 'package.json');
    if (!packageJson.workspaces) {
      packageJson.workspaces = [];
    }

    if (!packageJson.workspaces.includes(pattern)) {
      packageJson.workspaces.push(pattern);
      tree.write('package.json', JSON.stringify(packageJson, null, 2));
    }
  }
}

export function getProjectType(
  tree: Tree,
  projectRoot: string,
  projectType?: 'library' | 'application'
): 'library' | 'application' {
  if (projectType) return projectType;
  if (tree.exists(joinPathFragments(projectRoot, 'tsconfig.lib.json')))
    return 'library';
  if (tree.exists(joinPathFragments(projectRoot, 'tsconfig.app.json')))
    return 'application';
  // If there are no exports, assume it is an application since both buildable and non-buildable libraries have exports.
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  const packageJson = tree.exists(packageJsonPath)
    ? readJson(tree, joinPathFragments(projectRoot, 'package.json'))
    : null;
  if (!packageJson?.exports) return 'application';
  return 'library';
}

export function getProjectSourceRoot(
  project: ProjectConfiguration,
  tree?: Tree
): string {
  tree ??= new FsTree(workspaceRoot, false);

  return (
    project.sourceRoot ??
    (tree.exists(joinPathFragments(project.root, 'src'))
      ? joinPathFragments(project.root, 'src')
      : project.root)
  );
}
