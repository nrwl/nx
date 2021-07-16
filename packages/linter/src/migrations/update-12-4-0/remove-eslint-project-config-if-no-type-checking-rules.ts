import { formatFiles, getProjects, readJson, updateJson } from '@nrwl/devkit';
import type { Tree } from '@nrwl/devkit';
import { join } from 'path';
import {
  hasRulesRequiringTypeChecking,
  removeParserOptionsProjectIfNotRequired,
} from '../../utils/rules-requiring-type-checking';

function updateProjectESLintConfigs(host: Tree) {
  const projects = getProjects(host);
  projects.forEach((p) => {
    const eslintConfigPath = join(p.root, '.eslintrc.json');
    if (!host.exists(eslintConfigPath)) {
      return;
    }
    return updateJson(
      host,
      eslintConfigPath,
      removeParserOptionsProjectIfNotRequired
    );
  });
}

export default async function removeESLintProjectConfigIfNoTypeCheckingRules(
  host: Tree
) {
  if (!host.exists('.eslintrc.json')) {
    return;
  }

  // If the root level config uses at least one rule requiring type-checking, do not migrate any project configs
  const rootESLintConfig = readJson(host, '.eslintrc.json');
  if (hasRulesRequiringTypeChecking(rootESLintConfig)) {
    return;
  }
  updateProjectESLintConfigs(host);
  await formatFiles(host);
}
