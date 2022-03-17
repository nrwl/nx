import { fileExists } from '@nrwl/workspace/src/utilities/fileutils';
import * as fs from 'fs';

export function readNameFromPackageJson(): string {
  let appName = 'webapp';
  if (fileExists('package.json')) {
    const data = fs.readFileSync('package.json');
    const json = JSON.parse(data.toString());
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
