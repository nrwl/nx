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

export function assertMinimumCypressVersion(minVersion: number) {
  const version = installedCypressVersion();
  if (version && version < minVersion) {
    throw new Error(
      `Cypress version of 10 or higher is not installed. Expected Cypress v10+, found Cypress v${version} instead.`
    );
  }
}
