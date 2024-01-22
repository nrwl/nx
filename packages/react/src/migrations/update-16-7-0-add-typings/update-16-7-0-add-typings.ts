import {
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
  readJson,
  updateJson,
} from '@nx/devkit';

export default async function addTypings(tree: Tree) {
  const projects = getProjects(tree);
  const buildExecutors = [
    '@nx/webpack:webpack',
    '@nx/vite:build',
    '@nx/rspack:rspack',
  ];
  const serveExecutors = [
    '@nx/webpack:dev-server',
    '@nx/vite:dev-server',
    '@nx/rspack:dev-server',
  ];
  const relatedTsConfigs = [
    'tsconfig.app.json',
    'tsconfig.lib.json',
    'tsconfig.spec.json',
  ];

  const typesToAdd = [
    '@nx/react/typings/cssmodule.d.ts',
    '@nx/react/typings/image.d.ts',
  ];

  for (const [, config] of projects) {
    if (!buildExecutors.includes(config?.targets?.build?.executor)) {
      continue;
    }
    if (
      config?.targets?.serve?.executor &&
      !serveExecutors.includes(config?.targets?.serve?.executor)
    ) {
      continue;
    }
    const rootPath = config.root;
    const projectTsConfigPath = joinPathFragments(rootPath, 'tsconfig.json');
    const projectTsConfig = readJson(tree, projectTsConfigPath);
    if (projectTsConfig.compilerOptions?.jsx !== 'react-jsx') {
      continue;
    }

    relatedTsConfigs.forEach((tsConfig) => {
      const tsConfigPath = joinPathFragments(rootPath, tsConfig);
      if (tree.exists(tsConfigPath)) {
        updateJson(tree, tsConfigPath, (json) => {
          const compilerOptions = json.compilerOptions || {};
          compilerOptions.types = [
            ...new Set([...(compilerOptions.types || []), ...typesToAdd]),
          ];
          if (json.files?.length > 0) {
            json.files = json.files.filter(
              (file: string) => !['cssmodule.d.ts', 'image.d.ts'].includes(file)
            );
          }
          return { ...json, compilerOptions };
        });
      }
    });
  }
  await formatFiles(tree);
}
