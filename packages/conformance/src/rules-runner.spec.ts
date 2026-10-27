import type { FileMapCache } from '@nx/devkit/internal';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the terminal reporter before any other imports
vi.mock('./terminal-reporter', () => ({
  terminalReporter: vi.fn(),
}));

import { createReadOnlyTree } from '../testing';
import { ReadOnlyConformanceTree } from './conformance-tree';
import { conformanceRulesRunner } from './rules-runner';

describe('conformanceRulesRunner', () => {
  const projectGraph = {
    nodes: {},
    dependencies: {},
  };

  const mockFileMapCache: FileMapCache = {
    version: '1.0',
    nxVersion: '20.0.0',
    pathMappings: {},
    nxJsonPlugins: [],
    fileMap: {
      projectFileMap: {},
      nonProjectFiles: [],
    },
  };

  let tree: ReadOnlyConformanceTree;
  let cleanup: () => void;
  let mockRuleImplementation: any;

  beforeEach(async () => {
    ({ tree, cleanup } = await createReadOnlyTree());
    mockRuleImplementation = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
    cleanup();
  });

  it('should return an empty array when no rules are provided', async () => {
    const ruleResults = await conformanceRulesRunner({
      tree,
      projectGraph,
      fileMapCache: mockFileMapCache,
      loadedRules: [],
      applyFixGenerators: false,
    });
    expect(ruleResults).toMatchInlineSnapshot(`
{
  "ruleResults": [],
}
`);
  });

  it(`should invoke loaded rules' implementations with the project graph and respective rule options, and return ruleResults`, async () => {
    const ruleOptions = {
      foo: true,
    };
    const ruleResults = await conformanceRulesRunner({
      tree,
      projectGraph,
      fileMapCache: mockFileMapCache,
      loadedRules: [
        {
          ruleSpecifier: 'test',
          ruleModule: {
            implementation: mockRuleImplementation.mockReturnValue({
              details: {
                violations: [
                  {
                    sourceProject: 'my-project',
                    message: 'A violation',
                  },
                ],
              },
            }),
            name: 'test',
            category: 'consistency',
            description: 'test',
          },
          ruleOptions,
        },
      ],
      applyFixGenerators: false,
    });
    expect(mockRuleImplementation).toHaveBeenCalledWith({
      tree,
      projectGraph,
      fileMapCache: mockFileMapCache,
      ruleOptions,
    });
    expect(ruleResults).toMatchInlineSnapshot(`
      {
        "ruleResults": [
          {
            "details": {
              "violations": [
                {
                  "message": "A violation",
                  "sourceProject": "my-project",
                },
              ],
            },
            "resolvedStatus": "enforced",
            "ruleData": {
              "category": "consistency",
              "description": "test",
              "name": "test",
            },
            "ruleSpecifier": "test",
            "runnerData": {
              "countOfOriginalViolations": 1,
              "countOfViolationsFilteredByProjects": 0,
              "countOfViolationsFixedByGenerator": 0,
              "executionTimeMs": 0,
              "fixGeneratorStatus": "no-fix-generator",
              "scheduledStatus": null,
              "scheduledStatusDate": null,
              "status": "enforced",
            },
          },
        ],
      }
    `);
  });

  describe('status', () => {
    it('should run the rule and set the status on runnerData (and resolvedStatus) to "enforced" when no status is specified', async () => {
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations: [] },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: vi.fn(),
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: false,
      });
      expect(mockRuleImplementation).toHaveBeenCalledWith({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        ruleOptions: {},
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "enforced",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "not-applied",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "enforced",
              },
            },
          ],
        }
      `);
    });

    it('should run the rule and set the status on runnerData (and resolvedStatus) to "evaluated" when that status is specified on the loaded rule', async () => {
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations: [] },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: vi.fn(),
            },
            ruleOptions: {},
            status: 'evaluated',
          },
        ],
        applyFixGenerators: false,
      });
      expect(mockRuleImplementation).toHaveBeenCalledWith({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        ruleOptions: {},
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "evaluated",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "not-applied",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "evaluated",
              },
            },
          ],
        }
      `);
    });

    it('should not run the rule and set the status on runnerData to "disabled" (and resolvedStatus) when that status is specified on the loaded rule, as well as set the severity to null', async () => {
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations: [] },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: vi.fn(),
            },
            ruleOptions: {},
            status: 'disabled',
          },
        ],
        applyFixGenerators: false,
      });
      expect(mockRuleImplementation).not.toHaveBeenCalled();
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "disabled",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "not-applied",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "disabled",
              },
              "severity": null,
            },
          ],
        }
      `);
    });
  });

  describe('scheduledStatus', () => {
    it('should set resolvedStatus to the original status when scheduledStatusDate is in the future', async () => {
      const dateInTheFuture = new Date('2099-01-01T00:00:00.000Z').getTime();
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations: [] },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: vi.fn(),
            },
            ruleOptions: {},
            status: 'evaluated', // should be the resolvedStatus
            scheduledStatusDate: dateInTheFuture,
            scheduledStatus: 'enforced', // should not be used
          },
        ],
        applyFixGenerators: false,
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "evaluated",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "not-applied",
                "scheduledStatus": "enforced",
                "scheduledStatusDate": 4070908800000,
                "status": "evaluated",
              },
            },
          ],
        }
      `);
    });

    it('should set resolvedStatus to the scheduledStatus when scheduledStatusDate is in the past', async () => {
      const dateInThePast = new Date('2024-01-01T00:00:00.000Z').getTime();
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations: [] },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: vi.fn(),
            },
            ruleOptions: {},
            status: 'evaluated', // should not be used for the resolvedStatus
            scheduledStatusDate: dateInThePast,
            scheduledStatus: 'enforced', // should be the resolvedStatus
          },
        ],
        applyFixGenerators: false,
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "enforced",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "not-applied",
                "scheduledStatus": "enforced",
                "scheduledStatusDate": 1704067200000,
                "status": "evaluated",
              },
            },
          ],
        }
      `);
    });
  });

  describe('fix generators', () => {
    it('should set fixGeneratorStatus to "no-fix-generator" when a fix generator does not exist', async () => {
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations: [] },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: false,
      });
      expect(mockRuleImplementation).toHaveBeenCalledWith({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        ruleOptions: {},
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "enforced",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "no-fix-generator",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "enforced",
              },
            },
          ],
        }
      `);
    });

    it('should set fixGeneratorStatus to "not-applied" when a fix generator exists but is not applied', async () => {
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations: [] },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: vi.fn(),
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: false,
      });
      expect(mockRuleImplementation).toHaveBeenCalledWith({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        ruleOptions: {},
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "enforced",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "not-applied",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "enforced",
              },
            },
          ],
        }
      `);
    });

    it('should set fixGeneratorStatus to "applied" when a fix generator exists and has been applied', async () => {
      const mockFixGenerator = vi.fn();
      const violations = [
        {
          sourceProject: 'my-project',
          message: 'A violation',
        },
      ];
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: mockFixGenerator,
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: true,
      });
      expect(mockRuleImplementation).toHaveBeenCalledWith({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        ruleOptions: {},
      });
      expect(mockFixGenerator).toHaveBeenCalledWith(expect.any(Object), {
        violations,
        ruleOptions: {},
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [
                  {
                    "message": "A violation",
                    "sourceProject": "my-project",
                  },
                ],
              },
              "resolvedStatus": "enforced",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 1,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "applied",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "enforced",
              },
            },
          ],
        }
      `);
    });
  });

  describe('fixGeneratorData', () => {
    it('should pass fixGeneratorData from the details object through to the fix generator, but strip it before the report is generated', async () => {
      const fixGeneratorData = {
        foo: 'bar',
      };
      const mockFixGenerator = vi.fn();
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: {
                  violations: [],
                  fixGeneratorData,
                },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: mockFixGenerator,
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: true,
      });
      expect(mockFixGenerator).toHaveBeenCalledWith(expect.any(Object), {
        violations: [],
        ruleOptions: {},
        fixGeneratorData,
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [],
              },
              "resolvedStatus": "enforced",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 0,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "applied",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "enforced",
              },
            },
          ],
        }
      `);
    });

    it('should make fixGeneratorData on violations available to the fix generator, but strip it before the report is generated', async () => {
      const fixGeneratorData = {
        foo: 'bar',
      };
      const violations = [
        {
          message: 'A violation',
          sourceProject: 'my-project',
          fixGeneratorData,
        },
      ];
      const mockFixGenerator = vi.fn();
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: { violations },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
              fixGenerator: mockFixGenerator,
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: true,
      });
      expect(mockFixGenerator).toHaveBeenCalledWith(expect.any(Object), {
        violations,
        ruleOptions: {},
      });
      expect(ruleResults).toMatchInlineSnapshot(`
        {
          "ruleResults": [
            {
              "details": {
                "violations": [
                  {
                    "message": "A violation",
                    "sourceProject": "my-project",
                  },
                ],
              },
              "resolvedStatus": "enforced",
              "ruleData": {
                "category": "consistency",
                "description": "test",
                "name": "test",
              },
              "ruleSpecifier": "test",
              "runnerData": {
                "countOfOriginalViolations": 1,
                "countOfViolationsFilteredByProjects": 0,
                "countOfViolationsFixedByGenerator": 0,
                "executionTimeMs": 0,
                "fixGeneratorStatus": "applied",
                "scheduledStatus": null,
                "scheduledStatusDate": null,
                "status": "enforced",
              },
            },
          ],
        }
      `);
    });
  });

  describe('workspace violations validation', () => {
    it('should throw an error when a violation has neither sourceProject nor file and workspaceViolation is not true', async () => {
      await expect(
        conformanceRulesRunner({
          tree,
          projectGraph,
          fileMapCache: mockFileMapCache,
          loadedRules: [
            {
              ruleSpecifier: 'test',
              ruleModule: {
                implementation: mockRuleImplementation.mockReturnValue({
                  details: {
                    violations: [
                      {
                        message: 'Invalid violation without proper flags',
                        // Missing both sourceProject, file, and workspaceViolation: true
                      },
                    ],
                  },
                }),
                name: 'test',
                category: 'consistency',
                description: 'test',
              },
              ruleOptions: {},
            },
          ],
          applyFixGenerators: false,
        })
      ).rejects.toThrow(
        `Invalid violation at index 0 in rule "test": Violations with neither 'sourceProject' nor 'file' must have 'workspaceViolation: true'. Violation message: "Invalid violation without proper flags"`
      );
    });

    it('should allow violations without sourceProject and file when workspaceViolation is true', async () => {
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: {
                  violations: [
                    {
                      message: 'Valid workspace violation',
                      workspaceViolation: true,
                    },
                  ],
                },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: false,
      });

      expect(ruleResults.ruleResults[0].details.violations)
        .toMatchInlineSnapshot(`
[
  {
    "message": "Valid workspace violation",
    "workspaceViolation": true,
  },
]
`);
    });

    it('should allow violations with either sourceProject or file even without workspaceViolation', async () => {
      const ruleResults = await conformanceRulesRunner({
        tree,
        projectGraph,
        fileMapCache: mockFileMapCache,
        loadedRules: [
          {
            ruleSpecifier: 'test',
            ruleModule: {
              implementation: mockRuleImplementation.mockReturnValue({
                details: {
                  violations: [
                    {
                      message: 'Valid project violation',
                      sourceProject: 'my-project',
                    },
                    {
                      message: 'Valid file violation',
                      file: 'some-file.ts',
                    },
                  ],
                },
              }),
              name: 'test',
              category: 'consistency',
              description: 'test',
            },
            ruleOptions: {},
          },
        ],
        applyFixGenerators: false,
      });

      expect(ruleResults.ruleResults[0].details.violations)
        .toMatchInlineSnapshot(`
[
  {
    "message": "Valid project violation",
    "sourceProject": "my-project",
  },
  {
    "file": "some-file.ts",
    "message": "Valid file violation",
  },
]
`);
    });
  });
});
