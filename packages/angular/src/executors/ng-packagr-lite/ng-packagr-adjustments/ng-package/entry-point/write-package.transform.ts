/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Change the package.json metadata to only use the ESM2020 output as it's the only one generated.
 * - Remove package exports.
 */

import { logger } from '@nrwl/devkit';
import { BuildGraph } from 'ng-packagr/lib/graph/build-graph';
import { Node } from 'ng-packagr/lib/graph/node';
import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import { NgEntryPoint } from 'ng-packagr/lib/ng-package/entry-point/entry-point';
import {
  EntryPointNode,
  fileUrl,
  isEntryPointInProgress,
  isEntryPoint,
  isPackage,
  PackageNode,
} from 'ng-packagr/lib/ng-package/nodes';
import { NgPackagrOptions } from 'ng-packagr/lib/ng-package/options.di';
import { NgPackage } from 'ng-packagr/lib/ng-package/package';
import { copyFile, rmdir, stat, writeFile } from 'ng-packagr/lib/utils/fs';
import { globFiles } from 'ng-packagr/lib/utils/glob';
import { ensureUnixPath } from 'ng-packagr/lib/utils/path';
import { AssetPattern } from 'ng-packagr/ng-package.schema';
import * as path from 'path';

export const nxWritePackageTransform = (options: NgPackagrOptions) =>
  transformFromPromise(async (graph) => {
    const entryPoint: EntryPointNode = graph.find(isEntryPointInProgress());
    const ngEntryPoint: NgEntryPoint = entryPoint.data.entryPoint;
    const ngPackageNode: PackageNode = graph.find(isPackage);
    const ngPackage = ngPackageNode.data;
    const { destinationFiles } = entryPoint.data;

    if (!ngEntryPoint.isSecondaryEntryPoint) {
      logger.log('Copying assets');

      try {
        await copyAssets(graph, entryPoint, ngPackageNode);
      } catch (error) {
        throw error;
      }
    }

    // 6. WRITE PACKAGE.JSON
    // As of APF 14 only the primary entrypoint has a package.json
    if (!ngEntryPoint.isSecondaryEntryPoint) {
      try {
        logger.info('Writing package manifest');
        const relativeUnixFromDestPath = (filePath: string) =>
          ensureUnixPath(path.relative(ngEntryPoint.destinationPath, filePath));

        await writePackageJson(
          ngEntryPoint,
          ngPackage,
          {
            module: relativeUnixFromDestPath(destinationFiles.esm2020),
            es2020: relativeUnixFromDestPath(destinationFiles.esm2020),
            esm2020: relativeUnixFromDestPath(destinationFiles.esm2020),
            typings: relativeUnixFromDestPath(destinationFiles.declarations),
            exports: generatePackageExports(ngEntryPoint, graph),
            // webpack v4+ specific flag to enable advanced optimizations and code splitting
            sideEffects: ngEntryPoint.packageJson.sideEffects ?? false,
          },
          !!options.watch
        );
      } catch (error) {
        throw error;
      }
    }
    logger.info(`Built ${ngEntryPoint.moduleId}`);

    return graph;
  });

type AssetEntry = Exclude<AssetPattern, string>;

