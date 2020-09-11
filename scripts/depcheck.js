const argv = require('yargs')
  .usage('Check projects for dependency discrepancies.')
  .option('projects', {
    alias: 'p',
    type: 'array',
    description: 'Projects to check',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  }).argv;

const depcheck = require('depcheck');
const { readFileSync, readdirSync } = require('fs');
const path = require('path');
const chalk = require('chalk');

const options = {
  skipMissing: false, // skip calculation of missing dependencies
  ignorePatterns: ['*.spec*'],
};

const packagesDirectory = path.join(__dirname, '..', 'packages');

const projects =
  argv.projects ||
  readdirSync(packagesDirectory, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

projects.forEach((project) => {
  const projectPath = path.join(packagesDirectory, project);
  const projectPackageJson = JSON.parse(
    readFileSync(`${projectPath}/package.json`)
  );

  depcheck(
    projectPath,
    { ...options, ...{ dependencies: projectPackageJson.dependencies } },
    ({
      dependencies,
      devDependencies,
      missing,
      using,
      invalidFiles,
      invalidDirs,
    }) => {
      const keys = Object.keys(missing).sort();

      if (keys.length > 0) {
        console.log(
          `\n${chalk.bold.inverse(` ${project.toUpperCase()} `)}\n${chalk.bgRed(
            'Missing'
          )}: ${keys.join(` | `)}`
        );

        if (argv.verbose) {
          console.log(missing);
        }
      }
    }
  );
});
