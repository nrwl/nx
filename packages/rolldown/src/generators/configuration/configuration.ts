import {
  formatFiles,
  type GeneratorCallback,
  joinPathFragments,
  normalizePath,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { relative } from 'node:path';
import { rolldownInitGenerator } from '../init/init';
import type { Schema } from './schema';

const configExtensions = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];

export async function configurationGenerator(
  tree: Tree,
  options: Schema
): Promise<GeneratorCallback> {
  const project = readProjectConfiguration(tree, options.project);
  const existing = configExtensions
    .map((ext) => joinPathFragments(project.root, `rolldown.config.${ext}`))
    .find((f) => tree.exists(f));
  if (existing) {
    throw new Error(
      `Project "${options.project}" already has a Rolldown config at "${existing}".`
    );
  }

  const task = await rolldownInitGenerator(tree, {
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
  });

  const fromRoot = (path: string) =>
    normalizePath(relative(project.root, path)) || '.';
  const main = options.main ?? defaultMain(tree, project.root);
  const outputPath =
    options.outputPath ??
    (isUsingTsSolutionSetup(tree)
      ? joinPathFragments(project.root, 'dist')
      : joinPathFragments('dist', project.root));
  const tsConfig = options.tsConfig ?? defaultTsConfig(tree, project.root);
  const platform = options.platform ?? 'node';
  // Browser bundles cannot resolve packages at runtime.
  const externalDependencies =
    options.externalDependencies ?? platform === 'node';
  // Apps without their own package.json declare dependencies at the root.
  const packageJsonPath = tree.exists(
    joinPathFragments(project.root, 'package.json')
  )
    ? './package.json'
    : fromRoot('package.json');

  tree.write(
    joinPathFragments(project.root, 'rolldown.config.ts'),
    `import { defineConfig } from 'rolldown';${
      externalDependencies
        ? `
${
  packageJsonPath === './package.json'
    ? ''
    : '// eslint-disable-next-line @nx/enforce-module-boundaries\n'
}import packageJson from '${packageJsonPath}' with { type: 'json' };

// Installed at runtime instead of bundled (native addons, dynamic requires).
const dependencies = Object.keys(packageJson.dependencies);`
        : ''
    }

export default defineConfig([
  {
    input: '${fromRoot(main)}',
    platform: '${platform}',${
      tsConfig ? `\n    tsconfig: '${fromRoot(tsConfig)}',` : ''
    }${
      externalDependencies
        ? `
    external: (id) =>
      dependencies.some((dep) => id === dep || id.startsWith(\`\${dep}/\`)),`
        : ''
    }
    output: {
      dir: '${fromRoot(outputPath)}',
      cleanDir: true,
      format: '${options.format ?? 'esm'}',
      sourcemap: true,
    },
  },
]);
`
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

function defaultMain(tree: Tree, projectRoot: string): string {
  const main = joinPathFragments(projectRoot, 'src/main.ts');
  return tree.exists(main)
    ? main
    : joinPathFragments(projectRoot, 'src/index.ts');
}

function defaultTsConfig(tree: Tree, projectRoot: string): string | undefined {
  return ['tsconfig.app.json', 'tsconfig.lib.json']
    .map((f) => joinPathFragments(projectRoot, f))
    .find((f) => tree.exists(f));
}

export default configurationGenerator;
