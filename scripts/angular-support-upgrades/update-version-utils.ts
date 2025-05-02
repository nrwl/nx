import { readFileSync, writeFileSync } from 'fs';

function updateAngularVersionUtils(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  const pathToFile = 'packages/angular/src/utils/versions.ts';
  let versionUtilContents = readFileSync(pathToFile, { encoding: 'utf-8' });

  const angularVersion = packageVersionMap.get('@angular/core')!;
  const angularDevkitVersion = packageVersionMap.get('@angular/cli')!;
  const ngPackagrVersion = packageVersionMap.get('ng-packagr')!;

  versionUtilContents = versionUtilContents.replace(
    /export const angularVersion = '.+';/,
    `export const angularVersion = '${
      isPrerelease ? angularVersion : `~${angularVersion}`
    }';`
  );
  versionUtilContents = versionUtilContents.replace(
    /export const angularDevkitVersion = '.+';/,
    `export const angularDevkitVersion = '${
      isPrerelease ? angularDevkitVersion : `~${angularDevkitVersion}`
    }';`
  );
  versionUtilContents = versionUtilContents.replace(
    /export const ngPackagrVersion = '.+';/,
    `export const ngPackagrVersion = '${
      isPrerelease ? ngPackagrVersion : `~${ngPackagrVersion}`
    }';`
  );

  writeFileSync(pathToFile, versionUtilContents);
}

function updateWorkspaceAngularVersionUtils(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  const pathToFile = 'packages/workspace/src/utils/versions.ts';
  let versionUtilContents = readFileSync(pathToFile, { encoding: 'utf-8' });

  const angularDevkitVersion = packageVersionMap.get('@angular/cli')!;

  versionUtilContents = versionUtilContents.replace(
    /export const angularCliVersion = '~.+';/,
    `export const angularCliVersion = '${
      isPrerelease ? angularDevkitVersion : `~${angularDevkitVersion}`
    }';`
  );

  writeFileSync(pathToFile, versionUtilContents);
}

export function updateVersionUtils(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  console.log('⏳ - Writing Util Files...');
  updateAngularVersionUtils(packageVersionMap, isPrerelease);
  updateWorkspaceAngularVersionUtils(packageVersionMap, isPrerelease);
  console.log('✅ - Wrote Util Files');
}
