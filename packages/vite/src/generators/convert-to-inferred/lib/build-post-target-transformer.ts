import {
  joinPathFragments,
  type TargetConfiguration,
  type Tree,
  workspaceRoot,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { relative, join, dirname, extname } from 'path/posix';

export function buildPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string }
) {
  let viteConfigPath = ['.ts', '.js'].find((ext) =>
    tree.exists(joinPathFragments(projectDetails.root, `vite.config${ext}`))
  );

  if (target.options) {
    if (target.options.configFile) {
      viteConfigPath = target.options.configFile;
      target.options.config = target.options.configFile;
      delete target.options.configFile;
    }

    if (target.options.outputPath) {
      let relativeOutputPath = relative(
        projectDetails.root,
        join(workspaceRoot, target.options.outputPath)
      );
      if (tree.isFile(relativeOutputPath)) {
        relativeOutputPath = dirname(relativeOutputPath);
      }
      moveOutputPathToViteConfig(tree, relativeOutputPath, viteConfigPath);

      delete target.options.outputPath;
    }

    if ('buildLibsFromSource' in target.options) {
      moveBuildLibsFromSourceToViteConfig(
        tree,
        target.options.buildLibsFromSource,
        viteConfigPath
      );
      delete target.options.buildLibsFromSource;
    }

    if ('skipTypeCheck' in target.options) {
      delete target.options.skipTypeCheck;
    }
    if ('generatePackageJson' in target.options) {
      delete target.options.generatePackageJson;
    }
    if ('includeDevDependenciesInPackageJson' in target.options) {
      delete target.options.includeDevDependenciesInPackageJson;
    }
    if ('tsConfig' in target.options) {
      delete target.options.tsConfig;
    }
  }

  return target;
}

export function moveOutputPathToViteConfig(
  tree: Tree,
  outputPath: string,
  configPath: string
) {
  const OUT_DIR_PROPERTY_SELECTOR =
    'PropertyAssignment:has(Identifier[name=build]) ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=outDir])';
  const BUILD_PROPERTY_SELECTOR =
    'PropertyAssignment:has(Identifier[name=build]) > ObjectLiteralExpression';

  const viteConfigContents = tree.read(configPath, 'utf-8');
  let newViteConfigContents = viteConfigContents;

  const ast = tsquery.ast(viteConfigContents);
  const outDirNodes = tsquery(ast, OUT_DIR_PROPERTY_SELECTOR, {
    visitAllChildren: true,
  });
  if (outDirNodes.length === 0) {
    // Add outDir to build
    const buildPropertyNodes = tsquery(ast, BUILD_PROPERTY_SELECTOR, {
      visitAllChildren: true,
    });
    if (buildPropertyNodes.length === 0) {
      return;
    }

    newViteConfigContents = `${viteConfigContents.slice(
      0,
      buildPropertyNodes[0].getStart() + 1
    )}outDir: '${outputPath}',${viteConfigContents.slice(
      buildPropertyNodes[0].getStart() + 1
    )}`;
  } else {
    const outDirValueNodes = tsquery(outDirNodes[0], 'StringLiteral');
    if (outDirValueNodes.length === 0) {
      return;
    }

    newViteConfigContents = `${viteConfigContents.slice(
      0,
      outDirValueNodes[0].getStart()
    )}'${outputPath}'${viteConfigContents.slice(outDirValueNodes[0].getEnd())}`;
  }

  tree.write(configPath, newViteConfigContents);
}

export function moveBuildLibsFromSourceToViteConfig(
  tree: Tree,
  buildLibsFromSource: boolean,
  configPath: string
) {
  const PLUGINS_PROPERTY_SELECTOR =
    'PropertyAssignment:has(Identifier[name=plugins])';
  const PLUGINS_NX_VITE_TS_PATHS_SELECTOR =
    'PropertyAssignment:has(Identifier[name=plugins]) CallExpression:has(Identifier[name=nxViteTsPaths])';
  const BUILD_LIBS_FROM_SOURCE_SELECTOR =
    'PropertyAssignment:has(Identifier[name=plugins]) CallExpression:has(Identifier[name=nxViteTsPaths]) ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=buildLibsFromSource])';

  const nxViteTsPathsImport =
    extname(configPath) === 'js'
      ? 'const {nxViteTsPaths} = require("@nx/vite/plugins/nx-tsconfig-paths.plugin");'
      : 'import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";';
  const plugin = `nxViteTsPaths({ buildLibsFromSource: ${buildLibsFromSource} }),`;

  const viteConfigContents = tree.read(configPath, 'utf-8');
  let newViteConfigContents = viteConfigContents;

  const ast = tsquery.ast(viteConfigContents);
  const buildLibsFromSourceNodes = tsquery(
    ast,
    BUILD_LIBS_FROM_SOURCE_SELECTOR,
    { visitAllChildren: true }
  );
  if (buildLibsFromSourceNodes.length > 0) {
    return;
  }

  const nxViteTsPathsNodes = tsquery(ast, PLUGINS_NX_VITE_TS_PATHS_SELECTOR, {
    visitAllChildren: true,
  });
  if (nxViteTsPathsNodes.length === 0) {
    const pluginsNodes = tsquery(ast, PLUGINS_PROPERTY_SELECTOR, {
      visitAllChildren: true,
    });
    if (pluginsNodes.length === 0) {
      // Add plugin property
      const configNodes = tsquery(
        ast,
        'CallExpression:has(Identifier[name=defineConfig]) > ObjectLiteralExpression',
        { visitAllChildren: true }
      );
      if (configNodes.length === 0) {
        return;
      }

      newViteConfigContents = `${nxViteTsPathsImport}\n${viteConfigContents.slice(
        0,
        configNodes[0].getStart() + 1
      )}plugins: [${plugin}],${viteConfigContents.slice(
        configNodes[0].getStart() + 1
      )}`;
    } else {
      // Add nxViteTsPaths plugin

      const pluginsArrayNodes = tsquery(
        pluginsNodes[0],
        'ArrayLiteralExpression'
      );
      if (pluginsArrayNodes.length === 0) {
        return;
      }

      newViteConfigContents = `${nxViteTsPathsImport}\n${viteConfigContents.slice(
        0,
        pluginsArrayNodes[0].getStart() + 1
      )}${plugin}${viteConfigContents.slice(
        pluginsArrayNodes[0].getStart() + 1
      )}`;
    }
  } else {
    const pluginOptionsNodes = tsquery(
      nxViteTsPathsNodes[0],
      'ObjectLiteralExpression'
    );
    if (pluginOptionsNodes.length === 0) {
      // Add the options
      newViteConfigContents = `${viteConfigContents.slice(
        0,
        nxViteTsPathsNodes[0].getStart()
      )}${plugin}${viteConfigContents.slice(nxViteTsPathsNodes[0].getEnd())}`;
    } else {
      // update the object
      newViteConfigContents = `${viteConfigContents.slice(
        0,
        pluginOptionsNodes[0].getStart() + 1
      )}buildLibsFromSource: ${buildLibsFromSource}, ${viteConfigContents.slice(
        pluginOptionsNodes[0].getStart() + 1
      )}`;
    }
  }

  tree.write(configPath, newViteConfigContents);
}
