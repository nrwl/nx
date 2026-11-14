import { stripVTControlCharacters } from 'node:util';
import { cleanupProject, newProject, runCLI, updateJson } from '@nx/e2e-utils';

describe('@nx/conformance', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/conformance', '@nx/owners', '@nx/js'] });
  });

  afterAll(() => cleanupProject());

  it('should run conformance commands', () => {
    for (const command of ['conformance', 'conformance:check']) {
      const output = runCLI(command, { silenceError: true });
      expect(runCLI.lastExitCode).not.toBe(0);
      expect(output).toContain(
        `No "conformance" configuration found in nx.json`
      );
    }

    updateJson('nx.json', (json) => {
      json.conformance = {
        rules: [
          { rule: '@nx/conformance/enforce-project-boundaries' },
          { rule: '@nx/owners/ensure-owners' },
        ],
      };
      return json;
    });

    for (const command of ['conformance', 'conformance:check']) {
      const output = stripVTControlCharacters(runCLI(command));
      expect(output).toContain(
        `@nx/conformance/enforce-project-boundaries - maintainability | medium severity | status: enforced`
      );
      expect(output).toContain(
        `@nx/owners/ensure-owners - consistency | medium severity | status: enforced`
      );
      expect(output).toContain(`NX   Conformance checks passed successfully`);
      expect(output).toContain(`No violations found across 2 rules.`);
      expect(output).toContain(
        `Results data written to dist/conformance-result.json`
      );
    }
  });
});
