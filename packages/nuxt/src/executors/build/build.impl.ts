import { ExecutorContext, joinPathFragments } from '@nx/devkit';
import { NuxtBuildExecutorOptions } from './schema';

// Required because nuxi is ESM package.
export function loadNuxiDynamicImport() {
  return Function('return import("nuxi")')() as Promise<typeof import('nuxi')>;
}

export async function* nuxtBuildExecutor(
  options: NuxtBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const { runCommand } = await loadNuxiDynamicImport();
  try {
    await runCommand('build', [projectRoot], {
      overrides: {
        ...options,
        workspaceDir: context.root,
        buildDir: joinPathFragments(context.root, options.outputPath, '.nuxt'),
        typescript: {
          typeCheck: true,
          tsConfig: {
            extends: joinPathFragments(
              context.root,
              projectRoot,
              'tsconfig.app.json'
            ),
          },
        },
        imports: {
          autoImport: false,
        },
        nitro: {
          output: {
            dir: joinPathFragments(context.root, options.outputPath, '.output'),
            serverDir: joinPathFragments(
              context.root,
              options.outputPath,
              '.output/server'
            ),
            publicDir: joinPathFragments(
              context.root,
              options.outputPath,
              '.output/public'
            ),
          },
        },
      },
    });
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: e };
  }
}

export default nuxtBuildExecutor;
