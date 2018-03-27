import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import { updateJsonFile } from '../src/utils/fileutils';
import {
  ExistingPrettierConfig,
  resolveUserExistingPrettierConfig
} from '../src/utils/common';

export default {
  description: 'Create or update prettier configuration',
  run: async () => {
    const resolvedExisting = await resolveUserExistingPrettierConfig();
    const existingUserConfig = {
      ...(resolvedExisting ? resolvedExisting.config : null)
    };
    const PREVIOUSLY_HARDCODED_NRWL_CONFIG = {
      singleQuote: true,
      printWidth: 120
    };
    const finalConfig = {
      ...existingUserConfig,
      ...PREVIOUSLY_HARDCODED_NRWL_CONFIG
    };
    // cleanup old configuration source, if applicable
    if (resolvedExisting) {
      cleanUpExistingConfig(resolvedExisting);
    }
    // create new configuration file
    writeFileSync('.prettierrc', JSON.stringify(finalConfig, null, 2));
  }
};

function cleanUpExistingConfig(resolvedExisting: ExistingPrettierConfig): void {
  switch (resolvedExisting.sourceFilepath) {
    case join(process.cwd(), 'package.json'):
      return updateJsonFile('package.json', json => {
        delete json.prettier;
      });
    default:
      return unlinkSync(resolvedExisting.sourceFilepath);
  }
}
