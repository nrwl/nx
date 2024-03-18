import { readFileSync, writeFileSync } from 'fs';

function updatePackageJson(
  pathToPkgJson: string,
  packageVersionMap: Map<string, string>
) {
  const pkgJson = JSON.parse(
    readFileSync(pathToPkgJson, { encoding: 'utf-8' })
  );

  for (const [pkgName, version] of packageVersionMap.entries()) {
    if (pkgJson.devDependencies?.[pkgName]) {
      pkgJson.devDependencies[pkgName] = `~${version}`;
    }
    if (pkgJson.dependencies?.[pkgName]) {
      pkgJson.dependencies[pkgName] = `~${version}`;
    }
  }

  writeFileSync(pathToPkgJson, JSON.stringify(pkgJson, null, 2));
}

export async function updatePackageJsonForAngular(
  packageVersionMap: Map<string, string>
) {
  console.log('⏳ - Writing package.json files...');
  updatePackageJson('package.json', packageVersionMap);
  updatePackageJson('packages/angular/package.json', packageVersionMap);
  console.log('✅ - Wrote package.json files');
}
