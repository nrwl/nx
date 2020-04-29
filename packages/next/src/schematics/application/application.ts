import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { extraEslintDependencies, reactEslintJson } from '@nrwl/react';
import { addLintFiles, formatFiles } from '@nrwl/workspace';
import init from '../init/init';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { createNextServerFiles } from './lib/create-next-server-files';
import { normalizeOptions } from './lib/normalize-options';
import { setDefaults } from './lib/set-defaults';
import { updateJestConfig } from './lib/update-jest-config';
import { updateNxJson } from './lib/update-nx-json';
import { Schema } from './schema';
import { addStyleDependencies } from '../../utils/styles';

export default function (schema: Schema): Rule {
  return (host: Tree, _context: SchematicContext) => {
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
      createNextServerFiles(options),
      updateNxJson(options),
      addProject(options),
      addCypress(options),
      addJest(options),
      updateJestConfig(options),
      addStyleDependencies(options.style),
      setDefaults(options),
      formatFiles(options),
    ]);
  };
}
