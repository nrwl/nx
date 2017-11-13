import * as fs from 'fs';
import { Tree } from '@angular-devkit/schematics';

export function updateJsonFile(path: string, callback: (a: any) => any) {
  const json = JSON.parse(fs.readFileSync(path, 'utf-8'));
  callback(json);
  fs.writeFileSync(path, JSON.stringify(json, null, 2));
}

export function addApp(apps: any[] | undefined, newApp: any): any[] {
  if (!apps) {
    apps = [];
  }
  apps.push(newApp);

  apps.sort((a: any, b: any) => {
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

export function cliConfig(host: Tree): any {
  if (!host.exists('.angular-cli.json')) {
    throw new Error('Missing .angular-cli.json');
  }

  const sourceText = host.read('.angular-cli.json')!.toString('utf-8');
  return JSON.parse(sourceText);
}
