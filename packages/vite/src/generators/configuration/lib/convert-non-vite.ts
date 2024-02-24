import {
  TargetConfiguration,
  Tree,
  joinPathFragments,
  logger,
} from '@nx/devkit';
import {
  findViteConfig,
  findWebpackConfig,
} from '../../../utils/find-vite-config';
import { ViteConfigurationGeneratorSchema } from '../schema';
import {
  deleteWebpackConfig,
  editTsConfig,
  findExistingJsBuildTargetInProject,
  handleUnknownConfiguration,
  moveAndEditIndexHtml,
} from '../../../utils/generator-utils';

export async function convertNonVite(
  tree: Tree,
  schema: ViteConfigurationGeneratorSchema,
  projectRoot: string,
  projectType: string,
  targets: {
    [targetName: string]: TargetConfiguration<any>;
  }
) {
  // Check if it has vite
  const hasViteConfig = findViteConfig(tree, projectRoot);
  const hasIndexHtmlAtRoot = tree.exists(
    joinPathFragments(projectRoot, 'index.html')
  );

  // Check if it has webpack
  const hasWebpackConfig = findWebpackConfig(tree, projectRoot);
  if (hasWebpackConfig) {
    if (projectType === 'application') {
      moveAndEditIndexHtml(tree, schema);
    }
    deleteWebpackConfig(tree, projectRoot, hasWebpackConfig);
    editTsConfig(tree, schema);
    return;
  }

  if (
    projectType === 'application' &&
    hasViteConfig &&
    hasIndexHtmlAtRoot &&
    !hasWebpackConfig
  ) {
    throw new Error(
      `The project ${schema.project} is already configured to use Vite.`
    );
    return;
  }

  if (projectType === 'library' && hasViteConfig) {
    // continue anyway - it could need to be updated - only update vite.config.ts in any case
    editTsConfig(tree, schema);
    return;
  }

  // Does the project have js executors?
  const { supported: jsTargetName, unsupported } =
    findExistingJsBuildTargetInProject(targets);
  if (jsTargetName) {
    editTsConfig(tree, schema);
    return;
  }

  if (unsupported) {
    throw new Error(`
      Nx cannot convert your project to use vite.
      Please try again with a different project.
    `);
  }

  // If it's a library, it's most possible it's non-buildable
  // So fix the tsconfig and return, to continue with the rest of the setup
  if (
    projectType === 'library' &&
    !hasViteConfig &&
    !hasWebpackConfig &&
    !jsTargetName
  ) {
    editTsConfig(tree, schema);
    return;
  }

  /**
   * The project is an app.
   * The project has no js executors, no webpack config, no vite config.
   * We did not find any configuration that hints the project can
   * definitely be converted.
   * So, we should warn the user about it.
   * They can choose whether to convert it or not
   */
  await handleUnknownConfiguration(schema.project);
}
