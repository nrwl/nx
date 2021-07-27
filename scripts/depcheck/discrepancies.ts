import * as chalk from 'chalk';
import { satisfies } from 'semver';

// Ignore packages that are defined here per package
const IGNORE_MATCHES = {
  '*': [],
  angular: ['webpack-merge', '@phenomnomnominal/tsquery'],
};

export default function getDiscrepancies(
  name: string,
  projectDependencies: JSON,
  devDependencies: JSON
) {
  return Object.keys(projectDependencies)
    .filter((p) => !p.startsWith('@nrwl/'))
    .filter((p) =>
      !IGNORE_MATCHES['*'].includes(p) && IGNORE_MATCHES[name]
        ? !IGNORE_MATCHES[name].includes(p)
        : true
    )
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
