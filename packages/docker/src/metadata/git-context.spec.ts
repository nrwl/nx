import { readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';
import * as gitUtils from 'nx/src/utils/git-utils';
import { getGitRefContext, getRepoContext } from './git-context';

jest.mock('nx/src/utils/git-utils');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  readJsonFile: jest.fn(),
}));

const mockedGitUtils = gitUtils as jest.Mocked<typeof gitUtils>;
const mockedExistsSync = existsSync as jest.Mock;
const mockedReadJsonFile = readJsonFile as jest.Mock;

describe('getGitRefContext', () => {
  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.NX_DOCKER_REF;
    delete process.env.NX_DOCKER_METADATA_EVENT;
  });

  it('builds a branch ref from local git state', () => {
    mockedGitUtils.getCurrentTagName.mockReturnValue(null);
    mockedGitUtils.getCurrentBranchName.mockReturnValue('feature-x');
    mockedGitUtils.getLatestCommitSha.mockReturnValue('abc123');
    mockedGitUtils.getDefaultBranchName.mockReturnValue('main');

    expect(getGitRefContext()).toEqual({
      ref: 'refs/heads/feature-x',
      sha: 'abc123',
      isDefaultBranch: false,
      eventName: '',
    });
  });

  it('prefers a tag ref over a branch when HEAD is tagged', () => {
    mockedGitUtils.getCurrentTagName.mockReturnValue('v1.0.0');
    mockedGitUtils.getCurrentBranchName.mockReturnValue(null);
    mockedGitUtils.getLatestCommitSha.mockReturnValue('abc123');
    mockedGitUtils.getDefaultBranchName.mockReturnValue('main');

    expect(getGitRefContext().ref).toEqual('refs/tags/v1.0.0');
  });

  it('marks isDefaultBranch true when current branch matches the default', () => {
    mockedGitUtils.getCurrentTagName.mockReturnValue(null);
    mockedGitUtils.getCurrentBranchName.mockReturnValue('main');
    mockedGitUtils.getLatestCommitSha.mockReturnValue('abc123');
    mockedGitUtils.getDefaultBranchName.mockReturnValue('main');

    expect(getGitRefContext().isDefaultBranch).toBe(true);
  });

  it('resolves to an empty ref on a detached, untagged HEAD', () => {
    mockedGitUtils.getCurrentTagName.mockReturnValue(null);
    mockedGitUtils.getCurrentBranchName.mockReturnValue(null);
    mockedGitUtils.getLatestCommitSha.mockReturnValue('abc123');
    mockedGitUtils.getDefaultBranchName.mockReturnValue(null);

    expect(getGitRefContext()).toEqual({
      ref: '',
      sha: 'abc123',
      isDefaultBranch: false,
      eventName: '',
    });
  });

  it('honors the NX_DOCKER_REF override for CI PR-merge checkouts', () => {
    process.env.NX_DOCKER_REF = 'refs/pull/42/merge';
    mockedGitUtils.getCurrentTagName.mockReturnValue(null);
    mockedGitUtils.getCurrentBranchName.mockReturnValue(null);
    mockedGitUtils.getLatestCommitSha.mockReturnValue('abc123');
    mockedGitUtils.getDefaultBranchName.mockReturnValue(null);

    expect(getGitRefContext().ref).toEqual('refs/pull/42/merge');
  });

  it('honors the NX_DOCKER_METADATA_EVENT override for the schedule tag gate', () => {
    process.env.NX_DOCKER_METADATA_EVENT = 'schedule';
    mockedGitUtils.getCurrentTagName.mockReturnValue(null);
    mockedGitUtils.getCurrentBranchName.mockReturnValue('main');
    mockedGitUtils.getLatestCommitSha.mockReturnValue('abc123');
    mockedGitUtils.getDefaultBranchName.mockReturnValue('main');

    expect(getGitRefContext().eventName).toEqual('schedule');
  });
});

describe('getRepoContext', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('reads name/description/license from package.json', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadJsonFile.mockReturnValue({
      name: 'app',
      description: 'An app',
      license: 'MIT',
    });
    mockedGitUtils.getVcsRemoteInfo.mockReturnValue({
      domain: 'github.com',
      slug: 'org/app',
    });
    mockedGitUtils.getDefaultBranchName.mockReturnValue('main');

    expect(getRepoContext('apps/app', '/workspace')).toEqual({
      name: 'app',
      description: 'An app',
      url: 'https://github.com/org/app',
      defaultBranch: 'main',
      license: 'MIT',
    });
  });

  it('falls back to project.json name when package.json is absent', () => {
    mockedExistsSync.mockImplementation((path: string) =>
      path.endsWith('project.json')
    );
    mockedReadJsonFile.mockReturnValue({ name: 'app-from-project-json' });
    mockedGitUtils.getVcsRemoteInfo.mockReturnValue(null);
    mockedGitUtils.getDefaultBranchName.mockReturnValue(null);

    expect(getRepoContext('apps/app', '/workspace')).toEqual({
      name: 'app-from-project-json',
      description: '',
      url: '',
      defaultBranch: '',
      license: undefined,
    });
  });

  it('returns empty defaults when neither file exists and there is no remote', () => {
    mockedExistsSync.mockReturnValue(false);
    mockedGitUtils.getVcsRemoteInfo.mockReturnValue(null);
    mockedGitUtils.getDefaultBranchName.mockReturnValue(null);

    expect(getRepoContext('apps/app', '/workspace')).toEqual({
      name: '',
      description: '',
      url: '',
      defaultBranch: '',
      license: undefined,
    });
  });
});
