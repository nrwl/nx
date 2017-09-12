import * as fs from 'fs';

export function updateJsonFile(path: string, callback: (a: any) => any) {
  const json = JSON.parse(fs.readFileSync(path, 'utf-8'));
  callback(json);
  fs.writeFileSync(path, JSON.stringify(json, null, 2));
}
