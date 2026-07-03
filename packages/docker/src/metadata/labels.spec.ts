import { buildAnnotations, buildOciLabels } from './labels';
import { RepoContext, ResolvedVersion } from './types';

const repo: RepoContext = {
  name: 'app',
  description: 'An app',
  url: 'https://github.com/org/app',
  defaultBranch: 'main',
  license: 'MIT',
};

const version: ResolvedVersion = { main: '1.2.3', partial: [], latest: true };
const now = new Date(Date.UTC(2024, 0, 1));

describe('buildOciLabels', () => {
  it('builds the default OCI labels sorted by key', () => {
    const labels = buildOciLabels(repo, version, 'abc123', now, []);
    expect(labels).toEqual([
      'org.opencontainers.image.created=2024-01-01T00:00:00.000Z',
      'org.opencontainers.image.description=An app',
      'org.opencontainers.image.licenses=MIT',
      'org.opencontainers.image.revision=abc123',
      'org.opencontainers.image.source=https://github.com/org/app',
      'org.opencontainers.image.title=app',
      'org.opencontainers.image.url=https://github.com/org/app',
      'org.opencontainers.image.version=1.2.3',
    ]);
  });

  it('renders empty fields as key= when repo context is missing data', () => {
    const emptyRepo: RepoContext = {
      name: '',
      description: '',
      url: '',
      defaultBranch: '',
      license: undefined,
    };
    const labels = buildOciLabels(
      emptyRepo,
      { main: undefined, partial: [], latest: false },
      undefined,
      now,
      []
    );
    expect(labels).toContain('org.opencontainers.image.title=');
  });

  it('lets a custom label override a default on key collision', () => {
    const labels = buildOciLabels(repo, version, 'abc123', now, [
      'org.opencontainers.image.title=custom-title',
    ]);
    expect(labels).toContain('org.opencontainers.image.title=custom-title');
  });

  it('includes custom labels not present in the defaults', () => {
    const labels = buildOciLabels(repo, version, 'abc123', now, [
      'maintainer=someone',
    ]);
    expect(labels).toContain('maintainer=someone');
  });
});

describe('buildAnnotations', () => {
  it('mirrors buildOciLabels', () => {
    expect(buildAnnotations(repo, version, 'abc123', now, [])).toEqual(
      buildOciLabels(repo, version, 'abc123', now, [])
    );
  });
});
