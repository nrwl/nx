import { type TargetConfiguration, type Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { extname } from 'path/posix';
import {
  addConfigValuesToViteConfig,
  getViteConfigPath,
  toProjectRelativePath,
} from './utils';
import { processTargetOutputs } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';

export function buildPostTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTargetConfiguration: TargetConfiguration
) {
  let viteConfigPath = getViteConfigPath(tree, projectDetails.root);

  const configValues: Record<string, Record<string, unknown>> = {
    default: {},
  };

  if (target.options) {
    if (target.options.configFile) {
      viteConfigPath = target.options.configFile;
    }

    removePropertiesFromTargetOptions(
      tree,
      target.options,
      viteConfigPath,
      projectDetails.root,
      configValues['default'],
      true
    );
  }

  if (target.configurations) {
    for (const configurationName in target.configurations) {
      const configuration = target.configurations[configurationName];
      configValues[configuration] = {};
      removePropertiesFromTargetOptions(
        tree,
        configuration,
        viteConfigPath,
        projectDetails.root,
        configValues[configuration]
      );

      if (Object.keys(configuration).length === 0) {
        delete target.configurations[configurationName];
      }
    }

    if (Object.keys(target.configurations).length === 0) {
      if ('defaultConfiguration' in target) {
        delete target.defaultConfiguration;
      }
      delete target.configurations;
    }

    if (
      'defaultConfiguration' in target &&
      !target.configurations[target.defaultConfiguration]
    ) {
      delete target.defaultConfiguration;
    }
  }

  if (target.outputs) {
    processTargetOutputs(
      target,
      [{ newName: 'outDir', oldName: 'outputPath' }],
      inferredTargetConfiguration,
      {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      }
    );
  }

  if (
    target.inputs &&
    target.inputs.every((i) => i === 'production' || i === '^production')
  ) {
    delete target.inputs;
  }

  addConfigValuesToViteConfig(tree, viteConfigPath, configValues);

  return target;
}

function removePropertiesFromTargetOptions(
  tree: Tree,
  targetOptions: any,
  viteConfigPath: string,
  projectRoot: string,
  configValues: Record<string, unknown>,
  defaultOptions = false
) {
  if ('configFile' in targetOptions) {
    targetOptions.config = toProjectRelativePath(
      targetOptions.configFile,
      projectRoot
    );
    delete targetOptions.configFile;
  }
  if (targetOptions.outputPath) {
    targetOptions.outDir = toProjectRelativePath(
      targetOptions.outputPath,
      projectRoot
    );

    delete targetOptions.outputPath;
  }
  if ('buildLibsFromSource' in targetOptions) {
    configValues['buildLibsFromSource'] = targetOptions.buildLibsFromSource;

    if (defaultOptions) {
      moveBuildLibsFromSourceToViteConfig(tree, viteConfigPath);
    }
    delete targetOptions.buildLibsFromSource;
  }
  if ('skipTypeCheck' in targetOptions) {
    delete targetOptions.skipTypeCheck;
  }
  if ('generatePackageJson' in targetOptions) {
    delete targetOptions.generatePackageJson;
  }
  if ('includeDevDependenciesInPackageJson' in targetOptions) {
    delete targetOptions.includeDevDependenciesInPackageJson;
  }
  if ('tsConfig' in targetOptions) {
    delete targetOptions.tsConfig;
  }
}

export function moveBuildLibsFromSourceToViteConfig(
  tree: Tree,
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
  const plugin = `nxViteTsPaths({ buildLibsFromSource: options.buildLibsFromSource }),`;

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
      )}buildLibsFromSource: options.buildLibsFromSource, ${viteConfigContents.slice(
        pluginOptionsNodes[0].getStart() + 1
      )}`;
    }
  }

  tree.write(configPath, newViteConfigContents);
}
