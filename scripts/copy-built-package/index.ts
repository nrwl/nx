import { readJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import { readJsonSync } from 'fs-extra';
import { dirname, join } from 'path';
import { globSync } from 'tinyglobby';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { copyBuiltPackage, WORKSPACE_ROOT } from './copy';
import { DirectoryPicker } from './directory-picker';
import { asciiBlock, centerStringInWidth, termSize } from './ui';

const packages: { npmName: string; nxName: string; pkgRoot: string }[] =
  globSync(`packages/*/package.json`).map((p) => {
    const pkgJson = readJsonSync(p);
    const pkgRoot = dirname(p);
    const projectJson = (() => {
      try {
        return readJsonFile(join(WORKSPACE_ROOT, pkgRoot, 'project.json'));
      } catch {}
    })();
    return {
      npmName: pkgJson.name,
      nxName: projectJson?.name ?? pkgJson.nx?.name ?? pkgJson.name,
      pkgRoot,
    };
  });

/**
 * Match a package name against the user's input, on both the full name and
 * the "short name" — the part after the scope (e.g. "react" for "@nx/react").
 */
function packageMatches(input: string, name: string): boolean {
  const lower = input.toLowerCase();
  const fullLower = name.toLowerCase();
  const shortName = fullLower.includes('/')
    ? fullLower.split('/').pop()!
    : fullLower;
  return shortName.includes(lower) || fullLower.includes(lower);
}

async function promptPackages(): Promise<typeof packages> {
  const { autocompleteMultiselect, isCancel } = await import('@clack/prompts');
  // Reserve lines for the prompt header, input, footer hint, and breathing room
  const visibleChoices = Math.max(5, termSize().rows - 4);
  const selected = await autocompleteMultiselect<string>({
    message: 'Select packages to copy',
    options: packages.map((p) => ({ value: p.nxName })),
    maxItems: visibleChoices,
    filter: (search, option) => packageMatches(search, option.value),
  });
  if (isCancel(selected) || selected.length === 0) {
    console.error('No packages selected.');
    process.exit(1);
  }
  return selected.map((nxName) => packages.find((p) => p.nxName === nxName)!);
}

yargs(hideBin(process.argv))
  .command({
    command: '$0',
    builder: (yargs) =>
      yargs
        .option('package', {
          type: 'string',
          choices: packages.flatMap((p) => [p.npmName, p.nxName]),
          description: 'The package to copy the build outputs from',
        })
        .option('repo', {
          type: 'string',
          description:
            'The root path of the repo to copy the built packages to',
        })
        .option('build', {
          type: 'boolean',
          description: 'Set to false to skip prebuild step.',
          default: true,
        }),
    handler: async (argv) => {
      const argvPackage =
        argv.package &&
        packages.find(
          (p) => p.nxName === argv.package || p.npmName === argv.package
        );
      const selectedPackages = argvPackage
        ? [argvPackage]
        : await promptPackages();

      const selectedNxProjects = selectedPackages.map((p) => p.nxName);

      const repo = argv.repo || (await new DirectoryPicker().run());

      if (argv.build) {
        execSync(
          'nx run-many --tuiAutoExit=0 -t build -p ' +
            selectedNxProjects.join(' '),
          {
            stdio: 'inherit',
          }
        );
      }

      const termWidth = process.stdout.columns || 80;
      const renderWidth = termWidth - termWidth * 0.2;

      for (const pkg of selectedPackages) {
        console.log();
        console.log(
          asciiBlock(
            renderWidth,
            2,
            1,
            `Copying ${pkg.npmName} to ${repo}/node_modules/${pkg.npmName}`
          )
            .map((line) => centerStringInWidth(line, termWidth))
            .join('\n')
        );
        copyBuiltPackage(pkg, repo);
      }
    },
  })
  .parseAsync();
