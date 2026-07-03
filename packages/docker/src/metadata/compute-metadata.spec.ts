import { computeContainerMetadata } from './compute-metadata';
import * as gitContext from './git-context';

jest.mock('./git-context');

const mockedGitContext = gitContext as jest.Mocked<typeof gitContext>;

describe('computeContainerMetadata', () => {
  beforeEach(() => {
    mockedGitContext.getGitRefContext.mockReturnValue({
      ref: 'refs/heads/main',
      sha: 'abcdef1234567890',
      isDefaultBranch: true,
      eventName: '',
    });
    mockedGitContext.getRepoContext.mockReturnValue({
      name: 'app',
      description: 'An app',
      url: 'https://github.com/org/app',
      defaultBranch: 'main',
      license: 'MIT',
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('resolves tags/labels/annotations from images + default tag rules on a branch build', () => {
    const result = computeContainerMetadata({
      options: {
        images: ['app'],
        tags: [],
        flavor: [],
        labels: [],
        annotations: [],
      },
      projectRoot: 'apps/app',
      workspaceRoot: '/workspace',
    });

    expect(result.version.main).toEqual('main');
    expect(result.tags).toEqual(['app:main']);
    expect(result.labels).toContain('org.opencontainers.image.title=app');
    expect(result.annotations).toContain('org.opencontainers.image.title=app');
  });

  it('produces no tags when no rule matches (e.g. detached HEAD)', () => {
    mockedGitContext.getGitRefContext.mockReturnValue({
      ref: '',
      sha: 'abcdef1234567890',
      isDefaultBranch: false,
      eventName: '',
    });

    const result = computeContainerMetadata({
      options: {
        images: ['app'],
        tags: [],
        flavor: [],
        labels: [],
        annotations: [],
      },
      projectRoot: 'apps/app',
      workspaceRoot: '/workspace',
    });

    expect(result.tags).toEqual([]);
  });

  it('applies custom tag rules and flavor', () => {
    mockedGitContext.getGitRefContext.mockReturnValue({
      ref: 'refs/tags/v1.2.3',
      sha: 'abcdef1234567890',
      isDefaultBranch: false,
      eventName: '',
    });

    const result = computeContainerMetadata({
      options: {
        images: ['app'],
        tags: ['type=semver,pattern={{version}}'],
        flavor: [],
        labels: [],
        annotations: [],
      },
      projectRoot: 'apps/app',
      workspaceRoot: '/workspace',
    });

    expect(result.tags).toEqual(['app:1.2.3', 'app:latest']);
  });
});