async function copyAssets(
  graph: BuildGraph,
  entryPointNode: EntryPointNode,
  ngPackageNode: PackageNode
): Promise<void> {
  const ngPackage = ngPackageNode.data;

  const globsForceIgnored: string[] = [
    '.gitkeep',
    '**/.DS_Store',
    '**/Thumbs.db',
    `${ngPackage.dest}/**`,
  ];

  const assets: AssetEntry[] = [];

  for (const item of ngPackage.assets) {
    const asset: Partial<AssetEntry> = {};
    if (typeof item == 'object') {
      asset.glob = item.glob;
      asset.input = path.join(ngPackage.src, item.input);
      asset.output = path.join(ngPackage.dest, item.output);
      asset.ignore = item.ignore;
    } else {
      const assetPath = item; // might be a glob
      const assetFullPath = path.join(ngPackage.src, assetPath);
      const [isDir, isFile] = await stat(assetFullPath)
        .then((stats) => [stats.isDirectory(), stats.isFile()])
        .catch(() => [false, false]);
      if (isDir) {
        asset.glob = '**/*';
        asset.input = assetFullPath;
        asset.output = path.join(ngPackage.dest, assetPath);
      } else if (isFile) {
        asset.glob = path.basename(assetFullPath); // filenames are their own glob
        asset.input = path.dirname(assetFullPath);
        asset.output = path.dirname(path.join(ngPackage.dest, assetPath));
      } else {
        asset.glob = assetPath;
        asset.input = ngPackage.src;
        asset.output = ngPackage.dest;
      }
    }

    const isAncestorPath = (target: string, datum: string) =>
      path.relative(datum, target).startsWith('..');
    if (isAncestorPath(asset.input, ngPackage.src)) {
      throw new Error(
        'Cannot read assets from a location outside of the project root.'
      );
    }
    if (isAncestorPath(asset.output, ngPackage.dest)) {
      throw new Error(
        'Cannot write assets to a location outside of the output path.'
      );
    }

    assets.push(asset as AssetEntry);
  }

  for (const asset of assets) {
    const filePaths = await globFiles(asset.glob, {
      cwd: asset.input,
      ignore: [...(asset.ignore ?? []), ...globsForceIgnored],
      cache: ngPackageNode.cache.globCache,
      dot: true,
      nodir: true,
      follow: asset.followSymlinks,
    });
    for (const filePath of filePaths) {
      const fileSrcFullPath = path.join(asset.input, filePath);
      const fileDestFullPath = path.join(asset.output, filePath);
      const nodeUri = fileUrl(ensureUnixPath(fileSrcFullPath));
      let node = graph.get(nodeUri);
      if (!node) {
        node = new Node(nodeUri);
        graph.put(node);
      }
      entryPointNode.dependsOn(node);
      await copyFile(fileSrcFullPath, fileDestFullPath);
    }
  }
}

/**
 * Creates and writes a `package.json` file of the entry point used by the `node_module`
 * resolution strategies.
 *
 * #### Example
 *
 * A consumer of the entry point depends on it by `import {..} from '@my/module/id';`.
 * The module id `@my/module/id` will be resolved to the `package.json` file that is written by
 * this build step.
 * The properties `main`, `module`, `typings` (and so on) in the `package.json` point to the
 * flattened JavaScript bundles, type definitions, (...).
 *
 * @param entryPoint An entry point of an Angular package / library
 * @param additionalProperties Additional properties, e.g. binary artefacts (bundle files), to merge into `package.json`
 */
async function writePackageJson(
  entryPoint: NgEntryPoint,
  pkg: NgPackage,
  additionalProperties: {
    [key: string]: string | boolean | string[] | ConditionalExport;
  },
  isWatchMode: boolean
): Promise<void> {
  // set additional properties
  const packageJson = { ...entryPoint.packageJson, ...additionalProperties };

  // read tslib version from `@angular/compiler` so that our tslib
  // version at least matches that of angular if we use require('tslib').version
  // it will get what installed and not the minimum version nor if it is a `~` or `^`
  // this is only required for primary
  if (isWatchMode) {
    // Needed because of Webpack's 5 `cachemanagedpaths`
    // https://github.com/angular/angular-cli/issues/20962
    packageJson.version = `0.0.0-watch+${Date.now()}`;
  }

  if (
    !packageJson.peerDependencies?.tslib &&
    !packageJson.dependencies?.tslib
  ) {
    const {
      peerDependencies: angularPeerDependencies = {},
      dependencies: angularDependencies = {},
    } = require('@angular/compiler/package.json');
    const tsLibVersion =
      angularPeerDependencies.tslib || angularDependencies.tslib;

    if (tsLibVersion) {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        tslib: tsLibVersion,
      };
    }
  } else if (packageJson.peerDependencies?.tslib) {
    logger.warn(
      `'tslib' is no longer recommended to be used as a 'peerDependencies'. Moving it to 'dependencies'.`
    );
    packageJson.dependencies = {
      ...(packageJson.dependencies || {}),
      tslib: packageJson.peerDependencies.tslib,
    };

    delete packageJson.peerDependencies.tslib;
  }

  // Verify non-peerDependencies as they can easily lead to duplicate installs or version conflicts
  // in the node_modules folder of an application
  const allowedList = pkg.allowedNonPeerDependencies.map(
    (value) => new RegExp(value)
  );
  try {
    checkNonPeerDependencies(packageJson, 'dependencies', allowedList);
  } catch (e) {
    await rmdir(entryPoint.destinationPath, { recursive: true });
    throw e;
  }

  // Removes scripts from package.json after build
  if (packageJson.scripts) {
    if (pkg.keepLifecycleScripts !== true) {
      logger.info(
        `Removing scripts section in package.json as it's considered a potential security vulnerability.`
      );
      delete packageJson.scripts;
    } else {
      logger.warn(
        `You enabled keepLifecycleScripts explicitly. The scripts section in package.json will be published to npm.`
      );
    }
  }

  // keep the dist package.json clean
  // this will not throw if ngPackage field does not exist
  delete packageJson.ngPackage;

  const packageJsonPropertiesToDelete = [
    'stylelint',
    'prettier',
    'browserslist',
    'devDependencies',
    'jest',
    'workspaces',
    'husky',
  ];

  for (const prop of packageJsonPropertiesToDelete) {
    if (prop in packageJson) {
      delete packageJson[prop];
      logger.info(`Removing ${prop} section in package.json.`);
    }
  }

  packageJson.name = entryPoint.moduleId;
  await writeFile(
    path.join(entryPoint.destinationPath, 'package.json'),
    JSON.stringify(packageJson, undefined, 2)
  );
}

