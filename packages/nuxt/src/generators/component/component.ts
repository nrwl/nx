import { formatFiles, Tree } from '@nx/devkit';
import { componentGenerator as vueComponentGenerator } from '@nx/vue';
import { Schema } from './schema';

/*
 * This generator is basically the Vue one, but for Nuxt we
 * are just adjusting some options
 */
export async function componentGenerator(host: Tree, options: Schema) {
  await vueComponentGenerator(host, {
    ...options,
    routing: false,
    skipFormat: true,
    directory: options.directory ?? 'components',
  });

  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

export default componentGenerator;
