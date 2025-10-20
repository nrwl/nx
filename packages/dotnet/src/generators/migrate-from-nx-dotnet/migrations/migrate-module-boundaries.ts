import { logger, ensurePackage } from '@nx/devkit';
import { code } from 'markdown-factory';
import { MigrationContext, MigrationStep } from './types';
import { readFileSync } from 'node:fs';

/**
 * Migration: Handle module boundaries (manual migration required)
 */
export function migrateModuleBoundaries(
  context: MigrationContext
): MigrationStep {
  const { rcConfig, tree } = context;
  const completed: string[] = [];
  const manualSteps: string[] = [];

  const DirectoryBuildTargets = tree.read('Directory.Build.targets');
  if (DirectoryBuildTargets) {
    try {
      // @nx-dotnet/core used xmldoc to manipulate Directory.Build.targets...
      // it should still be available as a dependency during migration.
      const xmldoc = ensurePackage<typeof import('xmldoc')>('xmldoc', '^1.1.2');

      // @nx-dotnet/core added a target in Directory.Build.targets to enforce module boundaries.
      // The declaration looked like this:
      //
      //   <Target Name="CheckNxModuleBoundaries" BeforeTargets="Build">
      //     <Exec Command="node $(NodeModulesRelativePath)/node_modules/@nx-dotnet/core/src/tasks/check-module-boundaries.js --project-root &quot;$(MSBuildProjectDirRelativePath)&quot;"/>
      //   </Target>

      const xmlDoc = new xmldoc.XmlDocument(DirectoryBuildTargets.toString());
      const targets = xmlDoc.childrenNamed('Target');
      const moduleBoundariesTarget = targets.find(
        (t) => t.attr.Name === 'CheckNxModuleBoundaries'
      );
      if (moduleBoundariesTarget) {
        const commandElem = moduleBoundariesTarget.childNamed('Exec');
        if (commandElem) {
          const commandAttr = commandElem.attr.Command;
          const parts = commandAttr.split(' ');
          const [runtime, scriptPath, ...args] = parts;
          const nxDotnetScriptPath = require.resolve(
            '@nx-dotnet/core/src/tasks/check-module-boundaries.js'
          );
          const updatedScriptPath = 'scripts/legacy-check-module-boundaries.js';
          tree.write(
            updatedScriptPath,
            `
          // This script is for legacy support during migration from @nx-dotnet/core to @nx/dotnet.
          // As the original script is no longer maintained, and will not be present when only @nx/dotnet is installed,
          // it is inlined here. Original source: https://github.com/nx-dotnet/nx-dotnet/blob/master/packages/core/src/tasks/check-module-boundaries.ts
          //
          // To remove this and continue using module boundaries, look into Nx Conformance rules.
          ${readFileSync(nxDotnetScriptPath, 'utf-8')}
        `
          );
          commandElem.attr.Command = [runtime, updatedScriptPath, ...args].join(
            ' '
          );
          // Write back the modified XML
          tree.write(
            'Directory.Build.targets',
            xmlDoc.toString({ compressed: false })
          );
          completed.push(
            'Updated Directory.Build.targets to use inlined module boundaries check script.'
          );
          return { completed, manualSteps };
        }
      }
    } catch {
      manualSteps.push(
        'There was an error when attempting to migrate module boundaries. Please ensure that any module boundaries defined in Directory.Build.targets are still valid after migration, and consider migrating them to Nx Conformance rules.'
      );
    }
  }

  return { completed, manualSteps };
}