function checkNonPeerDependencies(
  packageJson: Record<string, unknown>,
  property: string,
  allowed: RegExp[]
) {
  if (!packageJson[property]) {
    return;
  }

  for (const dep of Object.keys(packageJson[property])) {
    if (!allowed.some((regex) => regex.test(dep))) {
      logger.warn(
        `Distributing npm packages with '${property}' is not recommended. Please consider adding ${dep} to 'peerDependencies' or remove it from '${property}'.`
      );
      throw new Error(
        `Dependency ${dep} must be explicitly allowed using the "allowedNonPeerDependencies" option.`
      );
    }
  }
}

type PackageExports = Record<string, ConditionalExport>;

/**
 * Type describing the conditional exports descriptor for an entry-point.
 * https://nodejs.org/api/packages.html#packages_conditional_exports
 */
type ConditionalExport = {
  node?: string;
  types?: string;
  esm2020?: string;
  es2020?: string;
  es2015?: string;
  default?: string;
};

/**
 * Generates the `package.json` package exports following APF v13.
 * This is supposed to match with: https://github.com/angular/angular/blob/e0667efa6eada64d1fb8b143840689090fc82e52/packages/bazel/src/ng_package/packager.ts#L415.
 */
function generatePackageExports(
  { destinationPath, packageJson }: NgEntryPoint,
  graph: BuildGraph
): PackageExports {
  const exports: PackageExports = packageJson.exports
    ? JSON.parse(JSON.stringify(packageJson.exports))
    : {};

  const insertMappingOrError = (
    subpath: string,
    mapping: ConditionalExport
  ) => {
    if (exports[subpath] === undefined) {
      exports[subpath] = {};
    }

    const subpathExport = exports[subpath];

    // Go through all conditions that should be inserted. If the condition is already
    // manually set of the subpath export, we throw an error. In general, we allow for
    // additional conditions to be set. These will always precede the generated ones.
    for (const conditionName of Object.keys(mapping) as [
      keyof ConditionalExport
    ]) {
      if (subpathExport[conditionName] !== undefined) {
        throw Error(
          `Found a conflicting export condition for "${subpath}". The "${conditionName}" ` +
            `condition would be overridden by ng-packagr. Please unset it.`
        );
      }

      // **Note**: The order of the conditions is preserved even though we are setting
      // the conditions once at a time (the latest assignment will be at the end).
      subpathExport[conditionName] = mapping[conditionName];
    }
  };

  const relativeUnixFromDestPath = (filePath: string) =>
    './' + ensureUnixPath(path.relative(destinationPath, filePath));

  insertMappingOrError('./package.json', { default: './package.json' });

  const entryPoints = graph.filter(isEntryPoint);
  for (const entryPoint of entryPoints) {
    const { destinationFiles, isSecondaryEntryPoint } =
      entryPoint.data.entryPoint;
    const subpath = isSecondaryEntryPoint
      ? `./${destinationFiles.directory}`
      : '.';

    insertMappingOrError(subpath, {
      types: relativeUnixFromDestPath(destinationFiles.declarations),
      es2020: relativeUnixFromDestPath(destinationFiles.esm2020),
      esm2020: relativeUnixFromDestPath(destinationFiles.esm2020),
      default: relativeUnixFromDestPath(destinationFiles.esm2020),
    });
  }

  return exports;
}
