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
  exec: string;
} {
  switch (packageManager) {
    case 'yarn':
      return {
        install: 'yarn',
        add: 'yarn add',
        addDev: 'yarn add -D',
        exec: 'yarn',
      };

    case 'pnpm':
      return {
        install: 'pnpm install',
        add: 'pnpm add',
        addDev: 'pnpm add -D',
        exec: 'pnpx',
      };

    case 'npm':
      return {
        install: 'npm install',
        add: 'npm install',
        addDev: 'npm install -D',
        exec: 'npx',
      };
  }
}
