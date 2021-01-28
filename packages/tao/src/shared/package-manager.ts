import { existsSync } from 'fs';
import { join } from 'path';

export function detectPackageManager(dir = '') {
  return existsSync(join(dir, 'yarn.lock'))
    ? 'yarn'
    : existsSync(join(dir, 'pnpm-lock.yaml'))
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
  run: (scrit: string, args: string) => string;
} {
  switch (packageManager) {
    case 'yarn':
      return {
        install: 'yarn',
        add: 'yarn add',
        addDev: 'yarn add -D',
        rm: 'yarn rm',
        exec: 'yarn',
        run: (script: string, args: string) => `yarn ${script} ${args}`,
        list: 'yarn list',
      };

    case 'pnpm':
      return {
        install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
        add: 'pnpm add',
        addDev: 'pnpm add -D',
        rm: 'pnpm rm',
        exec: 'pnpx',
        run: (script: string, args: string) => `pnpm run ${script} -- ${args}`,
        list: 'pnpm ls --depth 100',
      };

    case 'npm':
      return {
        install: 'npm install --legacy-peer-deps',
        add: 'npm install --legacy-peer-deps',
        addDev: 'npm install --legacy-peer-deps -D',
        rm: 'npm rm',
        exec: 'npx',
        run: (script: string, args: string) => `npm run ${script} -- ${args}`,
        list: 'npm ls',
      };
  }
}
