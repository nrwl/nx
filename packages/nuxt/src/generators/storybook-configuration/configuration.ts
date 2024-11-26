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

  const { root } = readProjectConfiguration(tree, options.project);

  tree.write(
    joinPathFragments(
      root,
      '.storybook',
      'preview.' + (options.tsConfiguration ? 'ts' : 'js')
    ),
    `import '../src/assets/css/styles.css';`
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
