import { existsSync, readFileSync } from 'fs';
import { workspaceRoot } from '../../utils/workspace-root';
import { PackageJson } from '../../utils/package-json';

export function getRootVersion(packageName: string): string {
  return getPackageJson(`node_modules/${packageName}`)?.version;
}

function getPackageJson(path: string): PackageJson {
  const fullPath = `${workspaceRoot}/${path}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  }
  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.warn(`Could not find ${fullPath}`);
  }
  return;
}
