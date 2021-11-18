import type { ExecutorContext } from '@nrwl/devkit';

export default async function run(
  _options: any,
  _context: ExecutorContext
): Promise<any> {
  throw new Error(
    `"@nrwl/linter:lint" was deprecated in v10 and is no longer supported. Update your angular.json to use "@nrwl/linter:eslint" builder instead.`
  );
}
