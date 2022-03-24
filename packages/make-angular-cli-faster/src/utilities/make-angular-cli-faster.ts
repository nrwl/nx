import { output } from '@nrwl/devkit';
import { determineMigration, migrateWorkspace } from './migration';
import { initNxCloud, promptForNxCloud } from './nx-cloud';
import { installDependencies } from './package-manager';

export interface Args {
  version?: string;
  verbose?: boolean;
}

export async function makeAngularCliFaster(args: Args) {
  output.log({ title: '🐳 Nx initialization' });

  output.log({ title: '🧐 Checking versions compatibility' });
  const migration = await determineMigration(args.version);

  const useNxCloud = await promptForNxCloud();

  output.log({ title: '📦 Installing dependencies' });
  installDependencies(migration, useNxCloud);

  output.log({ title: '📝 Setting up workspace for faster computation' });
  migrateWorkspace(migration);

  if (useNxCloud) {
    output.log({ title: '🛠️ Setting up Nx Cloud' });
    initNxCloud();
  }

  output.success({
    title: '🎉 Angular CLI is faster now!',
    bodyLines: [
      `Execute 'npx ng build' twice to see the computation caching in action.`,
      'Learn more about computation caching, how it is shared with your teammates,' +
        ' and how it can speed up your CI by up to 10 times at https://nx.dev/getting-started/nx-and-angular',
    ],
  });
}
