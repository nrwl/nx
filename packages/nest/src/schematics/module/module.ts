import {
  chain,
  externalSchematic,
  Rule,
  Tree,
} from '@angular-devkit/schematics';
import { getProjectConfig } from '@nrwl/workspace';
import * as path from 'path';
import { Schema } from './schema';

export default function (options: Schema): Rule {
  return (host: Tree) => {
    const config = getProjectConfig(host, options.project);
    return chain([
      externalSchematic('@nestjs/schematics', 'module', {
        ...options,
        sourceRoot: path.join(
          config.sourceRoot,
          config.projectType === 'library' ? 'lib' : 'app'
        ),
      }),
    ]);
  };
}
