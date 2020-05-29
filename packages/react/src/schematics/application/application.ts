import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { addLintFiles, formatFiles } from '@nrwl/workspace';
import { extraEslintDependencies, reactEslintJson } from '../../utils/lint';
import init from '../init/init';
import { Schema } from './schema';
import { createApplicationFiles } from './lib/create-application-files';
import { updateJestConfig } from './lib/update-jest-config';
import { normalizeOptions } from './lib/normalize-options';
import { addProject } from './lib/add-project';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { addRouting } from './lib/add-routing';
import { setDefaults } from './lib/set-defaults';
import { updateNxJson } from './lib/update-nx-json';
import { addStyledModuleDependencies } from '../../rules/add-styled-dependencies';

export default function (schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);
    return chain([
      init({
        ...options,
        skipFormat: true,
      }),
      addLintFiles(options.appProjectRoot, options.linter, {
        localConfig: reactEslintJson,
        extraPackageDeps: extraEslintDependencies,
      }),
      createApplicationFiles(options),
      updateNxJson(options),
      addProject(options),
      addCypress(options),
      addJest(options),
      updateJestConfig(options),
      addStyledModuleDependencies(options.styledModule),
      addRouting(options, context),
      setDefaults(options),
      formatFiles(options),
    ]);
  };
}
