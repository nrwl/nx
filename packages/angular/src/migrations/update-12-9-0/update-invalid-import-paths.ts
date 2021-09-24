import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  formatFiles,
  getProjects,
  readJson,
  joinPathFragments,
  updateJson,
  logger,
} from '@nrwl/devkit';

type AffectedLib = ProjectConfiguration;
type InvalidLibs = {
  buildableLibs: AffectedLib[];
  publishableLibs: AffectedLib[];
};

export default async function (tree: Tree) {
  const possibleAffectedLibs = findBuildableAndPublishableLibs(tree);
  const invalidLibs = findInvalidLibs(tree, possibleAffectedLibs);
  fixLibs(tree, invalidLibs);

  await formatFiles(tree);
}

export function findBuildableAndPublishableLibs(tree: Tree): InvalidLibs {
  const projects = getProjects(tree);
  const buildableLibs: AffectedLib[] = [];
  const publishableLibs: AffectedLib[] = [];

  for (const [name, project] of projects) {
    for (const target of Object.values(project.targets || {})) {
      if (target.executor === '@nrwl/angular:package') {
        publishableLibs.push(project);
      } else if (target.executor === '@nrwl/angular:ng-packagr-lite') {
        buildableLibs.push(project);
      }
    }
  }

  return { buildableLibs, publishableLibs };
}

export function findInvalidLibs(tree: Tree, libs: InvalidLibs): InvalidLibs {
  const { compilerOptions } = readJson(tree, 'tsconfig.base.json');
  const { paths: tsConfigPaths } = compilerOptions;

  const invalidBuildableLibs = libs.buildableLibs.filter((lib) =>
    checkInvalidLib(tree, lib, tsConfigPaths)
  );
  const invalidPublishableLibs = libs.publishableLibs.filter((lib) =>
    checkInvalidLib(tree, lib, tsConfigPaths)
  );
  return {
    buildableLibs: invalidBuildableLibs,
    publishableLibs: invalidPublishableLibs,
  };
}

function checkInvalidLib(
  tree: Tree,
  lib: AffectedLib,
  tsConfigPaths: Record<string, string>
) {
  const { name } = readJson(tree, joinPathFragments(lib.root, 'package.json'));
  return !tsConfigPaths[name];
}

function fixLibs(tree: Tree, { buildableLibs, publishableLibs }: InvalidLibs) {
  const { compilerOptions } = readJson(tree, 'tsconfig.base.json');
  const { paths: tsConfigPaths } = compilerOptions;

  buildableLibs.map((lib) => fixBuildableLib(tree, lib, tsConfigPaths));
  publishableLibs.map((lib) => fixPublishableLib(tree, lib, tsConfigPaths));
}

function fixBuildableLib(
  tree: Tree,
  lib: AffectedLib,
  tsConfigPaths: Record<string, string>
) {
  const srcRoot = joinPathFragments(lib.sourceRoot, 'index.ts');

  for (const [validPackageName, tsLibSrcRoot] of Object.entries(
    tsConfigPaths
  )) {
    if (tsLibSrcRoot[0] === srcRoot) {
      updateJson(
        tree,
        joinPathFragments(lib.root, 'package.json'),
        (pkgJson) => {
          pkgJson.name = validPackageName;

          return pkgJson;
        }
      );
      break;
    }
  }
}

function fixPublishableLib(
  tree: Tree,
  lib: AffectedLib,
  tsConfigPaths: Record<string, string>
) {
  const srcRoot = joinPathFragments(lib.sourceRoot, 'index.ts');
  const { name: pkgName } = readJson(
    tree,
    joinPathFragments(lib.root, 'package.json')
  );

  const pkgNameParts = pkgName.split('/');
  if (Array.isArray(pkgNameParts) && pkgNameParts.length > 2) {
    logger.warn(
      `Your publishable package ${pkgName} is an invalid NPM Package name. Please ensure it only contains one '/'.`
    );
    logger.warn(
      `The affected package.json is at '${joinPathFragments(
        lib.root,
        'package.json'
      )}'`
    );
  }

  for (const [invalidPathKey, tsLibSrcRoot] of Object.entries(tsConfigPaths)) {
    if (tsLibSrcRoot[0] === srcRoot) {
      updateJson(tree, 'tsconfig.base.json', (tsconfig) => {
        tsconfig.compilerOptions.paths[invalidPathKey] = undefined;
        tsconfig.compilerOptions.paths[pkgName] = tsLibSrcRoot;

        return tsconfig;
      });
      break;
    }
  }
}
