import {
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
  updateJson,
} from '@nx/devkit';

export default async function addTypings(tree: Tree) {
  const projects = getProjects(tree);
  const buildExecutors = [
    '@nx/webpack:webpack',
    '@nx/vite:build',
    '@nx/rspack:rspack',
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
    if (buildExecutors.includes(config?.targets?.build?.executor)) {
      const rootPath = config.root;
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
                (file: string) =>
                  !['cssmodule.d.ts', 'image.d.ts'].includes(file)
              );
            }
            return { ...json, compilerOptions };
          });
        }
      });
    }
  }
  await formatFiles(tree);
}
