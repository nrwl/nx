import { formatFiles, runTasksInSerial, Tree } from '@nx/devkit';
import { componentGenerator as vueComponentGenerator } from '@nx/vue';
import { Schema } from './schema';

/*
 * This generator is basically the Vue one, but for Nuxt we
 * are just adjusting some options
 */
export async function componentGenerator(host: Tree, options: Schema) {
  const componentGenerator = await vueComponentGenerator(host, {
    ...options,
    routing: false,
    skipFormat: true,
  });

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(componentGenerator);
}

export default componentGenerator;
