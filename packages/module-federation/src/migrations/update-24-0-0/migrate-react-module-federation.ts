import { describeUsage, type ModuleFederationInventory } from './inventory';

export function reactModuleFederationSteps(
  inventory: ModuleFederationInventory
) {
  const usages = inventory.react;
  if (usages.length === 0) return null;

  return {
    nextSteps: [
      `Migrate ${usages.length} React project(s) off Nx Module Federation. See https://nx.dev/docs/kb/migrate-from-nx-module-federation`,
    ],
    agentContext: [
      'React projects that use Nx Module Federation, with the files that reference it:',
      ...usages.map(describeUsage),
    ],
  };
}
