import type { NuxtOptions } from '@nuxt/schema';
import { joinPathFragments } from '@nx/devkit';

// Required because nuxi is ESM package.
export function loadNuxiDynamicImport() {
  return Function('return import("nuxi")')() as Promise<typeof import('nuxi')>;
}

export function loadNuxtKitDynamicImport() {
  return Function('return import("@nuxt/kit")')() as Promise<
    typeof import('@nuxt/kit')
  >;
}

export function getCommonNuxtConfigOverrides(
  config: NuxtOptions,
  contextRoot: string,
  projectRoot: string,
  outputPath: string
): Record<string, any> {
  return {
    workspaceDir: contextRoot,
    buildDir: config?.buildDir
      ? joinPathFragments(
          contextRoot,
          // By default, nuxt prepends rootDir (which is workspaceDir + projectRoot)
          // to buildDir. So we need to remove it, in order to preserve the expected behaviour
          // If you set `buildDir` in your nuxt.config.ts as `dist/my-app` you expect
          // it to be at the workspace root, as is true with all our other executors.
          config.buildDir.replace(config.rootDir, '')
        )
      : joinPathFragments(contextRoot, outputPath, '.nuxt'),
    nitro: {
      output: {
        dir: config?.nitro?.output?.dir
          ? joinPathFragments(contextRoot, config.nitro.output.dir)
          : joinPathFragments(contextRoot, outputPath, '.output'),
        serverDir: config?.nitro?.output?.serverDir
          ? joinPathFragments(contextRoot, config.nitro.output.serverDir)
          : joinPathFragments(contextRoot, outputPath, '.output/server'),
        publicDir: config?.nitro?.output?.publicDir
          ? joinPathFragments(contextRoot, config.nitro.output.publicDir)
          : joinPathFragments(contextRoot, outputPath, '.output/public'),
      },
    },
    typescript: {
      tsConfig: {
        extends: config?.typescript?.tsConfig?.extends
          ? joinPathFragments(contextRoot, config.typescript.tsConfig.extends)
          : joinPathFragments(contextRoot, projectRoot, 'tsconfig.app.json'),
      },
    },
  };
}
