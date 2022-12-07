import { output } from 'nx/src/utils/output';
import { getPackageManagerCommand } from 'nx/src/utils/package-manager';
import { lt } from 'semver';
import { determineMigration, migrateWorkspace } from './migration';
import { initNxCloud, promptForNxCloud } from './nx-cloud';
import { installDependencies } from './package-manager';

export interface Args {
  version?: string;
  verbose?: boolean;
  useNxCloud?: boolean;
}

export async function makeAngularCliFaster(args: Args) {
  const pmc = getPackageManagerCommand();

  output.log({ title: '🐳 Nx initialization' });

  output.log({ title: '🧐 Checking versions compatibility' });
  const migration = await determineMigration(args.version);

  const useNxCloud =
    args.useNxCloud !== null && args.useNxCloud !== undefined
      ? args.useNxCloud
      : await promptForNxCloud();

  output.log({ title: '📦 Installing dependencies' });
  await installDependencies(migration, useNxCloud, pmc);

  output.log({ title: '📝 Setting up workspace for faster computation' });
  migrateWorkspace(migration, pmc);

  if (useNxCloud) {
    output.log({ title: '🛠️ Setting up Nx Cloud' });
    initNxCloud(pmc);
  }

  output.success({
    title: '🎉 Angular CLI is faster now!',
    bodyLines: [
      `Execute 'npx ng build' twice to see the computation caching in action.`,
      'Learn more about computation caching, how it is shared with your teammates,',
      'and how it can speed up your CI by up to 10 times at https://nx.dev/getting-started/nx-and-angular',
    ],
  });

  if (migration.incompatibleWithAngularVersion) {
    output.warn({
      title: `The provided version of Nx (${args.version}) is not compatible with the currently installed version of Angular (${migration.angularVersion}).`,
      bodyLines: [
        'The workspace was still migrated, but you might find unexpected issues or behaviors using this version.',
        'To know which versions are compatible, please refer to https://nx.dev/angular-nx-version-matrix.',
      ],
    });
  }

  // if migrated to an older version than root project is supported, log a warning
  if (lt(migration.version, '15.3.0-beta.5')) {
    output.warn({
      title: 'You are not on the latest version of Nx yet.',
      bodyLines: [
        `You might find some differences compared to the documentation which reflects the latest state of Nx.`,
        'To update to the latest version of Nx, visit https://nx.dev/core-features/automate-updating-dependencies.',
      ],
    });
  }
}
