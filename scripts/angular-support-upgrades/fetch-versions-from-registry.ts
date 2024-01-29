import axios from 'axios';
import { coerce, gt, SemVer } from 'semver';

type PackageSpec = string | { main: string; children: string[] };
const packagesToUpdate: PackageSpec[] = [
  {
    main: '@angular/cli',
    children: [
      '@angular-devkit/build-angular',
      '@angular-devkit/core',
      '@angular-devkit/schematics',
      '@angular/pwa',
      '@angular/ssr',
      '@schematics/angular',
    ],
  },
  {
    main: '@angular-devkit/architect',
    children: ['@angular-devkit/build-webpack'],
  },
  {
    main: '@angular/core',
    children: [
      '@angular/common',
      '@angular/compiler',
      '@angular/compiler-cli',
      '@angular/router',
    ],
  },
  {
    main: '@angular/material',
    children: ['@angular/cdk'],
  },
  'ng-packagr',
];

export async function fetchVersionsFromRegistry(
  targetVersion: 'latest' | 'next'
) {
  console.log('⏳ - Fetching versions from registry...');

  const packageVersionMap = new Map<string, string>();
  await Promise.all(
    packagesToUpdate.map((pkgSpec) =>
      fetch(packageVersionMap, pkgSpec, targetVersion)
    )
  );

  console.log('✅ - Finished fetching versions from registry');

  return packageVersionMap;
}

async function fetch(
  packageVersionMap: Map<string, string>,
  pkgSpec: PackageSpec,
  targetVersion: 'latest' | 'next'
) {
  function setPackageVersions(pkgSpec: PackageSpec, version: string) {
    if (typeof pkgSpec === 'string') {
      packageVersionMap.set(pkgSpec, version);
      return;
    }

    packageVersionMap.set(pkgSpec.main, version);
    for (const child of pkgSpec.children) {
      packageVersionMap.set(child, version);
    }
  }

  const pkgName = typeof pkgSpec === 'string' ? pkgSpec : pkgSpec.main;
  // set it to empty initially to keep the order of the specified packages
  setPackageVersions(pkgSpec, '');

  const response = await axios.get(`https://registry.npmjs.org/${pkgName}`);
  const distTags = response.data['dist-tags'];
  const latestVersion = distTags['latest'];
  if (targetVersion === 'latest') {
    setPackageVersions(pkgSpec, latestVersion);
    console.log(`     ${pkgName}: ${latestVersion}`);
  } else {
    const nextVersion = distTags['next'] ?? latestVersion;
    const coercedNextVersion = coerce(nextVersion) as SemVer;
    // check which is the greater version
    const versionToUse = gt(coercedNextVersion, latestVersion)
      ? nextVersion
      : latestVersion;
    setPackageVersions(pkgSpec, versionToUse);
    console.log(`     ${pkgName}: ${versionToUse}`);
  }
}
