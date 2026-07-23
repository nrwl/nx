import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('flat configs', () => {
  const files = readdirSync(__dirname).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts')
  );

  // `@nx/eslint`'s typed-linting detection treats a spread of these configs as
  // read rather than as a config it could not inspect, which is only sound while
  // none of them sets `parserOptions.project`. A `project` here would conflict
  // with the `projectService` the generators append.
  it.each(files)('%s does not set parserOptions.project', (file) => {
    const content = readFileSync(join(__dirname, file), 'utf-8');

    expect(content).not.toMatch(/\bproject\s*:/);
  });
});
