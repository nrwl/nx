import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { RspackExecutorSchema } from '../../executors/rspack/schema';
import rspackInitGenerator from '../init/init';
import { ConfigurationSchema } from './schema';

export async function configurationGenerator(
  tree: Tree,
  options: ConfigurationSchema
) {
  const task = await rspackInitGenerator(tree, options);
  const { targets, root } = readProjectConfiguration(tree, options.project);
  const foundStylePreprocessorOptions: { includePaths?: string[] } | undefined =
    targets?.build?.options?.stylePreprocessorOptions;

  const { target, uiFramework } = determineFrameworkAndTarget(
    tree,
    options,
    root,
    targets
  );
  options.uiFramework = uiFramework;
  options.target = target;

  addBuildTarget(tree, options);
  if (options.uiFramework !== 'none' || options.devServer) {
    addServeTarget(tree, options);
  }
  writeRspackConfigFile(tree, options, foundStylePreprocessorOptions);
  await formatFiles(tree);
  return task;
}

function determineFrameworkAndTarget(
  tree: Tree,
  options: ConfigurationSchema,
  projectRoot: string,
  targets: {
    [targetName: string]: TargetConfiguration<any>;
  }
): { target: 'node' | 'web'; uiFramework?: 'none' | 'react' | 'web' } {
  // First try to infer if the target is node
  if (options.target !== 'node') {
    // Try to infer from jest config if the env is node
    let jestConfigPath: string;
    if (
      targets?.test?.executor !== '@nrwl/jest:jest' &&
      targets?.test?.options?.jestConfig
    ) {
      jestConfigPath = targets?.test?.options?.jestConfig;
    } else {
      jestConfigPath = joinPathFragments(projectRoot, 'jest.config.ts');
    }

    if (!tree.exists(jestConfigPath)) {
      return { target: options.target, uiFramework: options.uiFramework };
    }
    const appFileContent = tree.read(jestConfigPath, 'utf-8');
    const file = tsquery.ast(appFileContent);
    // find testEnvironment: 'node' in jest config
    const testEnvironment = tsquery(
      file,
      `PropertyAssignment:has(Identifier[name="testEnvironment"]) > StringLiteral[value="node"]`
    );
    if (testEnvironment.length > 0) {
      return { target: 'node', uiFramework: options.uiFramework };
    }
  }

  if (options.uiFramework !== 'react' && options.target === 'web') {
    // Look if React is used in the project
    let tsConfigPath = joinPathFragments(projectRoot, 'tsconfig.json');
    if (!tree.exists(tsConfigPath)) {
      tsConfigPath = determineTsConfig(tree, options);
    }
    const tsConfig = JSON.parse(tree.read(tsConfigPath).toString());
    if (tsConfig?.compilerOptions?.jsx?.includes('react')) {
      return { target: 'web', uiFramework: 'react' };
    } else {
      return { target: options.target, uiFramework: options.uiFramework };
    }
  }
}

function determineMain(tree: Tree, options: ConfigurationSchema) {
  if (options.main) return options.main;

  const project = readProjectConfiguration(tree, options.project);

  const mainTsx = joinPathFragments(project.root, 'src/main.tsx');
  if (tree.exists(mainTsx)) return mainTsx;

  return joinPathFragments(project.root, 'src/main.ts');
}

function determineTsConfig(tree: Tree, options: ConfigurationSchema) {
  if (options.tsConfig) return options.tsConfig;

  const project = readProjectConfiguration(tree, options.project);

  const appJson = joinPathFragments(project.root, 'tsconfig.app.json');
  if (tree.exists(appJson)) return appJson;

  const libJson = joinPathFragments(project.root, 'tsconfig.lib.json');
  if (tree.exists(libJson)) return libJson;

  return joinPathFragments(project.root, 'tsconfig.json');
}

function addBuildTarget(tree: Tree, options: ConfigurationSchema) {
  const project = readProjectConfiguration(tree, options.project);

  const assets = [];
  if (
    options.target === 'web' &&
    tree.exists(joinPathFragments(project.root, 'src/favicon.ico'))
  ) {
    assets.push(joinPathFragments(project.root, 'src/favicon.ico'));
  }
  if (tree.exists(joinPathFragments(project.root, 'src/assets'))) {
    assets.push(joinPathFragments(project.root, 'src/assets'));
  }

  const buildOptions: RspackExecutorSchema = {
    target: options.target ?? 'web',
    outputPath: joinPathFragments(
      'dist',
      // If standalone project then use the project's name in dist.
      project.root === '.' ? project.name : project.root
    ),
    main: determineMain(tree, options),
    tsConfig: determineTsConfig(tree, options),
    rspackConfig: joinPathFragments(project.root, 'rspack.config.js'),
    assets,
  };

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      build: {
        executor: '@nrwl/rspack:rspack',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
            optimization: options.target === 'web' ? true : undefined,
            sourceMap: false,
          },
        },
      },
    },
  });
}

function addServeTarget(tree: Tree, options: ConfigurationSchema) {
  const project = readProjectConfiguration(tree, options.project);
  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      serve: {
        executor: '@nrwl/rspack:dev-server',
        options: {
          buildTarget: `${options.project}:build:development`,
        },
        configurations: {
          development: {},
          production: {
            buildTarget: `${options.project}:build:production`,
          },
        },
      },
    },
  });
}

function writeRspackConfigFile(
  tree: Tree,
  options: ConfigurationSchema,
  stylePreprocessorOptions?: { includePaths?: string[] }
) {
  const project = readProjectConfiguration(tree, options.project);

  tree.write(
    joinPathFragments(project.root, 'rspack.config.js'),
    createConfig(options, stylePreprocessorOptions)
  );

  // Remove previous webpack config if they exist
  if (tree.exists(joinPathFragments(project.root, 'webpack.config.js')))
    tree.delete(joinPathFragments(project.root, 'webpack.config.js'));
  if (tree.exists(joinPathFragments(project.root, 'webpack.config.ts')))
    tree.delete(joinPathFragments(project.root, 'webpack.config.ts'));
}

function createConfig(
  options: ConfigurationSchema,
  stylePreprocessorOptions?: { includePaths?: string[] }
) {
  if (options.uiFramework === 'react') {
    return `
      const { composePlugins, withNx, withReact } = require('@nrwl/rspack');

      module.exports = composePlugins(withNx(), withReact(${
        stylePreprocessorOptions
          ? `
        {
          stylePreprocessorOptions: ${JSON.stringify(stylePreprocessorOptions)},
        }
        `
          : ''
      }), (config) => {
        return config;
      });
    `;
  } else if (options.uiFramework === 'web' || options.target === 'web') {
    return `
      const { composePlugins, withNx, withWeb } = require('@nrwl/rspack');

      module.exports = composePlugins(withNx(), withWeb(${
        stylePreprocessorOptions
          ? `
        {
          stylePreprocessorOptions: ${JSON.stringify(stylePreprocessorOptions)},
        }
        `
          : ''
      }), (config) => {
        return config;
      });
    `;
  } else {
    return `
      const { composePlugins, withNx${
        stylePreprocessorOptions ? ', withWeb' : ''
      } } = require('@nrwl/rspack');

      module.exports = composePlugins(withNx()${
        stylePreprocessorOptions
          ? `,
        withWeb({
          stylePreprocessorOptions: ${JSON.stringify(stylePreprocessorOptions)},
        })`
          : ''
      }, (config) => {
        return config;
      });
    `;
  }
}

export default configurationGenerator;
