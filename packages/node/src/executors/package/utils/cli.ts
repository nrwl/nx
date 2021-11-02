import { ExecutorContext } from '@nrwl/devkit';

import {
  readJsonFile,
  writeJsonFile,
  writeToFile,
} from '@nrwl/workspace/src/utilities/fileutils';
import { chmodSync } from 'fs-extra';
import { NormalizedBuilderOptions } from './models';

export default function addCliWrapper(
  options: NormalizedBuilderOptions,
  context: ExecutorContext
) {
  const packageJson = readJsonFile(`${options.outputPath}/package.json`);

  const binFile = `${options.outputPath}/index.bin.js`;
  writeToFile(
    binFile,
    `#!/usr/bin/env node
'use strict';

require('${packageJson.main}');
`
  );

  chmodSync(binFile, '755'); // Make the command-line file executable

  packageJson.bin = {
    [context.projectName]: './index.bin.js',
  };
  writeJsonFile(`${options.outputPath}/package.json`, packageJson);
}
