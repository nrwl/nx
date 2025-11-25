import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { storybookConfigurationGenerator as vueStorybookConfigurationGenerator } from '@nx/vue';
import { Schema } from './schema';

/*
 * This generator is basically the Vue one, but for Nuxt we
 * are just adding the styles in `.storybook/preview.ts`
 */
export async function storybookConfigurationGenerator(
  tree: Tree,
  options: Schema
) {
  const storybookConfigurationGenerator =
    await vueStorybookConfigurationGenerator(tree, {
      ...options,
      addPlugin: true,
    });

  const { root, sourceRoot } = readProjectConfiguration(tree, options.project);

  // Determine the source directory (app/ for Nuxt v4, src/ for Nuxt v3)
  const sourceDir = sourceRoot?.endsWith('/app')
    ? 'app'
    : sourceRoot?.endsWith('/src')
    ? 'src'
    : 'src'; // default to src for backward compatibility

  tree.write(
    joinPathFragments(
      root,
      '.storybook',
      'preview.' + (options.tsConfiguration ? 'ts' : 'js')
    ),
    `import '../${sourceDir}/assets/css/styles.css';`
  );

  updateJson(tree, `${root}/tsconfig.storybook.json`, (json) => {
    json.compilerOptions = {
      ...json.compilerOptions,
      composite: true,
    };
    return json;
  });

  await formatFiles(tree);
  return runTasksInSerial(storybookConfigurationGenerator);
}

export default storybookConfigurationGenerator;
