import {
  chain,
  externalSchematic,
  move,
  noop,
  Rule,
  schematic,
  Tree,
} from '@angular-devkit/schematics';
import {
  addLintFiles,
  formatFiles,
  Linter,
  updateJsonInTree,
} from '@nrwl/workspace';
import { addUnitTestRunner } from '../init/init';
import { addModule } from './lib/add-module';
import { normalizeOptions } from './lib/normalize-options';
import { updateLibPackageNpmScope } from './lib/update-lib-package-npm-scope';
import { updateProject } from './lib/update-project';
import { updateTsConfig } from './lib/update-tsconfig';
import { Schema } from './schema';

export default function (schema: Schema): Rule {
  return (host: Tree): Rule => {
    const options = normalizeOptions(host, schema);
    if (!options.routing && options.lazy) {
      throw new Error(`routing must be set`);
    }

    return chain([
      addLintFiles(options.projectRoot, Linter.TsLint, { onlyGlobal: true }),
      addUnitTestRunner(options),
      // TODO: Remove this after Angular 10.1.0
      updateJsonInTree('tsconfig.json', () => ({
        files: [],
        include: [],
        references: [],
      })),
      externalSchematic('@schematics/angular', 'library', {
        name: options.name,
        prefix: options.prefix,
        style: options.style,
        entryFile: 'index',
        skipPackageJson: !options.publishable,
        skipTsConfig: true,
      }),
      // TODO: Remove this after Angular 10.1.0
      (host) => {
        host.delete('tsconfig.json');
      },

      move(options.name, options.projectRoot),
      updateProject(options),
      updateTsConfig(options),
      options.unitTestRunner === 'jest'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            setupFile: 'angular',
            supportTsx: false,
            skipSerializers: false,
          })
        : noop(),
      options.unitTestRunner === 'karma'
        ? schematic('karma-project', {
            project: options.name,
          })
        : noop(),
      options.publishable ? updateLibPackageNpmScope(options) : noop(),
      addModule(options),
      formatFiles(options),
    ]);
  };
}
