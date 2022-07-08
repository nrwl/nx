let cypressPackageJson;
let loadedCypress = false;

export function installedCypressVersion() {
  if (!loadedCypress) {
    try {
      cypressPackageJson = require('cypress/package.json');
    } catch {}
  }

  if (!cypressPackageJson) {
    return null;
  }
  const cypressPackageVersion = cypressPackageJson.version;
  const majorVersion = cypressPackageVersion.split('.')[0];
  if (!majorVersion) {
    return 0;
  }
  return +majorVersion;
}

/**
 * will not throw if cypress is not installed
 */
export function assertMinimumCypressVersion(minVersion: number) {
  const version = installedCypressVersion();
  if (version && version < minVersion) {
    throw new Error(
      `Cypress version of ${minVersion} or higher is not installed. Expected Cypress v${minVersion}+, found Cypress v${version} instead.`
    );
  }
}
