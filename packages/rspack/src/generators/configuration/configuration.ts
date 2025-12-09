import {
  formatFiles,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
  writeJson,
} from '@nx/devkit';
import { relative } from 'path';
import {
  addOrChangeBuildTarget,
  addOrChangeServeTarget,
  deleteWebpackConfig,
  determineFrameworkAndTarget,
  findExistingTargetsInProject,
  handleUnknownExecutors,
  handleUnsupportedUserProvidedTargets,
  TargetFlags,
  UserProvidedTargetName,
  writeRspackConfigFile,
} from '../../utils/generator-utils';
import rspackInitGenerator from '../init/init';
import { ConfigurationSchema } from './schema';
import { getProjectType } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { Framework } from '../init/schema';

function projectIsRootProjectInStandaloneWorkspace(projectRoot: string) {
  return relative(workspaceRoot, projectRoot).length === 0;
}

function editTsConfig(
  tree: Tree,
  projectRoot: string,
  framework: Framework,
  relativePathToRootTsConfig: string
) {
  // Nx 15.8 moved util to @nx/js, but it is in @nx/workspace in 15.7
  let shared: any;
  try {
    shared = require('@nx/js/src/utils/typescript/create-ts-config');
  } catch {
    shared = require('@nx/workspace/src/utils/create-ts-config');
  }

  if (framework === 'react') {
    const json = {
      compilerOptions: {
        jsx: 'react-jsx',
        allowJs: false,
        esModuleInterop: false,
        allowSyntheticDefaultImports: true,
        strict: true,
      },
      files: [],
      include: [],
      references: [
        {
          path: './tsconfig.app.json',
        },
      ],
    } as any;

    // inline tsconfig.base.json into the project
    if (projectIsRootProjectInStandaloneWorkspace(projectRoot)) {
      json.compileOnSave = false;
      json.compilerOptions = {
        ...shared.tsConfigBaseOptions,
        ...json.compilerOptions,
      };
      json.exclude = ['node_modules', 'tmp'];
    } else {
      json.extends = relativePathToRootTsConfig;
    }

    writeJson(tree, `${projectRoot}/tsconfig.json`, json);
  }
}

export async function configurationGenerator(
  tree: Tree,
  options: ConfigurationSchema
) {
  const task = await rspackInitGenerator(tree, {
    ...options,
  });
  const { targets, root, projectType } = readProjectConfiguration(
    tree,
    options.project
  );

  const { target, framework } = determineFrameworkAndTarget(
    tree,
    options,
    root,
    targets
  );
  options.framework = framework;
  options.target = target;

  let foundStylePreprocessorOptions: { includePaths?: string[] } | undefined;

  let buildTargetName = 'build';
  let serveTargetName = 'serve';

  /**
   * This is for when we are converting an existing project
   * to use the vite executors.
   */
  let projectAlreadyHasRspackTargets: TargetFlags = {};

  if (!options.newProject) {
    const userProvidedTargetName: UserProvidedTargetName = {
      build: options.buildTarget,
      serve: options.serveTarget,
    };

    const {
      validFoundTargetName,
      projectContainsUnsupportedExecutor,
      userProvidedTargetIsUnsupported,
      alreadyHasNxRspackTargets,
    } = findExistingTargetsInProject(targets, userProvidedTargetName);
    projectAlreadyHasRspackTargets = alreadyHasNxRspackTargets;

    if (
      alreadyHasNxRspackTargets.build &&
      (alreadyHasNxRspackTargets.serve ||
        getProjectType(tree, options.project, projectType) === 'library' ||
        options.framework === 'nest')
    ) {
      throw new Error(
        `The project ${options.project} is already configured to use the @nx/rspack executors.
        Please try a different project, or remove the existing targets
        and re-run this generator to reset the existing Rspack Configuration.
        `
      );
    }

    if (!validFoundTargetName.build && projectContainsUnsupportedExecutor) {
      throw new Error(
        `The project ${options.project} cannot be converted to use the @nx/rspack executors.`
      );
    }

    if (
      !projectContainsUnsupportedExecutor &&
      !validFoundTargetName.build &&
      !validFoundTargetName.serve
    ) {
      await handleUnknownExecutors(options.project);
    }

    await handleUnsupportedUserProvidedTargets(
      userProvidedTargetIsUnsupported,
      userProvidedTargetName,
      validFoundTargetName,
      options.framework
    );

    /**
     * Once the user is at this stage, then they can go ahead and convert.
     */

    buildTargetName = validFoundTargetName.build ?? buildTargetName;
    serveTargetName = validFoundTargetName.serve ?? serveTargetName;

    // Not needed atm
    // if (projectType === 'application' && options.target !== 'node') {
    //   moveAndEditIndexHtml(tree, options, buildTargetName);
    // }

    foundStylePreprocessorOptions =
      targets?.[buildTargetName]?.options?.stylePreprocessorOptions;

    deleteWebpackConfig(
      tree,
      root,
      targets?.[buildTargetName]?.options?.webpackConfig
    );

    editTsConfig(
      tree,
      root,
      options.framework,
      joinPathFragments(offsetFromRoot(root), 'tsconfig.base.json')
    );
  }

  if (!projectAlreadyHasRspackTargets.build) {
    addOrChangeBuildTarget(tree, options, buildTargetName);
  }

  if (
    (options.framework !== 'none' || options.devServer) &&
    options.framework !== 'nest' &&
    !projectAlreadyHasRspackTargets.serve
  ) {
    addOrChangeServeTarget(tree, options, serveTargetName);
  }
  writeRspackConfigFile(tree, options, foundStylePreprocessorOptions);
  await formatFiles(tree);
  return task;
}

export default configurationGenerator;
