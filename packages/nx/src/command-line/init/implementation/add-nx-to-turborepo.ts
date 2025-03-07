import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { getPackageManagerCommand } from '../../../utils/package-manager';
import { InitArgs } from '../init-v1';
import {
  addDepsToPackageJson,
  createNxJsonFromTurboJson,
  runInstall,
  updateGitIgnore,
} from './utils';

type Options = Pick<InitArgs, 'nxCloud' | 'interactive'>;

export async function addNxToTurborepo(_options: Options) {
  const repoRoot = process.cwd();

  output.log({
    title: 'Initializing Nx based on your old Turborepo configuration',
  });

  output.log({
    title: '💡 Did you know?',
    bodyLines: [
      '- Turborepo requires you to maintain all your common scripts like "build", "lint", "test" in all your packages, as well as their applicable cache inputs and outputs.',
      `- Nx is extensible and has plugins for the tools you use to infer all of this for you purely based on that tool's configuration file within your packages.`,
      '',
      '  - E.g. the `@nx/vite` plugin will infer the "build" script based on the existence of a vite.config.js file.',
      '  - Therefore with zero package level config, `nx build my-app` knows to run the `vite build` CLI directly, with all Nx cache inputs and outputs automatically inferred.',
      '',
      `NOTE: None of your existing package.json scripts will be modified as part of this initialization process, you can already use them as-is with Nx, but you can learn more about the benefits of Nx's inferred tasks at https://nx.dev/concepts/inferred-tasks`,
    ],
  });

  let nxJson = createNxJsonFromTurboJson(readJsonFile('turbo.json'));
  const nxJsonPath = join(repoRoot, 'nx.json');

  // Turborepo workspaces usually have prettier installed, so try and match the formatting before writing the file
  try {
    const prettier = await import('prettier');
    const config = await prettier.resolveConfig(repoRoot);
    writeFileSync(
      nxJsonPath,
      // @ts-ignore - Always await prettier.format, in modern versions it's async
      await prettier.format(JSON.stringify(nxJson, null, 2), {
        ...(config ?? {}),
        parser: 'json',
      })
    );
  } catch (err) {
    // Apply fallback JSON write
    writeJsonFile(nxJsonPath, nxJson);
  }

  const pmc = getPackageManagerCommand();

  updateGitIgnore(repoRoot);
  addDepsToPackageJson(repoRoot);

  output.log({ title: '📦 Installing dependencies' });

  runInstall(repoRoot, pmc);
}
