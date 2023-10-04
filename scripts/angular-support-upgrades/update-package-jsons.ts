import { readFileSync, writeFileSync } from 'fs';

function updateRootPackageJson(packageVersionMap: Map<string, string>) {
  const pathToPkgJson = 'package.json';
  const pkgJson = JSON.parse(
    readFileSync(pathToPkgJson, { encoding: 'utf-8' })
  );

  for (const [pkgName, version] of packageVersionMap.entries()) {
    if (pkgJson.devDependencies && pkgJson.devDependencies[pkgName]) {
      pkgJson.devDependencies[pkgName] = `~${version}`;
    }
    if (pkgJson.dependencies[pkgName]) {
      pkgJson.dependencies[pkgName] = `~${version}`;
    }
  }

  writeFileSync(pathToPkgJson, JSON.stringify(pkgJson, null, 2));
}

function updateAngularPackageJson(packageVersionMap: Map<string, string>) {
  const pathToPkgJson = 'packages/angular/package.json';
  const pkgJson = JSON.parse(
    readFileSync(pathToPkgJson, { encoding: 'utf-8' })
  );

  for (const [pkgName, version] of packageVersionMap.entries()) {
    if (pkgJson.devDependencies && pkgJson.devDependencies[pkgName]) {
      pkgJson.devDependencies[pkgName] = `~${version}`;
    }
    if (pkgJson.dependencies && pkgJson.dependencies[pkgName]) {
      pkgJson.dependencies[pkgName] = `~${version}`;
    }
  }

  writeFileSync(pathToPkgJson, JSON.stringify(pkgJson, null, 2));
}

export async function updatePackageJsonForAngular(
  packageVersionMap: Map<string, string>
) {
  console.log('⏳ - Writing package.json files...');
  updateRootPackageJson(packageVersionMap);
  updateAngularPackageJson(packageVersionMap);
  console.log('✅ - Wrote package.json files');
}
