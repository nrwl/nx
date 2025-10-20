import { codeBlock, h3, orderedList, unorderedList } from 'markdown-factory';
import { MigrationContext, MigrationStep } from './types';
import {
  getProjects,
  ProjectConfiguration,
  visitNotIgnoredFiles,
  workspaceRoot,
} from '@nx/devkit';
import { basename, resolve } from 'path';

/**
 * Migration: Lint targets are not inferred by @nx/dotnet. Existing users of @nx-dotnet/core may need to manually configure lint targets.
 */
export function migrateSwaggerTarget(context: MigrationContext): MigrationStep {
  const { tree } = context;
  const manualSteps: string[] = [];
  const completed: string[] = [];

  let foundSwaggerTargets = false;
  let foundCodegenTargets = false;

  const projects = getProjects(tree);
  outer: for (const [project, config] of projects) {
    for (const [target, targetConfig] of Object.entries(config.targets || {})) {
      if (
        targetConfig.executor === '@nx-dotnet/core:update-swagger' &&
        !foundSwaggerTargets
      ) {
        manualSteps.push(
          h3(
            '`@nx-dotnet/core:update-swagger`',
            'One or more projects in this repository use the `@nx-dotnet/core:update-swagger` executor. The @nx/dotnet plugin does not provide a direct equivalent. To avoid breaking the existing projects configurations in this repository, no automatic migration have been performed. Please consider the following options to migrate this functionality:',
            unorderedList(
              'A custom target definition that wraps the desired Swagger update functionality'
            )
          ),
          'An example target definition would look like:',
          codeBlock(
            'json',
            JSON.stringify(
              {
                targets: {
                  [target]: {
                    command: `dotnet swagger tofile --output ./libs/api/swagger.json {projectRoot}/bin/Debug/net8.0/YourApi.dll v1`,
                    inputs: ['production', '^production'],
                    outputs: ['{workspaceRoot}/libs/api/swagger.json'],
                    cache: true,
                  },
                },
              },
              null,
              2
            )
          )
        );
        continue outer;
      }
      if (
        targetConfig.executor === '@nx-dotnet/core:openapi-codegen' &&
        !foundCodegenTargets
      ) {
        manualSteps.push(
          h3(
            '`@nx-dotnet/core:openapi-codegen`',
            'One or more projects in this repository use the `@nx-dotnet/core:openapi-codegen` executor. The @nx/dotnet plugin does not provide a direct equivalent. To avoid breaking the existing projects configurations in this repository, no automatic migration has been performed. To migrate, consider the following:',
            orderedList(
              'Install https://github.com/OpenAPITools/openapi-generator-cli',
              'Migrate targets to use a custom command that invokes the OpenAPI Generator CLI with the desired parameters'
            )
          ),
          'An example target definition would look like:',
          codeBlock(
            'json',
            JSON.stringify(
              {
                targets: {
                  [target]: {
                    command: `openapi-generator-cli generate -i {workspaceRoot}/libs/api/openapi.json -g typescript -o {projectRoot}/src/generated`,
                    inputs: ['{workspaceRoot}/libs/api/openapi.json'],
                    outputs: ['{workspaceRoot}/libs/client/**'],
                    cache: true,
                  },
                },
              },
              null,
              2
            )
          )
        );
        if (foundCodegenTargets && foundSwaggerTargets) {
          break outer;
        }
      }
    }
  }
  return { completed, manualSteps };
}
