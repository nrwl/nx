import { describeUsage, type ModuleFederationInventory } from './inventory';

export function angularModuleFederationSteps(
  inventory: ModuleFederationInventory
) {
  const usages = inventory.angular;
  if (usages.length === 0) return null;

  return {
    nextSteps: [
      `Migrate ${usages.length} Angular project(s) off Nx Module Federation. See https://nx.dev/docs/kb/migrate-angular-module-federation`,
    ],
    agentContext: [
      'Angular projects that use Nx Module Federation, with the files that reference it:',
      ...usages.map(describeUsage),
    ],
  };
}
