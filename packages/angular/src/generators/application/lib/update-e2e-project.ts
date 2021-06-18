import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { getWorkspacePath, offsetFromRoot, updateJson } from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';

export function updateE2eProject(host: Tree, options: NormalizedSchema) {
  const spec = `${options.e2eProjectRoot}/src/app.e2e-spec.ts`;
  const content = host.read(spec, 'utf-8');
  host.write(
    spec,
    content.replace(
      `${options.name} app is running!`,
      `Welcome to ${options.name}!`
    )
  );

  const page = `${options.e2eProjectRoot}/src/app.po.ts`;
  const pageContent = host.read(page, 'utf-8');
  host.write(page, pageContent.replace(`.content span`, `header h1`));

  // update workspace.json / angular.json
  updateJson(host, getWorkspacePath(host), (json) => {
    const project = {
      root: options.e2eProjectRoot,
      projectType: 'application',
      targets: {
        e2e: json.projects[options.name].architect.e2e,
        lint:
          options.linter === Linter.None
            ? undefined
            : {
                builder: '@nrwl/linter:eslint',
                options: {
                  lintFilePatterns: [`${options.e2eProjectRoot}/**/*.ts`],
                },
              },
      },
    };

    project.targets.e2e.options.protractorConfig = `${options.e2eProjectRoot}/protractor.conf.js`;

    json.projects[options.e2eProjectName] = project;
    delete json.projects[options.name].architect.e2e;
    return json;
  });

  // update tsconfig e2e
  if (!host.exists(`${options.e2eProjectRoot}/tsconfig.e2e.json`)) {
    host.write(`${options.e2eProjectRoot}/tsconfig.e2e.json`, '{}');
  }

  updateJson(host, `${options.e2eProjectRoot}/tsconfig.e2e.json`, (json) => {
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
  updateJson(host, `${options.e2eProjectRoot}/tsconfig.json`, (json) => {
    return {
      ...json,
      extends: `${offsetFromRoot(options.e2eProjectRoot)}tsconfig.base.json`,
    };
  });
}
