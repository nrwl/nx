import { h3, lines } from 'markdown-factory';
import { MigrationContext, MigrationStep } from './types';

/**
 * Migration: Create Directory.Packages.props for NuGet packages
 */
export function migrateNugetPackages(context: MigrationContext): MigrationStep {
  const { rcConfig } = context;
  const completed: string[] = [];
  const manualSteps: string[] = [];

  const packageCount = rcConfig.nugetPackages
    ? Object.keys(rcConfig.nugetPackages).length
    : 0;

  if (packageCount === 0) {
    return { completed, manualSteps };
  }

  manualSteps.push(
    h3(
      'Central Package Management via Directory.Packages.props',
      'The plugin configuration for @nx-dotnet/core in this repository shown indications of using `nugetPackages` to enforce single version policy. In the new @nx/dotnet plugin, this functionality is not supported directly. Instead, we recommend setting up [Central Package Management](https://learn.microsoft.com/en-us/nuget/consume-packages/central-package-management) by creating a `Directory.Packages.props` file at the root of your repository.',
      'Microsoft has provided a [tool to help migrate existing projects](https://devblogs.microsoft.com/dotnet/dotnet-upgrade-assistant-cpm-upgrade/).`'
    )
  );

  return { completed, manualSteps };
}
