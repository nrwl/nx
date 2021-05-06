const cypressPackageVersion = require('cypress/package.json').version;

export function installedCypressVersion() {
  const majorVersion = cypressPackageVersion.split('.')[0];
  if (!majorVersion) {
    return 0;
  }
  return +majorVersion;
}
