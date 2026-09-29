import { formatFiles, type Tree } from '@nx/devkit';
import {
  describeUsage,
  inventoryModuleFederation,
  removeUnusedModuleFederationPackage,
} from './inventory';

export default async function migrateReactModuleFederation(tree: Tree) {
  const inventory = inventoryModuleFederation(tree);
  const usages = inventory.react;

  if (usages.length === 0) {
    if (removeUnusedModuleFederationPackage(tree, inventory)) {
      await formatFiles(tree);
    }
    return { skipAgentic: true };
  }

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
