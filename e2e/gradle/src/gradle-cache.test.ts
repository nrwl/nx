import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

import { createGradleProject } from './utils/create-gradle-project';

describe('Gradle cache invalidation', () => {
  const gradleProjectName = uniq('my-gradle-project');

  beforeAll(() => {
    newProject({ packages: [] });
    createGradleProject(gradleProjectName, 'kotlin');
    // Created before the graph is computed so it is tracked as an input.
    createFile('list/src/main/resources/config.conf', 'setting = initial\n');
    runCLI(`add @nx/gradle`);
  });
  afterAll(() => cleanupProject());

  // A cache hit renders as "[local cache]", "[remote cache]", or, when the
  // outputs on disk already match, "[existing outputs match the cache]".
  const fromCache = (task: string) =>
    new RegExp(`${task}.*\\[(local cache|remote cache|existing outputs match)`);

  it('should rebuild on source and resource changes and hit cache otherwise', () => {
    // Fresh workspace: first build misses, rebuild hits.
    let output = runCLI('run list:jar', { verbose: true });
    expect(output).not.toMatch(fromCache('list:jar'));
    output = runCLI('run list:jar', { verbose: true });
    expect(output).toMatch(fromCache('list:jar'));

    // Source change (a new function, so the bytecode changes): compilation
    // and jar rerun, then both cache again.
    const sourceFile = findFirstFile(
      join(tmpProjPath(), 'list/src/main/kotlin'),
      '.kt'
    );
    updateFile(
      relative(tmpProjPath(), sourceFile),
      (content) => `${content}\nfun cacheInvalidationProbe(): Int = 42\n`
    );
    output = runCLI('run list:jar', { verbose: true });
    expect(output).not.toMatch(fromCache('list:compileKotlin'));
    expect(output).not.toMatch(fromCache('list:jar'));
    output = runCLI('run list:jar', { verbose: true });
    expect(output).toMatch(fromCache('list:jar'));

    // Resource change: jar repackages while compilation stays cached, then
    // caches again.
    updateFile('list/src/main/resources/config.conf', 'setting = changed\n');
    output = runCLI('run list:jar', { verbose: true });
    expect(output).not.toMatch(fromCache('list:jar'));
    expect(output).toMatch(fromCache('list:compileKotlin'));
    output = runCLI('run list:jar', { verbose: true });
    expect(output).toMatch(fromCache('list:jar'));

    // NEW resource file, added after the graph was computed: still invalidates,
    // because inputs are directory globs rather than a frozen file list.
    createFile('list/src/main/resources/added-later.conf', 'setting = new\n');
    output = runCLI('run list:jar', { verbose: true });
    expect(output).not.toMatch(fromCache('list:jar'));
    output = runCLI('run list:jar', { verbose: true });
    expect(output).toMatch(fromCache('list:jar'));

    // Unrelated file: cache hit.
    createFile('list/notes.md', 'not an input\n');
    output = runCLI('run list:jar', { verbose: true });
    expect(output).toMatch(fromCache('list:jar'));
  });
});

function findFirstFile(dir: string, extension: string): string {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const found = findFirstFile(full, extension);
      if (found) {
        return found;
      }
    } else if (entry.endsWith(extension)) {
      return full;
    }
  }
  return '';
}
