import { chain, Rule } from '@angular-devkit/schematics';
import init from '../init/init';
import { checkForTestTarget } from './lib/check-for-test-target';
import { generateFiles } from './lib/generate-files';
import { updateTsConfig } from './lib/update-tsconfig';
import { updateWorkspace } from './lib/update-workspace';
import { JestProjectSchema } from './schema';

function normalizeOptions(options: JestProjectSchema): JestProjectSchema {
  if (options.testEnvironment === 'jsdom') {
    options.testEnvironment = '';
  }

  if (!options.skipSetupFile) {
    return options;
  }

  return {
    ...options,
    setupFile: 'none',
  };
}

export default function (options: JestProjectSchema): Rule {
  options = normalizeOptions(options);
  return chain([
    init(options),
    checkForTestTarget(options),
    generateFiles(options),
    updateTsConfig(options),
    updateWorkspace(options),
  ]);
}
