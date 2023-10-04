import type { Tree } from '@nx/devkit';
import { formatFiles, getProjects, updateJson } from '@nx/devkit';
import { Builders } from '@schematics/angular/utility/workspace-models';

function updateTarget(tree: Tree, tsconfigPath: string) {
  updateJson(tree, tsconfigPath, (json) => ({
    ...json,
    compilerOptions: {
      ...(json.compilerOptions ?? {}),
      target: 'ES2022',
      useDefineForClassFields: false,
    },
  }));
}

export default async function updateTypescriptTarget(tree: Tree) {
  const projects = getProjects(tree);
  for (const [, project] of projects) {
    if (!project.targets) continue;

    for (const [, target] of Object.entries(project.targets)) {
      // Update all other known CLI builders that use a tsconfig
      const tsConfigs = [
        target.options || {},
        ...Object.values(target.configurations || {}),
      ]
        .filter((opt) => typeof opt?.tsConfig === 'string')
        .map((opt) => (opt as { tsConfig: string }).tsConfig);

      const uniqueTsConfigs = [...new Set(tsConfigs)];

      if (uniqueTsConfigs.length < 1) {
        continue;
      }

      const supportedExecutors = new Set([
        Builders.Server,
        Builders.Karma,
        Builders.Browser,
        Builders.NgPackagr,
        '@nrwl/angular:webpack-browser',
        '@nrwl/angular:ng-packagr-lite',
        '@nrwl/angular:package',
        '@nrwl/angular:delegate-build',
        '@nrwl/jest:jest',
      ]);

      if (supportedExecutors.has(target.executor)) {
        for (const tsConfig of uniqueTsConfigs) {
          updateTarget(tree, tsConfig);
        }
      }
    }
  }

  await formatFiles(tree);
}
