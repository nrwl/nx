import { readFileSync, writeFileSync } from 'fs';

function updatAngularVersionUtils(packageVersionMap: Map<string, string>) {
  const pathToFile = 'packages/angular/src/utils/versions.ts';
  let versionUtilContents = readFileSync(pathToFile, { encoding: 'utf-8' });

  const angularVersion = packageVersionMap.get('@angular/core') as string;
  const angularDevkitVersion = packageVersionMap.get('@angular/cli') as string;
  const ngPackagrVersion = packageVersionMap.get('ng-packagr') as string;

  versionUtilContents = versionUtilContents.replace(
    /export const angularVersion = '~(\d)+\.(\d)+\.(\d)+';/,
    `export const angularVersion = '~${angularVersion}';`
  );
  versionUtilContents = versionUtilContents.replace(
    /export const angularDevkitVersion = '~(\d)+\.(\d)+\.(\d)+';/,
    `export const angularDevkitVersion = '~${angularDevkitVersion}';`
  );
  versionUtilContents = versionUtilContents.replace(
    /export const ngPackagrVersion = '~(\d)+\.(\d)+\.(\d)+';/,
    `export const ngPackagrVersion = '~${ngPackagrVersion}';`
  );

  writeFileSync(pathToFile, versionUtilContents);
}
function updatNxAngularVersionUtils(packageVersionMap: Map<string, string>) {
  const pathToFile = 'packages/nx/src/utils/versions.ts';
  let versionUtilContents = readFileSync(pathToFile, { encoding: 'utf-8' });

  const angularDevkitVersion = packageVersionMap.get('@angular/cli') as string;

  versionUtilContents = versionUtilContents.replace(
    /export const angularCliVersion = '~(\d)+\.(\d)+\.(\d)+';/,
    `export const angularCliVersion = '~${angularDevkitVersion}';`
  );

  writeFileSync(pathToFile, versionUtilContents);
}
function updatWorkspaceAngularVersionUtils(
  packageVersionMap: Map<string, string>
) {
  const pathToFile = 'packages/workspace/src/utils/versions.ts';
  let versionUtilContents = readFileSync(pathToFile, { encoding: 'utf-8' });

  const angularDevkitVersion = packageVersionMap.get('@angular/cli') as string;

  versionUtilContents = versionUtilContents.replace(
    /export const angularCliVersion = '~(\d)+\.(\d)+\.(\d)+';/,
    `export const angularCliVersion = '~${angularDevkitVersion}';`
  );

  writeFileSync(pathToFile, versionUtilContents);
}

export function updateVersionUtils(packageVersionMap: Map<string, string>) {
  console.log('⏳ - Writing Util Files...');
  updatAngularVersionUtils(packageVersionMap);
  updatNxAngularVersionUtils(packageVersionMap);
  updatWorkspaceAngularVersionUtils(packageVersionMap);
  console.log('✅ - Wrote Util Files');
}
