import {
  addDependenciesToPackageJson,
  formatFiles,
  getDependencyVersionFromPackageJson,
  type Tree,
} from '@nx/devkit';
import { minVersion, validRange } from 'semver';

// The version the @nx/eslint generators install alongside ESLint v10.
const eslintJsVersion = '^10.0.0';

export default async function update(tree: Tree) {
  if (getDependencyVersionFromPackageJson(tree, '@nx/eslint-plugin') === null) {
    return { skipAgentic: true };
  }

  const existing = getDependencyVersionFromPackageJson(tree, '@eslint/js');
  if (existing !== null) {
    const range = validRange(existing);
    // A dist tag, git URL or workspace: protocol is the user's explicit pick.
    if (!range || minVersion(range).major >= 10) {
      return { skipAgentic: true };
    }
  }

  try {
    addDependenciesToPackageJson(tree, {}, { '@eslint/js': eslintJsVersion });
  } catch (e) {
    const message = `Could not set @eslint/js to ${eslintJsVersion} in package.json (${e instanceof Error ? e.message : String(e)}). @nx/eslint-plugin's flat/typescript and flat/javascript configs import it, and ESLint v10 no longer installs it.`;
    return { nextSteps: [message], agentContext: [message] };
  }

  await formatFiles(tree);

  return {
    nextSteps: [
      `${existing === null ? 'Added' : 'Updated'} @eslint/js ${eslintJsVersion}. Its recommended set enables no-unassigned-vars, no-useless-assignment and preserve-caught-error; where a config extends "eslint:recommended", expect those rules to report new errors when lint runs.`,
    ],
  };
}
