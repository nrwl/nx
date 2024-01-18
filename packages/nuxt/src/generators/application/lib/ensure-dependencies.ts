import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
  lessVersion,
  sassVersion,
  vueRouterVersion,
  vueTscVersion,
  vueVersion,
} from '@nx/vue';
import {
  h3Version,
  nuxtDevtoolsVersion,
  nuxtUiTemplatesVersion,
  nuxtVersion,
  nxVersion,
} from '../../../utils/versions';
import type { NormalizedSchema } from '../schema';

export function ensureDependencies(host: Tree, options: NormalizedSchema) {
  const devDependencies: Record<string, string> = {
    '@nx/vite': nxVersion, // needed for the nxViteTsPaths plugin and @nx/vite/plugin
    '@nuxt/devtools': nuxtDevtoolsVersion,
    '@nuxt/kit': nuxtVersion,
    '@nuxt/ui-templates': nuxtUiTemplatesVersion,
    nuxt: nuxtVersion,
    h3: h3Version,
    vue: vueVersion,
    'vue-router': vueRouterVersion,
    'vue-tsc': vueTscVersion,
  };

  if (options.style === 'scss') {
    devDependencies['sass'] = sassVersion;
  } else if (options.style === 'less') {
    devDependencies['less'] = lessVersion;
  }

  return addDependenciesToPackageJson(host, {}, devDependencies);
}
