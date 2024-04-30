import { readFileSync } from 'fs';
import { join } from 'path';
import { TempFs } from '../../../internal-testing-utils/temp-fs';
import { IMPLICIT_DEFAULT_RELEASE_GROUP } from './config';
import { ReleaseGroupWithName } from './filter-release-groups';
import {
  RawVersionPlan,
  readRawVersionPlans,
  setVersionPlansOnGroups,
} from './version-plans';

expect.addSnapshotSerializer({
  serialize(str: string) {
    // regex to replace all but the relative path of
    return str.replaceAll(
      /(\/.*\/\.nx\/)(version-plans\/.*\.md)/g,
      '<workspace-root>/$2'
    );
  },
  test(val: string) {
    return val != null && typeof val === 'string';
  },
});

describe('version-plans', () => {
  let tempFs: TempFs;

  beforeAll(async () => {
    tempFs = new TempFs('parse-version-plans');

    await tempFs.createFiles({
      '.nx/version-plans/plan1.md': readFileSync(
        join(__dirname, 'test-files/version-plan-1.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan2.md': readFileSync(
        join(__dirname, 'test-files/version-plan-2.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan3.md': readFileSync(
        join(__dirname, 'test-files/version-plan-3.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan4.md': readFileSync(
        join(__dirname, 'test-files/version-plan-4.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan5.md': readFileSync(
        join(__dirname, 'test-files/version-plan-5.md'),
        'utf-8'
      ),
      '.nx/version-plans/plan6.md': readFileSync(
        join(__dirname, 'test-files/version-plan-6.md'),
        'utf-8'
      ),
    });
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  describe('readRawVersionPlans', () => {
    it('should parse all version plan files into raw version plan objects', async () => {
      const result = await readRawVersionPlans();
      result.forEach((r) => {
        expect(typeof r.createdOnMs).toBe('number');
        delete r.createdOnMs;
      });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            absolutePath: <workspace-root>/version-plans/plan1.md,
            content: {
              pkg1: patch,
            },
            fileName: plan1.md,
            message: This is a change to just package 1,
            relativePath: .nx/version-plans/plan1.md,
          },
          {
            absolutePath: <workspace-root>/version-plans/plan2.md,
            content: {
              pkg1: minor,
              pkg2: patch,
            },
            fileName: plan2.md,
            message: This is a change to package 1 and package 2,
            relativePath: .nx/version-plans/plan2.md,
          },
          {
            absolutePath: <workspace-root>/version-plans/plan3.md,
            content: {
              pkg3: major,
              pkg4: minor,
            },
            fileName: plan3.md,
            message: This is a change to packages 3 and 4,
            relativePath: .nx/version-plans/plan3.md,
          },
          {
            absolutePath: <workspace-root>/version-plans/plan4.md,
            content: {
              pkg3: patch,
              pkg4: minor,
              pkg5: prerelease,
              pkg6: preminor,
            },
            fileName: plan4.md,
            message: This is a change to packages 3, 4, 5, and 6,
            relativePath: .nx/version-plans/plan4.md,
          },
          {
            absolutePath: <workspace-root>/version-plans/plan5.md,
            content: {
              fixed-group-1: minor,
            },
            fileName: plan5.md,
            message: This is a change to fixed-group-1,
            relativePath: .nx/version-plans/plan5.md,
          },
          {
            absolutePath: <workspace-root>/version-plans/plan6.md,
            content: {
              fixed-group-1: major,
              fixed-group-2: minor,
              pkg3: major,
            },
            fileName: plan6.md,
            message: This is a major change to fixed-group-1 and pkg3 and a minor change to fixed-group-2,
            relativePath: .nx/version-plans/plan6.md,
          },
        ]
      `);
    });
  });

  describe('setVersionPlansOnGroups', () => {
    describe('error cases', () => {
      describe('for default group', () => {
        describe('when bump "key" is a group name', () => {
          it('should error if version plans are not enabled', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  // This shouldn't really ever happen,
                  // but if it does, we're ready for it
                  [IMPLICIT_DEFAULT_RELEASE_GROUP]: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: [],
                versionPlans: false,
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump in 'plan1.md' but version plans are not enabled.`
            );
          });

          it('should error if group is independently versioned', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  [IMPLICIT_DEFAULT_RELEASE_GROUP]: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'independent',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump in 'plan1.md' but projects are configured to be independently versioned. Individual projects should be bumped instead.`
            );
          });

          it('should error if bump "value" is not a release type', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  [IMPLICIT_DEFAULT_RELEASE_GROUP]: 'not-a-release-type',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump in 'plan1.md' with an invalid release type. Please specify one of major, premajor, minor, preminor, patch, prepatch, prerelease.`
            );
          });

          it('should error if fixed default group has two different entries with different bump types', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'minor',
                  [IMPLICIT_DEFAULT_RELEASE_GROUP]: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump in 'plan1.md' that conflicts with another version bump. When in fixed versioning mode, all version bumps must match.`
            );
          });
        });

        describe('when bump "key" is a project name', () => {
          it('should error if project does not exist in the workspace', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  nonExistentPkg: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = [];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'nonExistentPkg' in 'plan1.md' but the project does not exist in the workspace.`
            );
          });

          it('should error if version plans are not enabled', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1'],
                versionPlans: false,
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg1' in 'plan1.md' but version plans are not enabled.`
            );
          });

          it('should error if project is not included in the default release group', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg2: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1', 'pkg2'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg2' in 'plan1.md' but the project is not configured for release. Ensure it is included by the 'release.projects' globs in nx.json.`
            );
          });

          it(`should error if project's bump "value" is not a release type`, () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'not-a-release-type',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg1' in 'plan1.md' with an invalid release type. Please specify one of major, premajor, minor, preminor, patch, prepatch, prerelease.`
            );
          });

          it('should error if the fixed default group has two different projects with different bump types', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'patch',
                  pkg2: 'minor',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: IMPLICIT_DEFAULT_RELEASE_GROUP,
                projects: ['pkg1', 'pkg2'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1', 'pkg2'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg2' in 'plan1.md' that conflicts with another version bump. When in fixed versioning mode, all version bumps must match.`
            );
          });
        });
      });

      describe('for explicit groups', () => {
        describe('when bump "key" is a group name', () => {
          it('should error if version plans are not enabled', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  group1: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: false,
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for group 'group1' in 'plan1.md' but the group does not have version plans enabled.`
            );
          });

          it('should error if group is independently versioned', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  group1: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'independent',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for group 'group1' in 'plan1.md' but the group's projects are independently versioned. Individual projects of 'group1' should be bumped instead.`
            );
          });

          it('should error if bump "value" is not a release type', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  group1: 'not-a-release-type',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for group 'group1' in 'plan1.md' with an invalid release type. Please specify one of major, premajor, minor, preminor, patch, prepatch, prerelease.`
            );
          });

          it('should error if fixed group has two different entries with different bump types', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'minor',
                  group1: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for group 'group1' in 'plan1.md' that conflicts with another version bump for this group. When the group is in fixed versioning mode, all groups' version bumps within the same version plan must match.`
            );
          });
        });
        describe('when bump "key" is a project name', () => {
          it('should error if version plans are not enabled', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'patch',
                  pkg2: 'minor',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
              releaseGroup({
                name: 'group2',
                projects: ['pkg2'],
                versionPlans: false,
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1', 'pkg2'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg2' in 'plan1.md' but the project's group 'group2' does not have version plans enabled.`
            );
          });

          it('should error if project does not exist in the workspace', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  nonExistentPkg: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = [];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'nonExistentPkg' in 'plan1.md' but the project does not exist in the workspace.`
            );
          });

          it('should error if project is not included in any release groups', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg3: 'patch',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
              releaseGroup({
                name: 'group2',
                projects: ['pkg2'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = [
              'pkg1',
              'pkg2',
              'pkg3',
            ];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg3' in 'plan1.md' but the project is not in any configured release groups.`
            );
          });

          it(`should error if project's bump "value" is not a release type`, () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'not-a-release-type',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg1' in 'plan1.md' with an invalid release type. Please specify one of major, premajor, minor, preminor, patch, prepatch, prerelease.`
            );
          });

          it('should error if a fixed group has two different projects with different bump types', () => {
            const rawVersionPlans: RawVersionPlan[] = [
              versionPlan({
                name: 'plan1.md',
                content: {
                  pkg1: 'patch',
                  pkg2: 'minor',
                },
                message: 'plan1 message',
              }),
            ];
            const releaseGroups: ReleaseGroupWithName[] = [
              releaseGroup({
                name: 'group1',
                projects: ['pkg1', 'pkg2'],
                versionPlans: [],
                projectsRelationship: 'fixed',
              }),
            ];
            const allProjectNamesInWorkspace: string[] = ['pkg1', 'pkg2'];

            expect(() =>
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            ).toThrowErrorMatchingInlineSnapshot(
              `Found a version bump for project 'pkg2' in 'plan1.md' that conflicts with another project's version bump in the same release group 'group1'. When the group is in fixed versioning mode, all projects' version bumps within the same group must match.`
            );
          });
        });
      });
    });

    describe('success cases', () => {
      describe('for default group', () => {
        it('should correctly handle fixed default group', () => {
          const rawVersionPlans: RawVersionPlan[] = [
            versionPlan({
              name: 'plan2.md',
              content: {
                pkg1: 'minor',
                pkg2: 'minor',
                pkg3: 'minor',
              },
              message: 'plan2 message',
            }),
            versionPlan({
              name: 'plan1.md',
              content: {
                // for the default group, in fixed mode, we'll show individual
                // entries for each project because there isn't a group name
                pkg1: 'patch',
                pkg2: 'patch',
                pkg3: 'patch',
              },
              message: 'plan1 message',
            }),
          ];
          const releaseGroups: ReleaseGroupWithName[] = [
            releaseGroup({
              name: IMPLICIT_DEFAULT_RELEASE_GROUP,
              projects: ['pkg1', 'pkg2', 'pkg3'],
              versionPlans: [],
              projectsRelationship: 'fixed',
            }),
          ];
          const allProjectNamesInWorkspace: string[] = ['pkg1', 'pkg2', 'pkg3'];

          expect(
            peelResultFromGroups(
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            )
            // plan 1 should be first in the list because it was created after plan 2
          ).toMatchInlineSnapshot(`
            [
              {
                name: __default__,
                versionPlans: [
                  {
                    absolutePath: <workspace-root>/version-plans/plan1.md,
                    createdOnMs: 20,
                    fileName: plan1.md,
                    groupVersionBump: patch,
                    message: plan1 message,
                    relativePath: .nx/version-plans/plan1.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan2.md,
                    createdOnMs: 19,
                    fileName: plan2.md,
                    groupVersionBump: minor,
                    message: plan2 message,
                    relativePath: .nx/version-plans/plan2.md,
                  },
                ],
              },
            ]
          `);
        });

        it('should correctly handle independent default group', () => {
          const rawVersionPlans: RawVersionPlan[] = [
            versionPlan({
              name: 'plan2.md',
              content: {
                pkg1: 'minor',
                pkg2: 'minor',
                pkg3: 'minor',
              },
              message: 'plan2 message',
            }),
            versionPlan({
              name: 'plan1.md',
              content: {
                pkg1: 'patch',
                pkg2: 'minor',
                pkg3: 'major',
              },
              message: 'plan1 message',
            }),
            versionPlan({
              name: 'plan3.md',
              content: {
                pkg1: 'minor',
                pkg2: 'patch',
                pkg3: 'patch',
              },
              message: 'plan3 message',
            }),
          ];
          const releaseGroups: ReleaseGroupWithName[] = [
            releaseGroup({
              name: IMPLICIT_DEFAULT_RELEASE_GROUP,
              projects: ['pkg1', 'pkg2', 'pkg3'],
              versionPlans: [],
              projectsRelationship: 'independent',
            }),
          ];
          const allProjectNamesInWorkspace: string[] = ['pkg1', 'pkg2', 'pkg3'];

          expect(
            peelResultFromGroups(
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            )
          ).toMatchInlineSnapshot(`
            [
              {
                name: __default__,
                versionPlans: [
                  {
                    absolutePath: <workspace-root>/version-plans/plan3.md,
                    createdOnMs: 23,
                    fileName: plan3.md,
                    message: plan3 message,
                    projectVersionBumps: {
                      pkg1: minor,
                      pkg2: patch,
                      pkg3: patch,
                    },
                    relativePath: .nx/version-plans/plan3.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan1.md,
                    createdOnMs: 22,
                    fileName: plan1.md,
                    message: plan1 message,
                    projectVersionBumps: {
                      pkg1: patch,
                      pkg2: minor,
                      pkg3: major,
                    },
                    relativePath: .nx/version-plans/plan1.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan2.md,
                    createdOnMs: 21,
                    fileName: plan2.md,
                    message: plan2 message,
                    projectVersionBumps: {
                      pkg1: minor,
                      pkg2: minor,
                      pkg3: minor,
                    },
                    relativePath: .nx/version-plans/plan2.md,
                  },
                ],
              },
            ]
          `);
        });
      });

      describe('for explicit groups', () => {
        it('should correctly handle fixed and independent groups', () => {
          const rawVersionPlans: RawVersionPlan[] = [
            versionPlan({
              name: 'plan2.md',
              content: {
                pkg1: 'minor',
                pkg2: 'minor',
                pkg3: 'minor',
              },
              message: 'plan2 message',
            }),
            versionPlan({
              name: 'plan1.md',
              content: {
                group1: 'patch',
                group3: 'major',
                pkg4: 'preminor',
                pkg5: 'preminor',
              },
              message: 'plan1 message',
            }),
            versionPlan({
              name: 'plan3.md',
              content: {
                group1: 'major',
                group2: 'patch',
                pkg5: 'premajor',
              },
              message: 'plan3 message',
            }),
          ];
          const releaseGroups: ReleaseGroupWithName[] = [
            releaseGroup({
              name: 'group1',
              projects: ['pkg1'],
              versionPlans: [],
              projectsRelationship: 'fixed',
            }),
            releaseGroup({
              name: 'group2',
              projects: ['pkg2'],
              versionPlans: [],
              projectsRelationship: 'fixed',
            }),
            releaseGroup({
              name: 'group3',
              projects: ['pkg3'],
              versionPlans: [],
              projectsRelationship: 'fixed',
            }),
            releaseGroup({
              name: 'group4',
              projects: ['pkg4', 'pkg5'],
              versionPlans: [],
              projectsRelationship: 'independent',
            }),
            releaseGroup({
              name: 'group5',
              projects: ['pkg6'],
              versionPlans: false,
              projectsRelationship: 'fixed',
            }),
          ];
          const allProjectNamesInWorkspace: string[] = [
            'pkg1',
            'pkg2',
            'pkg3',
            'pkg4',
            'pkg5',
          ];

          expect(
            peelResultFromGroups(
              setVersionPlansOnGroups(
                rawVersionPlans,
                releaseGroups,
                allProjectNamesInWorkspace
              )
            )
          ).toMatchInlineSnapshot(`
            [
              {
                name: group1,
                versionPlans: [
                  {
                    absolutePath: <workspace-root>/version-plans/plan3.md,
                    createdOnMs: 26,
                    fileName: plan3.md,
                    groupVersionBump: major,
                    message: plan3 message,
                    relativePath: .nx/version-plans/plan3.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan1.md,
                    createdOnMs: 25,
                    fileName: plan1.md,
                    groupVersionBump: patch,
                    message: plan1 message,
                    relativePath: .nx/version-plans/plan1.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan2.md,
                    createdOnMs: 24,
                    fileName: plan2.md,
                    groupVersionBump: minor,
                    message: plan2 message,
                    relativePath: .nx/version-plans/plan2.md,
                  },
                ],
              },
              {
                name: group2,
                versionPlans: [
                  {
                    absolutePath: <workspace-root>/version-plans/plan3.md,
                    createdOnMs: 26,
                    fileName: plan3.md,
                    groupVersionBump: patch,
                    message: plan3 message,
                    relativePath: .nx/version-plans/plan3.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan2.md,
                    createdOnMs: 24,
                    fileName: plan2.md,
                    groupVersionBump: minor,
                    message: plan2 message,
                    relativePath: .nx/version-plans/plan2.md,
                  },
                ],
              },
              {
                name: group3,
                versionPlans: [
                  {
                    absolutePath: <workspace-root>/version-plans/plan1.md,
                    createdOnMs: 25,
                    fileName: plan1.md,
                    groupVersionBump: major,
                    message: plan1 message,
                    relativePath: .nx/version-plans/plan1.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan2.md,
                    createdOnMs: 24,
                    fileName: plan2.md,
                    groupVersionBump: minor,
                    message: plan2 message,
                    relativePath: .nx/version-plans/plan2.md,
                  },
                ],
              },
              {
                name: group4,
                versionPlans: [
                  {
                    absolutePath: <workspace-root>/version-plans/plan3.md,
                    createdOnMs: 26,
                    fileName: plan3.md,
                    message: plan3 message,
                    projectVersionBumps: {
                      pkg5: premajor,
                    },
                    relativePath: .nx/version-plans/plan3.md,
                  },
                  {
                    absolutePath: <workspace-root>/version-plans/plan1.md,
                    createdOnMs: 25,
                    fileName: plan1.md,
                    message: plan1 message,
                    projectVersionBumps: {
                      pkg4: preminor,
                      pkg5: preminor,
                    },
                    relativePath: .nx/version-plans/plan1.md,
                  },
                ],
              },
              {
                name: group5,
                versionPlans: false,
              },
            ]
          `);
        });
      });
    });
  });

  let createdOnAccumulator = 1;
  function versionPlan({
    name,
    content,
    message,
  }: {
    name: string;
    content: Record<string, string>;
    message: string;
  }): RawVersionPlan {
    return {
      absolutePath: join(tempFs.tempDir, '.nx/version-plans', name),
      relativePath: `.nx/version-plans/${name}`,
      fileName: name,
      createdOnMs: createdOnAccumulator++,
      content,
      message,
    };
  }
});

function releaseGroup(
  group: Partial<ReleaseGroupWithName>
): ReleaseGroupWithName {
  return {
    ...group,
  } as ReleaseGroupWithName;
}

function peelResultFromGroups(releaseGroups: ReleaseGroupWithName[]): {
  name: string;
  versionPlans: ReleaseGroupWithName['versionPlans'];
}[] {
  return releaseGroups.map((g) => ({
    name: g.name,
    versionPlans: g.versionPlans,
  }));
}
