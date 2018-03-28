import * as fs from 'fs';
import * as path from 'path';

export function readJsonFile(path: string) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

export function updateJsonFile(path: string, callback: (a: any) => any) {
  const json = readJsonFile(path);
  callback(json);
  fs.writeFileSync(path, serializeJson(json));
}

export function addApp(apps: any[] | undefined, newApp: any): any[] {
  if (!apps) {
    apps = [];
  }
  apps.push(newApp);

  apps.sort((a: any, b: any) => {
    if (a.name === '$workspaceRoot') return 1;
    if (b.name === '$workspaceRoot') return -1;
    if (a.main && !b.main) return -1;
    if (!a.main && b.main) return 1;
    if (a.name > b.name) return 1;
    return -1;
  });
  return apps;
}

export function serializeJson(json: any): string {
  return `${JSON.stringify(json, null, 2)}\n`;
}

export function readCliConfigFile(): any {
  return readJsonFile('.angular-cli.json');
}

export function copyFile(file: string, target: string) {
  const f = path.basename(file);
  const source = fs.createReadStream(file);
  const dest = fs.createWriteStream(path.resolve(target, f));
  source.pipe(dest);
  source.on('error', e => console.error(e));
}
