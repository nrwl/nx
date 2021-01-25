import * as chalk from 'chalk';
import { satisfies } from 'semver';

export default function getDiscrepancies(
  projectDependencies: JSON,
  devDependencies: JSON
) {
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
