import { readFileSync, writeFileSync } from 'fs';

function updateAngularVersionUtils(packageVersionMap: Map<string, string>) {
  const pathToFile = 'packages/angular/src/utils/versions.ts';
  let versionUtilContents = readFileSync(pathToFile, { encoding: 'utf-8' });

  const angularVersion = packageVersionMap.get('@angular/core')!;
  const angularDevkitVersion = packageVersionMap.get('@angular/cli')!;
  const ngPackagrVersion = packageVersionMap.get('ng-packagr')!;
  const ngUniversalVersion = packageVersionMap.get('@nguniversal/common')!;

  versionUtilContents = versionUtilContents.replace(
    /export const angularVersion = '~.+';/,
    `export const angularVersion = '~${angularVersion}';`
  );
  versionUtilContents = versionUtilContents.replace(
    /export const angularDevkitVersion = '~.+';/,
    `export const angularDevkitVersion = '~${angularDevkitVersion}';`
  );
  versionUtilContents = versionUtilContents.replace(
    /export const ngPackagrVersion = '~.+';/,
    `export const ngPackagrVersion = '~${ngPackagrVersion}';`
  );
  versionUtilContents = versionUtilContents.replace(
    /export const ngUniversalVersion = '~.+';/,
    `export const ngUniversalVersion = '~${ngUniversalVersion}';`
  );

  writeFileSync(pathToFile, versionUtilContents);
}

function updateWorkspaceAngularVersionUtils(
  packageVersionMap: Map<string, string>
) {
  const pathToFile = 'packages/workspace/src/utils/versions.ts';
  let versionUtilContents = readFileSync(pathToFile, { encoding: 'utf-8' });

  const angularDevkitVersion = packageVersionMap.get('@angular/cli')!;

  versionUtilContents = versionUtilContents.replace(
    /export const angularCliVersion = '~.+';/,
    `export const angularCliVersion = '~${angularDevkitVersion}';`
  );

  writeFileSync(pathToFile, versionUtilContents);
}

export function updateVersionUtils(packageVersionMap: Map<string, string>) {
  console.log('⏳ - Writing Util Files...');
  updateAngularVersionUtils(packageVersionMap);
  updateWorkspaceAngularVersionUtils(packageVersionMap);
  console.log('✅ - Wrote Util Files');
}
