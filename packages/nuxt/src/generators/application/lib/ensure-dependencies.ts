import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
  lessVersion,
  sassVersion,
  vueRouterVersion,
  vueTscVersion,
  vueVersion,
} from '@nx/vue';
import { nxVersion } from '../../../utils/versions';
import { getNuxtDependenciesVersionsToInstall } from '../../../utils/version-utils';
import type { NormalizedSchema } from '../schema';

export async function ensureDependencies(
  host: Tree,
  options: NormalizedSchema
) {
  const nuxtVersions = await getNuxtDependenciesVersionsToInstall(host);

  const devDependencies: Record<string, string> = {
    '@nx/vite': nxVersion, // needed for the nxViteTsPaths plugin and @nx/vite/plugin
    '@nuxt/devtools': nuxtVersions.nuxtDevtools,
    '@nuxt/kit': nuxtVersions.nuxtKit,
    '@nuxt/ui-templates': nuxtVersions.nuxtUiTemplates,
    nuxt: nuxtVersions.nuxt,
    h3: nuxtVersions.h3,
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
