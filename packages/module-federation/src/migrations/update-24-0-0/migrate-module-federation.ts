import { formatFiles, type Tree } from '@nx/devkit';
import {
  inventoryModuleFederation,
  removeUnusedModuleFederationPackage,
} from './inventory';
import { angularModuleFederationSteps } from './migrate-angular-module-federation';
import { reactModuleFederationSteps } from './migrate-react-module-federation';

// One migration for both frameworks: removing `@nx/module-federation` triggers a
// reinstall, and any migration from this package that runs after it fails to load.
export default async function migrateModuleFederation(tree: Tree) {
  const inventory = inventoryModuleFederation(tree);
  const steps = [
    reactModuleFederationSteps(inventory),
    angularModuleFederationSteps(inventory),
  ].filter((s) => s !== null);

  if (steps.length === 0) {
    if (removeUnusedModuleFederationPackage(tree, inventory)) {
      await formatFiles(tree);
    }
    return { skipAgentic: true };
  }

  return {
    nextSteps: steps.flatMap((s) => s.nextSteps),
    agentContext: steps.flatMap((s) => s.agentContext),
  };
}
