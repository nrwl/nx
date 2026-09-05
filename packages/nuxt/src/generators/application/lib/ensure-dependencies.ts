import {
  addDependenciesToPackageJson,
  detectPackageManager,
  type Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import {
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
    '@nuxt/schema': nuxtVersions.nuxtSchema,
    '@nuxt/ui-templates': nuxtVersions.nuxtUiTemplates,
    nuxt: nuxtVersions.nuxt,
    h3: nuxtVersions.h3,
    vue: vueVersion,
    'vue-router': vueRouterVersion,
    'vue-tsc': vueTscVersion,
  };

  if (options.style === 'scss') {
    // sass pulls in @parcel/watcher, whose install script only builds from
    // source when npm_config_build_from_source is set.
    acknowledgeBuildScripts(host, detectPackageManager(host.root), {
      '@parcel/watcher': false,
    });
    devDependencies['sass'] = sassVersion;
  }

  return addDependenciesToPackageJson(
    host,
    {},
    devDependencies,
    undefined,
    true
  );
}
