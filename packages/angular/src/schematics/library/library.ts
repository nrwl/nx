import {
  chain,
  externalSchematic,
  move,
  noop,
  Rule,
  schematic,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';
import { formatFiles, Linter, updateJsonInTree } from '@nrwl/workspace';
import init, { addUnitTestRunner } from '../init/init';
import { addModule } from './lib/add-module';
import { normalizeOptions } from './lib/normalize-options';
import { updateLibPackageNpmScope } from './lib/update-lib-package-npm-scope';
import { updateProject } from './lib/update-project';
import { updateTsConfig } from './lib/update-tsconfig';
import { Schema } from './schema';
import { enableStrictTypeChecking } from './lib/enable-strict-type-checking';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { NormalizedSchema } from './lib/normalized-schema';

export default function (schema: Schema): Rule {
  return (host: Tree): Rule => {
    const options = normalizeOptions(host, schema);
    if (!options.routing && options.lazy) {
      throw new Error(`routing must be set`);
    }

    if (options.enableIvy === true && !options.buildable) {
      throw new Error('enableIvy must only be used with buildable.');
    }

    if (options.publishable === true && !schema.importPath) {
      throw new SchematicsException(
        `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
      );
    }

    return chain([
      init({
        ...options,
        skipFormat: true,
      }),
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
        skipPackageJson: !(options.publishable || options.buildable),
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
      options.publishable || options.buildable
        ? updateLibPackageNpmScope(options)
        : noop(),
      addModule(options),
      options.strict ? enableStrictTypeChecking(options) : noop(),
      addLinting(options),
      formatFiles(options),
    ]);
  };
}

const addLinting = (options: NormalizedSchema) => () => {
  return chain([
    schematic('add-linting', {
      linter: options.linter,
      projectType: 'library',
      projectName: options.name,
      projectRoot: options.projectRoot,
      prefix: options.prefix,
    }),
    /**
     * I cannot explain why this extra rule is needed, the add-linting
     * schematic applies the exact same host.delete() call but the main
     * chain of this library schematic still preserves it...
     */
    (host) => {
      if (
        options.linter === Linter.EsLint &&
        host.exists(`${options.projectRoot}/tslint.json`)
      ) {
        host.delete(`${options.projectRoot}/tslint.json`);
      }
    },
  ]);
};

export const libraryGenerator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'library'
);
