import { readJsonFile } from '../../../../utils/fileutils';
import { exitAndFlushAnalytics } from '../../../../analytics/analytics';

export function checkForCustomWebpackSetup() {
  const packageJson = readJsonFile('package.json');
  const combinedDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  ['react-app-rewired', '@craco/craco'].forEach((pkg) => {
    if (combinedDeps[pkg]) {
      console.log(
        `Skipping migration due to custom webpack setup. Found "${pkg}" usage. Use --force to continue anyway.`
      );
      exitAndFlushAnalytics(1);
    }
  });
}
