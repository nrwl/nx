import {
  createProjectGraphAsync,
  formatFiles,
  names,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { createNodes, VitePluginOptions } from '../../plugins/plugin';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { buildPostTargetTransformer } from './lib/build-post-target-transformer';

interface Schema {
  project?: string;
  all?: boolean;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migratedBuildProjects =
    await migrateExecutorToPlugin<VitePluginOptions>(
      tree,
      projectGraph,
      '@nx/vite:build',
      '@nx/vite/plugin',
      (targetName) => ({
        buildTargetName: targetName,
        serveTargetName: 'serve',
        previewTargetName: 'preview',
        testTargetName: 'test',
        serveStaticTargetName: 'serve-static',
      }),
      buildPostTargetTransformer,
      createNodes,
      options.project
    );
  const migratedServeProjects =
    await migrateExecutorToPlugin<VitePluginOptions>(
      tree,
      projectGraph,
      '@nx/vite:dev-server',
      '@nx/vite/plugin',
      (targetName) => ({
        buildTargetName: 'build',
        serveTargetName: targetName,
        previewTargetName: 'preview',
        testTargetName: 'test',
        serveStaticTargetName: 'serve-static',
      }),
      postTargetTransformer,
      createNodes,
      options.project
    );
  const migratedPreviewProjects =
    await migrateExecutorToPlugin<VitePluginOptions>(
      tree,
      projectGraph,
      '@nx/vite:preview-server',
      '@nx/vite/plugin',
      (targetName) => ({
        buildTargetName: 'build',
        serveTargetName: 'serve',
        previewTargetName: targetName,
        testTargetName: 'test',
        serveStaticTargetName: 'serve-static',
      }),
      postTargetTransformer,
      createNodes,
      options.project
    );
  const migratedTestProjects = await migrateExecutorToPlugin<VitePluginOptions>(
    tree,
    projectGraph,
    '@nx/vite:test',
    '@nx/vite/plugin',
    (targetName) => ({
      buildTargetName: 'build',
      serveTargetName: 'serve',
      previewTargetName: 'preview',
      testTargetName: targetName,
      serveStaticTargetName: 'serve-static',
    }),
    postTargetTransformer,
    createNodes,
    options.project
  );

  const migratedProjects =
    migratedBuildProjects.size +
    migratedServeProjects.size +
    migratedPreviewProjects.size +
    migratedTestProjects.size;

  if (migratedProjects === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function postTargetTransformer(
  target: TargetConfiguration
): TargetConfiguration {
  if (target.options) {
    if (target.options?.config) {
      delete target.options.config;
    }

    for (const [key, value] of Object.entries(target.options)) {
      const newKeyName = names(key).fileName;
      delete target.options[key];
      target.options[newKeyName] = value;
    }
  }

  return target;
}

export default convertToInferred;
