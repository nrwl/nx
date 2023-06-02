import axios from 'axios';
import { coerce, gt, SemVer } from 'semver';

const packagesToUpdate = [
  '@angular-devkit/architect',
  '@angular-devkit/build-angular',
  '@angular-devkit/build-webpack',
  '@angular-devkit/core',
  '@angular-devkit/schematics',
  '@angular/cli',
  '@angular/common',
  '@angular/compiler',
  '@angular/compiler-cli',
  '@angular/core',
  '@angular/router',
  '@angular/material',
  '@angular/cdk',
  '@nguniversal/builders',
  '@nguniversal/common',
  '@nguniversal/express-engine',
  '@schematics/angular',
  'ng-packagr',
];

export async function fetchVersionsFromRegistry(
  targetVersion: 'latest' | 'next'
) {
  console.log('⏳ - Fetching versions from registry...');
  const packageVersionMap = new Map<string, string>();
  for (const pkgName of packagesToUpdate) {
    const response = await axios.get(`https://registry.npmjs.org/${pkgName}`);
    const distTags = response.data['dist-tags'];
    const latestVersion = distTags['latest'];
    if (targetVersion === 'latest') {
      packageVersionMap.set(pkgName, latestVersion);
      console.log(`     ${pkgName}: ${latestVersion}`);
    } else {
      const nextVersion = distTags['next'];
      const coercedNextVersion = coerce(nextVersion) as SemVer;
      // check which is the greater version
      const versionToUse = gt(coercedNextVersion, latestVersion)
        ? nextVersion
        : latestVersion;
      packageVersionMap.set(pkgName, versionToUse);
      console.log(`     ${pkgName}: ${versionToUse}`);
    }
  }
  console.log('✅ - Finished fetching versions from registry');
  return packageVersionMap;
}
