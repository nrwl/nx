import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import type { Schema } from '../schema';

export function updateProjectConfig(tree: Tree, schema: Schema) {
  let projectConfig = readProjectConfiguration(tree, schema.project);

  projectConfig.targets.build.options.outputPath = `dist/apps/${schema.project}/browser`;

  const buildTargetFileReplacements =
    projectConfig.targets.build.configurations?.production?.fileReplacements;

  projectConfig.targets.server = {
    executor: '@angular-devkit/build-angular:server',
    options: {
      outputPath: `dist/${projectConfig.root}/server`,
      main: joinPathFragments(projectConfig.root, schema.serverFileName),
      tsConfig: joinPathFragments(projectConfig.root, 'tsconfig.server.json'),
    },
    configurations: {
      production: {
        outputHashing: 'media',
        ...(buildTargetFileReplacements
          ? { fileReplacements: buildTargetFileReplacements }
          : {}),
      },
      development: {
        optimization: false,
        sourceMap: true,
        extractLicenses: false,
      },
    },
    defaultConfiguration: 'production',
  };

  projectConfig.targets['serve-ssr'] = {
    executor: '@nguniversal/builders:ssr-dev-server',
    configurations: {
      development: {
        browserTarget: `${schema.project}:build:development`,
        serverTarget: `${schema.project}:server:development`,
      },
      production: {
        browserTarget: `${schema.project}:build:production`,
        serverTarget: `${schema.project}:server:production`,
      },
    },
    defaultConfiguration: 'development',
  };

  projectConfig.targets.prerender = {
    executor: '@nguniversal/builders:prerender',
    options: {
      routes: ['/'],
    },
    configurations: {
      development: {
        browserTarget: `${schema.project}:build:development`,
        serverTarget: `${schema.project}:server:development`,
      },
      production: {
        browserTarget: `${schema.project}:build:production`,
        serverTarget: `${schema.project}:server:production`,
      },
    },
    defaultConfiguration: 'production',
  };

  updateProjectConfiguration(tree, schema.project, projectConfig);
}
