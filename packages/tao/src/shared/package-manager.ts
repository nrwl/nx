import { existsSync } from 'fs';

export function detectPackageManager() {
  return existsSync('yarn.lock')
    ? 'yarn'
    : existsSync('pnpm-lock.yaml')
    ? 'pnpm'
    : 'npm';
}

export function getPackageManagerCommand(
  packageManager = detectPackageManager()
): {
  install: string;
  add: string;
  addDev: string;
  rm: string;
  exec: string;
  list: string;
} {
  switch (packageManager) {
    case 'yarn':
      return {
        install: 'yarn',
        add: 'yarn add',
        addDev: 'yarn add -D',
        rm: 'yarn rm',
        exec: 'yarn',
        list: 'yarn list',
      };

    case 'pnpm':
      return {
        install: 'pnpm install',
        add: 'pnpm add',
        addDev: 'pnpm add -D',
        rm: 'pnpm rm',
        exec: 'pnpx',
        list: 'pnpm ls',
      };

    case 'npm':
      return {
        install: 'npm install',
        add: 'npm install',
        addDev: 'npm install -D',
        rm: 'npm rm',
        exec: 'npx',
        list: 'npm ls',
      };
  }
}
