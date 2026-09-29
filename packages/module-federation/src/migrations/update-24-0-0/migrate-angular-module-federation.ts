import { formatFiles, type Tree } from '@nx/devkit';
import {
  describeUsage,
  inventoryModuleFederation,
  removeUnusedModuleFederationPackage,
} from './inventory';

export default async function migrateAngularModuleFederation(tree: Tree) {
  const inventory = inventoryModuleFederation(tree);
  const usages = inventory.angular;

  if (usages.length === 0) {
    if (removeUnusedModuleFederationPackage(tree, inventory)) {
      await formatFiles(tree);
    }
    return { skipAgentic: true };
  }

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
