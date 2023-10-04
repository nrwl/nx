import { fileExists, readJsonFile } from '../../../../utils/fileutils';

export function readNameFromPackageJson(): string {
  let appName = 'webapp';
  if (fileExists('package.json')) {
    const json = readJsonFile('package.json');
    if (
      json['name'] &&
      json['name'].length &&
      json['name'].replace(/\s/g, '').length
    ) {
      appName = json['name'].replace(/\s/g, '');
    }
  }
  return appName;
}
