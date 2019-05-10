import * as fs from 'fs-extra';
import * as path from 'path';
import { getPackageConfigurations } from './get-package-configurations';
import { getNxPackageDependencies } from './utils';

getPackageConfigurations()
  .filter(item => item.hasBuilders || item.hasSchematics)
  .map(config => {
    const dependencies = getNxPackageDependencies(
      path.join(config.root, 'package.json')
    );
    if (dependencies) {
      fs.outputJsonSync(
        path.join(config.output, 'package-dependencies.json'),
        dependencies
      );
      console.log(`Dependencies file created at: ${config.output}`);
    }
  });
