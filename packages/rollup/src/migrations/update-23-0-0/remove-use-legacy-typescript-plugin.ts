import {
  formatFiles,
  getProjects,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import type {
  PropertyAssignment,
  ShorthandPropertyAssignment,
} from 'typescript';

const ROLLUP_CONFIG_NAMES = [
  'rollup.config.cjs',
  'rollup.config.mjs',
  'rollup.config.js',
  'rollup.config.ts',
];

const PROPERTY_NAME = 'useLegacyTypescriptPlugin';

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName] of projects) {
    const projectConfig = readProjectConfiguration(tree, projectName);

    let projectJsonChanged = false;

    if (projectConfig.targets) {
      for (const [, targetConfig] of Object.entries(projectConfig.targets)) {
        if (
          targetConfig.executor !== '@nx/rollup:rollup' &&
          targetConfig.executor !== '@nrwl/rollup:rollup'
        ) {
          continue;
        }

        if (
          targetConfig.options &&
          'useLegacyTypescriptPlugin' in targetConfig.options
        ) {
          delete targetConfig.options.useLegacyTypescriptPlugin;
          projectJsonChanged = true;
        }

        if (targetConfig.configurations) {
          for (const [, config] of Object.entries(
            targetConfig.configurations
          )) {
            if ('useLegacyTypescriptPlugin' in config) {
              delete config.useLegacyTypescriptPlugin;
              projectJsonChanged = true;
            }
          }
        }
      }
    }

    if (projectJsonChanged) {
      updateProjectConfiguration(tree, projectName, projectConfig);
    }

    visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
      const basename = filePath.split('/').pop();
      if (!ROLLUP_CONFIG_NAMES.includes(basename)) return;
      stripFromRollupConfig(tree, filePath);
    });
  }

  // Strip from nx.json targetDefaults (keyed by target name or executor name).
  const nxJson = readNxJson(tree);
  if (nxJson?.targetDefaults) {
    const ROLLUP_EXECUTORS = ['@nx/rollup:rollup', '@nrwl/rollup:rollup'];
    let nxJsonChanged = false;

    for (const [targetOrExecutor, targetDefault] of Object.entries(
      nxJson.targetDefaults
    )) {
      if (
        !ROLLUP_EXECUTORS.includes(targetOrExecutor) &&
        !ROLLUP_EXECUTORS.includes((targetDefault as any).executor)
      ) {
        continue;
      }

      if (
        targetDefault.options &&
        'useLegacyTypescriptPlugin' in targetDefault.options
      ) {
        delete targetDefault.options.useLegacyTypescriptPlugin;
        nxJsonChanged = true;
      }

      if (targetDefault.configurations) {
        for (const [, config] of Object.entries(targetDefault.configurations)) {
          if ('useLegacyTypescriptPlugin' in config) {
            delete (config as any).useLegacyTypescriptPlugin;
            nxJsonChanged = true;
          }
        }
      }
    }

    if (nxJsonChanged) {
      updateNxJson(tree, nxJson);
    }
  }

  await formatFiles(tree);
}

function stripFromRollupConfig(tree: Tree, filePath: string) {
  const original = tree.read(filePath, 'utf-8');
  if (!original?.includes(PROPERTY_NAME)) return;

  // Filter by the property NAME (not any descendant Identifier) so we don't
  // strip `{ alias: useLegacyTypescriptPlugin }` where the identifier appears as a value.
  // Also handle shorthand `{ useLegacyTypescriptPlugin }` — strip the entry, leave
  // the variable declaration behind (not our problem).
  const matches = (
    query(ast(original), 'PropertyAssignment, ShorthandPropertyAssignment') as (
      | PropertyAssignment
      | ShorthandPropertyAssignment
    )[]
  ).filter((p) => p.name && (p.name as any).text === PROPERTY_NAME);
  if (matches.length === 0) return;

  // Walk in reverse so each splice doesn't shift the offsets of remaining matches
  // (a file may legitimately contain multiple withNx({...}) calls, e.g. multi-format
  // configs returning more than one rollup options object).
  let updated = original;
  for (const propNode of matches.slice().reverse()) {
    let start = propNode.getStart();
    let end = propNode.getEnd();
    if (updated[end] === ',') end += 1;

    // If the property occupies its own line, drop the whole line including indentation.
    const lineStart = updated.lastIndexOf('\n', start - 1) + 1;
    const nextNewline = updated.indexOf('\n', end);
    const lineEnd = nextNewline === -1 ? updated.length : nextNewline + 1;
    if (
      /^\s*$/.test(updated.slice(lineStart, start)) &&
      /^\s*$/.test(updated.slice(end, lineEnd))
    ) {
      start = lineStart;
      end = lineEnd;
    }

    updated = updated.slice(0, start) + updated.slice(end);
  }

  tree.write(filePath, updated);
}
