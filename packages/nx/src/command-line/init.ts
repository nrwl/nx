import { execSync } from 'child_process';
import { existsSync } from 'fs';

export function initHandler() {
  const args = process.argv.slice(2).join(' ');
  if (existsSync('package.json')) {
    execSync(`npx --yes add-nx-to-monorepo@latest ${args}`, {
      stdio: [0, 1, 2],
    });
  } else {
    execSync(`npx --yes create-nx-workspace@latest ${args}`, {
      stdio: [0, 1, 2],
    });
  }
}
