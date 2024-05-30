import { createProjectGraphAsync, formatFiles, type Tree } from '@nx/devkit';
import { createNodes, VitePluginOptions } from '../../plugins/plugin';
import { migrateExecutorToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { buildPostTargetTransformer } from './lib/build-post-target-transformer';
import { servePostTargetTransformer } from './lib/serve-post-target-transformer';
import { previewPostTargetTransformer } from './lib/preview-post-target-transformer';
import { testPostTargetTransformer } from './lib/test-post-target-transformer';

interface Schema {
  project?: string;
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
      servePostTargetTransformer,
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
      previewPostTargetTransformer,
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
    testPostTargetTransformer,
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

export default convertToInferred;
