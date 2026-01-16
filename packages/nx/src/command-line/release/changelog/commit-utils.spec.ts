import { GitCommit } from '../utils/git';
import { FileData, ProjectFileMap } from '../../../config/project-graph';
import {
  mapCommitToChange,
  createChangesFromCommits,
  filterHiddenChanges,
  getProjectsAffectedByCommit,
  commitChangesNonProjectFiles,
  createFileToProjectMap,
} from './commit-utils';
import { NxReleaseConfig } from '../config/config';
import { ChangelogChange } from './version-plan-utils';

describe('commit-utils', () => {
  describe('mapCommitToChange', () => {
    it('should map a GitCommit to a ChangelogChange', () => {
      const commit: GitCommit = {
        type: 'fix',
        scope: 'core',
        description: 'Fix critical bug',
        body: 'This fixes a critical bug in the core module',
        isBreaking: false,
        references: [{ value: '123', type: 'issue' }],
        authors: [{ name: 'John Doe', email: 'john@example.com' }],
        shortHash: 'abc123',
        revertedHashes: [],
        message: 'fix(core): Fix critical bug',
        author: { name: 'John Doe', email: 'john@example.com' },
        affectedFiles: ['src/core/index.ts'],
      };

      const result = mapCommitToChange(commit, ['project1', 'project2']);

      expect(result).toEqual({
        type: 'fix',
        scope: 'core',
        description: 'Fix critical bug',
        body: 'This fixes a critical bug in the core module',
        isBreaking: false,
        githubReferences: [{ value: '123', type: 'issue' }],
        authors: [{ name: 'John Doe', email: 'john@example.com' }],
        shortHash: 'abc123',
        revertedHashes: [],
        affectedProjects: ['project1', 'project2'],
      });
    });

    it('should handle commits affecting all projects', () => {
      const commit: GitCommit = {
        type: 'chore',
        scope: '',
        description: 'Update dependencies',
        body: '',
        isBreaking: false,
        references: [],
        authors: [{ name: 'Jane Doe', email: 'jane@example.com' }],
        shortHash: 'def456',
        revertedHashes: [],
        message: 'chore: Update dependencies',
        author: { name: 'Jane Doe', email: 'jane@example.com' },
        affectedFiles: ['package.json'],
      };

      const result = mapCommitToChange(commit, '*');

      expect(result.affectedProjects).toBe('*');
    });
  });

  describe('filterHiddenChanges', () => {
    const conventionalCommitsConfig: NxReleaseConfig['conventionalCommits'] = {
      useCommitScope: true,
      types: {
        fix: {
          semverBump: 'patch',
          changelog: { title: 'Bug Fixes', hidden: false },
        },
        feat: {
          semverBump: 'minor',
          changelog: { title: 'Features', hidden: false },
        },
        chore: {
          semverBump: 'none',
          changelog: { title: 'Chores', hidden: true },
        },
        docs: {
          semverBump: 'none',
          changelog: { title: 'Documentation', hidden: true },
        },
      },
    };

    it('should filter out hidden change types', () => {
      const changes: ChangelogChange[] = [
        {
          type: 'fix',
          scope: '',
          description: 'Fix bug',
          affectedProjects: '*',
        },
        {
          type: 'feat',
          scope: '',
          description: 'Add feature',
          affectedProjects: '*',
        },
        {
          type: 'chore',
          scope: '',
          description: 'Update deps',
          affectedProjects: '*',
        },
        {
          type: 'docs',
          scope: '',
          description: 'Update docs',
          affectedProjects: '*',
        },
      ];

      const result = filterHiddenChanges(changes, conventionalCommitsConfig);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('fix');
      expect(result[1].type).toBe('feat');
    });

    it('should filter out changes with unknown types', () => {
      const changes: ChangelogChange[] = [
        {
          type: 'fix',
          scope: '',
          description: 'Fix bug',
          affectedProjects: '*',
        },
        {
          type: 'unknown',
          scope: '',
          description: 'Unknown change',
          affectedProjects: '*',
        },
      ];

      const result = filterHiddenChanges(changes, conventionalCommitsConfig);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('fix');
    });
  });

  describe('getProjectsAffectedByCommit', () => {
    it('should return projects affected by commit', () => {
      const commit: GitCommit = {
        type: 'fix',
        scope: '',
        description: 'Fix bug',
        body: '',
        isBreaking: false,
        references: [],
        authors: [],
        shortHash: 'abc123',
        revertedHashes: [],
        message: 'fix: Fix bug',
        author: { name: 'Test', email: 'test@example.com' },
        affectedFiles: [
          'packages/project1/src/index.ts',
          'packages/project1/README.md',
          'packages/project2/src/main.ts',
        ],
      };

      const fileToProjectMap = {
        'packages/project1/src/index.ts': 'project1',
        'packages/project1/README.md': 'project1',
        'packages/project2/src/main.ts': 'project2',
        'packages/project3/src/index.ts': 'project3',
      };

      const result = getProjectsAffectedByCommit(commit, fileToProjectMap);

      expect(result).toEqual(['project1', 'project2']);
    });

    it('should return empty array when no projects are affected', () => {
      const commit: GitCommit = {
        type: 'chore',
        scope: '',
        description: 'Update root config',
        body: '',
        isBreaking: false,
        references: [],
        authors: [],
        shortHash: 'def456',
        revertedHashes: [],
        message: 'chore: Update root config',
        author: { name: 'Test', email: 'test@example.com' },
        affectedFiles: ['README.md'],
      };

      const fileToProjectMap = {
        'packages/project1/src/index.ts': 'project1',
        'packages/project2/src/main.ts': 'project2',
      };

      const result = getProjectsAffectedByCommit(commit, fileToProjectMap);

      expect(result).toEqual([]);
    });

    it('should handle duplicate projects (multiple files from same project)', () => {
      const commit: GitCommit = {
        type: 'refactor',
        scope: '',
        description: 'Refactor project1',
        body: '',
        isBreaking: false,
        references: [],
        authors: [],
        shortHash: 'ghi789',
        revertedHashes: [],
        message: 'refactor: Refactor project1',
        author: { name: 'Test', email: 'test@example.com' },
        affectedFiles: [
          'packages/project1/src/index.ts',
          'packages/project1/src/utils.ts',
          'packages/project1/src/types.ts',
        ],
      };

      const fileToProjectMap = {
        'packages/project1/src/index.ts': 'project1',
        'packages/project1/src/utils.ts': 'project1',
        'packages/project1/src/types.ts': 'project1',
      };

      const result = getProjectsAffectedByCommit(commit, fileToProjectMap);

      expect(result).toEqual(['project1']);
    });
  });

  describe('commitChangesNonProjectFiles', () => {
    const nonProjectFiles: FileData[] = [
      { file: 'nx.json', hash: 'hash1' },
      { file: 'package.json', hash: 'hash2' },
      { file: 'README.md', hash: 'hash3' },
    ];

    it('should return true when commit affects non-project files', () => {
      const commit: GitCommit = {
        type: 'chore',
        scope: '',
        description: 'Update workspace config',
        body: '',
        isBreaking: false,
        references: [],
        authors: [],
        shortHash: 'abc123',
        revertedHashes: [],
        message: 'chore: Update workspace config',
        author: { name: 'Test', email: 'test@example.com' },
        affectedFiles: ['nx.json', 'packages/project1/src/index.ts'],
      };

      const result = commitChangesNonProjectFiles(commit, nonProjectFiles);

      expect(result).toBe(true);
    });

    it('should return false when commit only affects project files', () => {
      const commit: GitCommit = {
        type: 'feat',
        scope: '',
        description: 'Add feature to project',
        body: '',
        isBreaking: false,
        references: [],
        authors: [],
        shortHash: 'def456',
        revertedHashes: [],
        message: 'feat: Add feature to project',
        author: { name: 'Test', email: 'test@example.com' },
        affectedFiles: [
          'packages/project1/src/index.ts',
          'packages/project2/src/main.ts',
        ],
      };

      const result = commitChangesNonProjectFiles(commit, nonProjectFiles);

      expect(result).toBe(false);
    });
  });

  describe('createFileToProjectMap', () => {
    it('should create a map from file paths to project names', () => {
      const projectFileMap: ProjectFileMap = {
        project1: [
          { file: 'packages/project1/src/index.ts', hash: 'hash1' },
          { file: 'packages/project1/src/utils.ts', hash: 'hash2' },
        ],
        project2: [
          { file: 'packages/project2/src/main.ts', hash: 'hash3' },
          { file: 'packages/project2/README.md', hash: 'hash4' },
        ],
      };

      const result = createFileToProjectMap(projectFileMap);

      expect(result).toEqual({
        'packages/project1/src/index.ts': 'project1',
        'packages/project1/src/utils.ts': 'project1',
        'packages/project2/src/main.ts': 'project2',
        'packages/project2/README.md': 'project2',
      });
    });

    it('should handle empty project file map', () => {
      const projectFileMap: ProjectFileMap = {};

      const result = createFileToProjectMap(projectFileMap);

      expect(result).toEqual({});
    });
  });

  describe('createChangesFromCommits', () => {
    it('should create changes from commits with project mapping', () => {
      const commits: GitCommit[] = [
        {
          type: 'fix',
          scope: 'core',
          description: 'Fix bug in project1',
          body: '',
          isBreaking: false,
          references: [],
          authors: [],
          shortHash: 'abc123',
          revertedHashes: [],
          message: 'fix(core): Fix bug in project1',
          author: { name: 'Test', email: 'test@example.com' },
          affectedFiles: ['packages/project1/src/index.ts'],
        },
        {
          type: 'feat',
          scope: '',
          description: 'Add feature to workspace',
          body: '',
          isBreaking: false,
          references: [],
          authors: [],
          shortHash: 'def456',
          revertedHashes: [],
          message: 'feat: Add feature to workspace',
          author: { name: 'Test', email: 'test@example.com' },
          affectedFiles: ['nx.json'],
        },
      ];

      const fileMap = {
        projectFileMap: {
          project1: [{ file: 'packages/project1/src/index.ts', hash: 'hash1' }],
        } as ProjectFileMap,
        nonProjectFiles: [{ file: 'nx.json', hash: 'hash2' }],
      };

      const fileToProjectMap = {
        'packages/project1/src/index.ts': 'project1',
      };

      const conventionalCommitsConfig: NxReleaseConfig['conventionalCommits'] =
        {
          useCommitScope: true,
          types: {
            fix: {
              semverBump: 'patch',
              changelog: { title: 'Bug Fixes', hidden: false },
            },
            feat: {
              semverBump: 'minor',
              changelog: { title: 'Features', hidden: false },
            },
          },
        };

      const result = createChangesFromCommits(
        commits,
        fileMap,
        fileToProjectMap,
        conventionalCommitsConfig
      );

      expect(result).toHaveLength(2);
      expect(result[0].affectedProjects).toEqual(['project1']);
      expect(result[1].affectedProjects).toBe('*');
    });
  });
});
