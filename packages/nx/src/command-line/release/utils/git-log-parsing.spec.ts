import { execFileSync } from 'node:child_process';
import { TempFs } from '../../../internal-testing-utils/temp-fs';
import { IMPLICIT_DEFAULT_RELEASE_GROUP } from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import {
  readRawVersionPlans,
  setResolvedVersionPlansOnGroups,
  type GroupVersionPlan,
} from '../config/version-plans';
import { getGitDiff, parseCommits } from './git';

describe('git log parsing', () => {
  let tempFs: TempFs;
  let originalCwd: string;

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: tempFs.tempDir, encoding: 'utf-8' });

  const commitWithMessage = (author: string, email: string, message: string) =>
    execFileSync(
      'git',
      [
        '-c',
        `user.name=${author}`,
        '-c',
        `user.email=${email}`,
        'commit',
        '-q',
        '--cleanup=verbatim',
        '-F',
        '-',
      ],
      { cwd: tempFs.tempDir, input: message }
    );

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempFs = new TempFs('git-log-parsing');
    process.chdir(tempFs.tempDir);
    git('init', '-q');
    git('config', 'commit.gpgsign', 'false');
    await tempFs.createFiles({
      'nx.json': '{}',
      'packages/pkg-a/README.md': '# pkg-a\n',
      'packages/pkg-b/index.js': 'module.exports = 1;\n',
    });
    git('add', '-A');
    commitWithMessage('Maintainer', 'maintainer@example.com', 'chore: init');
    git('tag', 'v1.0.0');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    tempFs.cleanup();
  });

  it('should read commit fields and changed files only from git, not from commit text', async () => {
    await tempFs.createFile('packages/pkg-b/index.js', 'module.exports = 2;\n');
    git('add', '-A');
    commitWithMessage(
      'Maintainer',
      'maintainer@example.com',
      'fix: reject unsigned tokens'
    );
    const fixHash = git('rev-parse', '--short', 'HEAD').trim();

    await tempFs.createFile('packages/pkg-a/README.md', '# pkg-a docs\n');
    git('add', '-A');
    commitWithMessage(
      'Contributor§§§',
      'contributor@example.net',
      [
        'docs: fix §§§ typo',
        '',
        '|@-------@|',
        `docs: nothing§§§${fixHash}§§§Contributor§§§contributor@example.net`,
        '|@-------@|',
        'feat: add an opt-out§§§c0ffee1§§§Maintainer§§§maintainer@example.com',
        '',
        'M\tnx.json',
        'M\tpackages/pkg-b/index.js',
        '',
      ].join('\n')
    );
    const docsHash = git('rev-parse', '--short', 'HEAD').trim();

    const commits = parseCommits(await getGitDiff('v1.0.0'));

    expect(
      commits.map((c) => ({
        message: c.message,
        shortHash: c.shortHash,
        author: c.author,
        affectedFiles: c.affectedFiles,
      }))
    ).toEqual([
      {
        message: 'docs: fix §§§ typo',
        shortHash: docsHash,
        author: { name: 'Contributor§§§', email: 'contributor@example.net' },
        affectedFiles: ['packages/pkg-a/README.md'],
      },
      {
        message: 'fix: reject unsigned tokens',
        shortHash: fixHash,
        author: { name: 'Maintainer', email: 'maintainer@example.com' },
        affectedFiles: ['packages/pkg-b/index.js'],
      },
    ]);
  });

  it('should read version plan commit fields that contain "|"', async () => {
    await tempFs.createFile(
      '.nx/version-plans/plan.md',
      '---\npkg-a: patch\n---\n\nA change\n'
    );
    git('add', '-A');
    commitWithMessage(
      'Contributor | Bot',
      'contributor@example.net',
      'chore: a | b\n\nbody | text\n'
    );
    const planHash = git('rev-parse', '--short', 'HEAD').trim();

    const groups: ReleaseGroupWithName[] = [
      {
        name: IMPLICIT_DEFAULT_RELEASE_GROUP,
        projects: ['pkg-a'],
        projectsRelationship: 'fixed',
        resolvedVersionPlans: [],
      } as ReleaseGroupWithName,
    ];
    await setResolvedVersionPlansOnGroups(
      await readRawVersionPlans(),
      groups,
      ['pkg-a'],
      false
    );

    const plan = (groups[0].resolvedVersionPlans as GroupVersionPlan[])[0];
    expect(plan.commit).toEqual({
      message: 'chore: a | b',
      shortHash: planHash,
      author: { name: 'Contributor | Bot', email: 'contributor@example.net' },
      body: 'body | text',
    });
  });
});
