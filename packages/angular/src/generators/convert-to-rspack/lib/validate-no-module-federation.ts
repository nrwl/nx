import type { ProjectConfiguration, Tree } from '@nx/devkit';

const MODULE_FEDERATION_EXECUTORS = [
  '@nx/angular:module-federation-dev-server',
  '@nx/angular:module-federation-dev-ssr',
];

export function validateNoModuleFederation(
  tree: Tree,
  project: ProjectConfiguration
) {
  if (usesModuleFederation(tree, project)) {
    throw new Error(
      `The project ${project.name} is using Module Federation. At the moment, we don't support migrating projects that use Module Federation. See https://nx.dev/docs/kb/migrate-angular-module-federation.`
    );
  }
}

function usesModuleFederation(tree: Tree, project: ProjectConfiguration) {
  for (const target of Object.values(project.targets ?? {})) {
    if (MODULE_FEDERATION_EXECUTORS.includes(target.executor)) {
      return true;
    }
    const allOptions = [
      target.options,
      ...Object.values(target.configurations ?? {}),
    ];
    for (const options of allOptions) {
      const configPath = options?.customWebpackConfig?.path;
      if (
        configPath &&
        tree.exists(configPath) &&
        tree.read(configPath, 'utf-8').includes('@nx/module-federation')
      ) {
        return true;
      }
    }
  }
  return false;
}
