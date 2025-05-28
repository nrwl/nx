import { readFileSync, writeFileSync } from 'fs';

function updatePackageJson(
  pathToPkgJson: string,
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  const pkgJson = JSON.parse(
    readFileSync(pathToPkgJson, { encoding: 'utf-8' })
  );

  for (const [pkgName, version] of packageVersionMap.entries()) {
    const versionToUse = isPrerelease ? version : `~${version}`;
    if (pkgJson.devDependencies?.[pkgName]) {
      pkgJson.devDependencies[pkgName] = versionToUse;
    }
    if (pkgJson.dependencies?.[pkgName]) {
      pkgJson.dependencies[pkgName] = versionToUse;
    }
  }

  writeFileSync(pathToPkgJson, `${JSON.stringify(pkgJson, null, 2)}\n`);
}

export async function updatePackageJsonForAngular(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  console.log('⏳ - Writing package.json files...');
  updatePackageJson('package.json', packageVersionMap, isPrerelease);
  updatePackageJson(
    'packages/angular/package.json',
    packageVersionMap,
    isPrerelease
  );
  console.log('✅ - Wrote package.json files');
}
