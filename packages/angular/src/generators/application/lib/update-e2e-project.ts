import type { NxJsonProjectConfiguration, ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  addProjectConfiguration,
  offsetFromRoot,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

export function updateE2eProject(tree: Tree, options: NormalizedSchema) {
  const spec = `${options.e2eProjectRoot}/src/app.e2e-spec.ts`;
  const content = tree.read(spec, 'utf-8');
  tree.write(
    spec,
    content.replace(
      `${options.name} app is running!`,
      `Welcome to ${options.name}!`
    )
  );

  const page = `${options.e2eProjectRoot}/src/app.po.ts`;
  const pageContent = tree.read(page, 'utf-8');
  tree.write(page, pageContent.replace(`.content span`, `header h1`));

  const proj = readProjectConfiguration(tree, options.name);
  const project: ProjectConfiguration & NxJsonProjectConfiguration = {
    root: options.e2eProjectRoot,
    projectType: 'application',
    targets: {
      e2e: proj.targets.e2e,
    },
    implicitDependencies: [options.name],
    tags: []
  };
  project.targets.e2e.options.protractorConfig = `${options.e2eProjectRoot}/protractor.conf.js`;
  // update workspace.json / angular.json
  addProjectConfiguration(tree, options.e2eProjectName, project);

  delete proj.targets.e2e;
  updateProjectConfiguration(tree, options.name, proj);

  // update tsconfig e2e
  if (!tree.exists(`${options.e2eProjectRoot}/tsconfig.e2e.json`)) {
    tree.write(`${options.e2eProjectRoot}/tsconfig.e2e.json`, '{}');
  }

  updateJson(tree, `${options.e2eProjectRoot}/tsconfig.e2e.json`, (json) => {
    return {
      ...json,
      extends: `./tsconfig.json`,
      compilerOptions: {
        ...json.compilerOptions,
        outDir: `${offsetFromRoot(options.e2eProjectRoot)}dist/out-tsc`,
      },
    };
  });

  // update tsconfig
  updateJson(tree, `${options.e2eProjectRoot}/tsconfig.json`, (json) => {
    return {
      ...json,
      extends: `${offsetFromRoot(options.e2eProjectRoot)}tsconfig.base.json`,
    };
  });
}
