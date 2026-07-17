import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateOwnersAndConformance } from './update-owners-and-conformance';

describe('updateOwnersAndConformance', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(() => {
    schema = {
      projectName: 'my-lib',
      destination: 'shared/my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'libs/shared/my-destination',
    };

    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('conformance rules', () => {
    it('should rename project in conformance rule projects', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        conformance: {
          rules: [
            {
              rule: './some-rule',
              projects: ['my-lib', 'other-lib'],
            },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.conformance.rules[0].projects).toEqual([
        'my-destination',
        'other-lib',
      ]);
    });

    it('should rename project in conformance rule with matcher objects', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        conformance: {
          rules: [
            {
              rule: './some-rule',
              projects: [
                { matcher: 'my-lib', explanation: 'reason' },
                { matcher: 'other-lib' },
              ],
            },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.conformance.rules[0].projects).toEqual([
        { matcher: 'my-destination', explanation: 'reason' },
        { matcher: 'other-lib' },
      ]);
    });

    it('should not modify rules without projects', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        conformance: {
          rules: [{ rule: './some-rule' }],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.conformance.rules[0]).toEqual({ rule: './some-rule' });
    });

    it('should preserve glob patterns and tag references', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        conformance: {
          rules: [
            {
              rule: './some-rule',
              projects: ['my-lib', 'tag:frontend', 'lib-*'],
            },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.conformance.rules[0].projects).toEqual([
        'my-destination',
        'tag:frontend',
        'lib-*',
      ]);
    });

    it('should handle multiple rules', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        conformance: {
          rules: [
            { rule: './rule-a', projects: ['my-lib'] },
            { rule: './rule-b', projects: ['other-lib'] },
            { rule: './rule-c', projects: ['my-lib', 'other-lib'] },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.conformance.rules[0].projects).toEqual(['my-destination']);
      expect(nxJson.conformance.rules[1].projects).toEqual(['other-lib']);
      expect(nxJson.conformance.rules[2].projects).toEqual([
        'my-destination',
        'other-lib',
      ]);
    });

    it('should not modify nxJson when no conformance config exists', () => {
      const originalNxJson = readNxJson(tree);

      updateOwnersAndConformance(tree, schema);

      expect(readNxJson(tree)).toEqual(originalNxJson);
    });
  });

  describe('owners patterns', () => {
    it('should rename project in owners pattern projects', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        owners: {
          patterns: [
            { projects: ['my-lib', 'other-lib'], owners: ['@team-a'] },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners.patterns[0].projects).toEqual([
        'my-destination',
        'other-lib',
      ]);
    });

    it('should rename project in section-level patterns', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        owners: {
          sections: [
            {
              name: 'Core',
              defaultOwners: ['@core-team'],
              patterns: [
                { projects: ['my-lib'], owners: ['@team-a'] },
                { projects: ['other-lib'], owners: ['@team-b'] },
              ],
            },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners.sections[0].patterns[0].projects).toEqual([
        'my-destination',
      ]);
      expect(nxJson.owners.sections[0].patterns[1].projects).toEqual([
        'other-lib',
      ]);
    });

    it('should not modify patterns without projects', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        owners: {
          patterns: [{ owners: ['@team-a'] }],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners.patterns[0]).toEqual({ owners: ['@team-a'] });
    });

    it('should preserve glob patterns and tag references', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        owners: {
          patterns: [
            {
              projects: ['my-lib', 'tag:frontend', 'lib-*'],
              owners: ['@team-a'],
            },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners.patterns[0].projects).toEqual([
        'my-destination',
        'tag:frontend',
        'lib-*',
      ]);
    });

    it('should handle owners set to true', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        owners: true,
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners).toBe(true);
    });

    it('should handle both top-level and section patterns', () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        owners: {
          patterns: [{ projects: ['my-lib'], owners: ['@team-a'] }],
          sections: [
            {
              name: 'Section',
              defaultOwners: ['@default'],
              patterns: [{ projects: ['my-lib'], owners: ['@team-b'] }],
            },
          ],
        },
      } as any);

      updateOwnersAndConformance(tree, schema);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners.patterns[0].projects).toEqual(['my-destination']);
      expect(nxJson.owners.sections[0].patterns[0].projects).toEqual([
        'my-destination',
      ]);
    });
  });
});
