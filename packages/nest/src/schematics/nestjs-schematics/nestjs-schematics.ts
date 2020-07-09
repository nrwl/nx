import {
  chain,
  externalSchematic,
  Rule,
  Tree,
} from '@angular-devkit/schematics';
import { getProjectConfig, toFileName } from '@nrwl/workspace';
import { NestSchematicsSchema } from './schema';

interface NormalizedSchema extends NestSchematicsSchema {
  name: string;
  sourceRoot: string;
}

function normalizeOptions(
  host: Tree,
  options: NestSchematicsSchema
): NormalizedSchema {
  if (options.directory && !options.path) {
    options.path = options.directory;
  }

  const { sourceRoot } = getProjectConfig(host, options.project);
  const name = toFileName(options.name);

  return {
    ...options,
    name,
    path: options.path,
    sourceRoot,
    spec: options.spec ? options.spec : options.unitTestRunner === 'jest',
  };
}

export default function (options: NestSchematicsSchema): Rule {
  return (host: Tree) => {
    const normalizedOptions = normalizeOptions(host, options);
    return chain([
      externalSchematic(
        '@nestjs/schematics',
        options.type as string,
        normalizedOptions
      ),
    ]);
  };
}
