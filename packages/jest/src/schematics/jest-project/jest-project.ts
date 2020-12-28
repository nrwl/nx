import { chain, Rule } from '@angular-devkit/schematics';
import init from '../init/init';
import { checkForTestTarget } from './lib/check-for-test-target';
import { generateFiles } from './lib/generate-files';
import { updateTsConfig } from './lib/update-tsconfig';
import { updateWorkspace } from './lib/update-workspace';
import { updateJestConfig } from './lib/update-jestconfig';
import { JestProjectSchema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

const schemaDefaults = {
  setupFile: 'none',
  babelJest: false,
  supportTsx: false,
  skipSetupFile: false,
  skipSerializers: false,
} as const;

function normalizeOptions(options: JestProjectSchema) {
  if (options.testEnvironment === 'jsdom') {
    options.testEnvironment = '';
  }

  // if we support TSX or babelJest we don't support angular(html templates)
  if (options.supportTsx || options.babelJest) {
    options.skipSerializers = true;
  }

  if (!options.skipSetupFile) {
    return options;
  }

  // setupFile is always 'none'
  options.setupFile = schemaDefaults.setupFile;

  return {
    ...schemaDefaults,
    ...options,
  };
}

export default function (schema: JestProjectSchema): Rule {
  const options = normalizeOptions(schema);
  return chain([
    init(options),
    checkForTestTarget(options),
    generateFiles(options),
    updateTsConfig(options),
    updateWorkspace(options),
    updateJestConfig(options),
  ]);
}

export const jestProjectGenerator = wrapAngularDevkitSchematic(
  '@nrwl/jest',
  'jest-project'
);
