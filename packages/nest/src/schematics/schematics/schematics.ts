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
  delete options.flat;
  // We only support TypeScript for Nest atm.
  delete options.language;

  if (!options.directory && options.path) {
    options.directory = options.path;
  }

  const { sourceRoot } = getProjectConfig(host, options.project);

  const name = toFileName(options.name);

  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');

  return {
    ...options,
    name: projectName,
    path: projectDirectory,
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
