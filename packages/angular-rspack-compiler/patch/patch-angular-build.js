const { readFileSync, renameSync } = require('fs');
const { gte, coerce } = require('semver');
const { join } = require('path');

function main() {
  const angularBuildPackageJson = require.resolve(
    '@angular/build/package.json'
  );
  const fileContentsJson = JSON.parse(
    readFileSync(angularBuildPackageJson, 'utf8')
  );
  if (gte(coerce(fileContentsJson.version), '20.2.0')) {
    return;
  }

  const angularBuildDirectory = dirname(angularBuildPackageJson);
  const angularBuildSrcDirectory = join(angularBuildDirectory, 'src');
  renameSync(
    join(__dirname, 'files', 'private.d.ts.txt'),
    join(angularBuildSrcDirectory, 'private.d.ts')
  );
  renameSync(
    join(__dirname, 'files', 'private.js.txt'),
    join(angularBuildSrcDirectory, 'private.js')
  );
}

main();
