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

function run(options: NestSchematicsSchema): Rule {
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

export function module(options: NestSchematicsSchema) {
  return run({ ...options, type: 'module' });
}

export function classSchematic(options: NestSchematicsSchema) {
  return run({ ...options, type: 'class' });
}

export function controller(options: NestSchematicsSchema) {
  return run({ ...options, type: 'controller' });
}

export function decorator(options: NestSchematicsSchema) {
  return run({ ...options, type: 'decorator' });
}

export function filter(options: NestSchematicsSchema) {
  return run({ ...options, type: 'filter' });
}

export function gateway(options: NestSchematicsSchema) {
  return run({ ...options, type: 'gateway' });
}

export function guard(options: NestSchematicsSchema) {
  return run({ ...options, type: 'guard' });
}

export function interceptor(options: NestSchematicsSchema) {
  return run({ ...options, type: 'interceptor' });
}

export function interfaceSchematic(options: NestSchematicsSchema) {
  return run({ ...options, type: 'interface' });
}

export function middleware(options: NestSchematicsSchema) {
  return run({ ...options, type: 'middleware' });
}

export function pipe(options: NestSchematicsSchema) {
  return run({ ...options, type: 'pipe' });
}

export function provider(options: NestSchematicsSchema) {
  return run({ ...options, type: 'provider' });
}

export function resolver(options: NestSchematicsSchema) {
  return run({ ...options, type: 'resolver' });
}

export function service(options: NestSchematicsSchema) {
  return run({ ...options, type: 'service' });
}
