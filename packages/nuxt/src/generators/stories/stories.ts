import { runTasksInSerial, Tree } from '@nx/devkit';
import {
  storiesGenerator as vueStoriesGenerator,
  StorybookStoriesSchema,
} from '@nx/vue';

/*
 * This generator is basically the Vue one
 */
export async function storiesGenerator(
  host: Tree,
  options: StorybookStoriesSchema
) {
  const storiesGenerator = await vueStoriesGenerator(host, {
    ...options,
  });

  return runTasksInSerial(storiesGenerator);
}

export default storiesGenerator;
