import { type Tree, ensurePackage, joinPathFragments } from '@nx/devkit';
import { nxVersion } from '../../../../utils/versions';
import { NormalizedSchema, Schema } from '../../schema';

export async function setupViteConfiguration(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  const { createOrEditViteConfig, viteConfigurationGenerator } = ensurePackage<
    typeof import('@nx/vite')
  >('@nx/vite', nxVersion);
  // We recommend users use `import.meta.env.MODE` and other variables in their code to differentiate between production and development.
  // See: https://vitejs.dev/guide/env-and-mode.html
  if (
    tree.exists(joinPathFragments(options.appProjectRoot, 'src/environments'))
  ) {
    tree.delete(joinPathFragments(options.appProjectRoot, 'src/environments'));
  }

  const reactRouterFrameworkConfig = {
    imports: [`import { reactRouter } from '@react-router/dev/vite'`],
    plugins: ['!process.env.VITEST && reactRouter()'],
  };

  const baseReactConfig = {
    imports: [
      options.compiler === 'swc'
        ? `import react from '@vitejs/plugin-react-swc'`
        : `import react from '@vitejs/plugin-react'`,
    ],
    plugins: ['react()'],
  };

  const viteTask = await viteConfigurationGenerator(tree, {
    uiFramework: 'react',
    project: options.projectName,
    newProject: true,
    includeVitest: options.unitTestRunner === 'vitest',
    inSourceTests: options.inSourceTests,
    compiler: options.compiler,
    skipFormat: true,
    addPlugin: options.addPlugin,
    projectType: 'application',
  });
  tasks.push(viteTask);
  createOrEditViteConfig(
    tree,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: options.unitTestRunner === 'vitest',
      inSourceTests: options.inSourceTests,
      rollupOptionsExternal: ["'react'", "'react-dom'", "'react/jsx-runtime'"],
      ...(options.useReactRouter
        ? reactRouterFrameworkConfig
        : baseReactConfig),
    },
    false
  );
}

export async function setupVitestConfiguration(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  const { createOrEditViteConfig, vitestGenerator } = ensurePackage<
    typeof import('@nx/vite')
  >('@nx/vite', nxVersion);

  const vitestTask = await vitestGenerator(tree, {
    uiFramework: 'react',
    coverageProvider: 'v8',
    project: options.projectName,
    inSourceTests: options.inSourceTests,
    skipFormat: true,
    addPlugin: options.addPlugin,
  });
  tasks.push(vitestTask);
  createOrEditViteConfig(
    tree,
    {
      project: options.projectName,
      includeLib: false,
      includeVitest: true,
      inSourceTests: options.inSourceTests,
      rollupOptionsExternal: ["'react'", "'react-dom'", "'react/jsx-runtime'"],
      imports: [
        options.compiler === 'swc'
          ? `import react from '@vitejs/plugin-react-swc'`
          : `import react from '@vitejs/plugin-react'`,
      ],
      plugins: ['react()'],
    },
    true
  );
  if (options.bundler === 'rsbuild') {
    tree.rename(
      joinPathFragments(options.appProjectRoot, 'vite.config.ts'),
      joinPathFragments(options.appProjectRoot, 'vitest.config.ts')
    );
  }
}
