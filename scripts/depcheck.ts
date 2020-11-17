import * as depcheck from 'depcheck';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as chalk from 'chalk';
import { satisfies } from 'semver';

const argv = require('yargs')
  .usage('Check projects for dependency discrepancies.')
  .option('projects', {
    alias: 'p',
    type: 'array',
    description: 'Projects to check',
  })
  .option('missing', {
    alias: 'm',
    type: 'boolean',
    default: false,
    description: 'Check for missing dependencies',
  })
  .option('discrepancies', {
    alias: 'd',
    type: 'boolean',
    default: true,
    description: 'Check for discrepancies between package and dev dependencies',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  }).argv;

(async () => {
  const { devDependencies } = JSON.parse(
    readFileSync(`./package.json`).toString()
  );

  const packagesDirectory = join(__dirname, '..', 'packages');

  const projects =
    argv.projects ||
    readdirSync(packagesDirectory, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

  const results = await Promise.all(
    projects
      .sort()
      .map((name) => ({ name }))
      .map(async (project) => {
        const projectPath = join(packagesDirectory, project.name);
        const { dependencies } = JSON.parse(
          readFileSync(`${projectPath}/package.json`).toString()
        );

        const missing = argv.missing
          ? await getMissingDependencies(
              project.name,
              projectPath,
              dependencies
            )
          : [];

        const discrepancies = argv.discrepancies
          ? getDiscrepancies(dependencies, devDependencies)
          : [];

        return { ...project, missing, discrepancies };
      })
  );

  const total = { missing: 0, discrepancies: 0 };

  results.forEach(({ name, missing, discrepancies }) => {
    if (!missing.length && !discrepancies.length) {
      return;
    }

    console.log(`${chalk.inverse.bold.cyan(` ${name.toUpperCase()} `)}`);

    if (missing.length > 0) {
      total.missing += missing.length;
      console.log(
        `⚠️  ${chalk.bold.inverse(` Missing `)}\n${missing
          .sort()
          .map(
            (p) => `   ${devDependencies[p] ? `${p}@${devDependencies[p]}` : p}`
          )
          .join(`\n`)}\n`
      );
    }

    if (discrepancies.length > 0) {
      total.discrepancies += discrepancies.length;
      console.log(
        `⛔  ${chalk.bold.inverse(` Discrepancies `)}\n${discrepancies
          .map((d) => `   ${d}`)
          .join(`\n`)}\n`
      );
    }
  });

  if (total.discrepancies > 0) {
    process.exit(1);
  }

  process.exit(0);
})().catch((err) => console.log(err));

async function getMissingDependencies(
  name: string,
  path: string,
  dependencies: JSON
) {
  const options: any = {
    skipMissing: false, // skip calculation of missing dependencies
    ignorePatterns: ['*.spec*'],
  };
  const { missing } = await depcheck(path, {
    ...options,
    package: { dependencies },
  });

  if (argv.verbose) {
    console.log(name, missing);
  }

  return Object.keys(missing).filter((p) => !p.startsWith('@nrwl/'));
}

function getDiscrepancies(projectDependencies: JSON, devDependencies: JSON) {
  return Object.keys(projectDependencies)
    .filter((p) => !p.startsWith('@nrwl/'))
    .filter(
      (p) =>
        devDependencies[p] &&
        projectDependencies[p] !== devDependencies[p] &&
        !satisfies(devDependencies[p], projectDependencies[p])
    )
    .map(
      (p) => `${p}@${devDependencies[p]} ${chalk.dim(projectDependencies[p])}`
    );
}
