import { Tree, SchematicContext, chain } from '@angular-devkit/schematics';
import { readWorkspace, readJsonInTree } from '../../utils/ast-utils';
import { formatFiles } from '@nrwl/workspace';

export default function () {
  return chain([
    (host: Tree) => {
      const config = readWorkspace(host);

      const configsToUpdate = [];
      Object.keys(config.projects).forEach((name) => {
        const project = config.projects[name];
        if (
          project.projectType === 'library' &&
          project.architect &&
          project.architect.test &&
          project.architect.test.builder === '@nrwl/jest:jest' &&
          project.architect.test.options &&
          project.architect.test.options.setupFile ===
            `${project.sourceRoot}/test-setup.ts`
        ) {
          configsToUpdate.push(`${project.root}/tsconfig.lib.json`);
        }
      });

      configsToUpdate.forEach((config) => {
        const tsconfig = readJsonInTree(host, config);
        if (tsconfig.exclude && tsconfig.exclude[0] === 'src/test.ts') {
          tsconfig.exclude[0] = 'src/test-setup.ts';
          host.overwrite(config, JSON.stringify(tsconfig));
        }
      });
    },
    formatFiles(),
  ]);
}
