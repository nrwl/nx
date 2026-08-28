import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

describe('nx release - tag project selection', () => {
  let apiPackage1: string;
  let apiPackage2: string;
  let otherPackage: string;

  beforeAll(() => {
    newProject({ packages: ['@nx/js'] });

    apiPackage1 = uniq('api-package-1');
    apiPackage2 = uniq('api-package-2');
    otherPackage = uniq('other-package');

    for (const project of [apiPackage1, apiPackage2, otherPackage]) {
      runCLI(`generate @nx/workspace:npm-package ${project}`);
      updateJson(`${project}/project.json`, (projectJson) => ({
        ...projectJson,
        tags: [project === otherPackage ? 'type:other' : 'type:api'],
      }));
    }

    updateJson('nx.json', () => ({
      release: {
        projectsRelationship: 'independent',
      },
    }));
  });

  afterAll(() => cleanupProject());

  it('versions every project matching the tag selector and excludes other projects', () => {
    const output = runCLI(
      'release 1.2.3 --projects=tag:type:api --dry-run --skip-publish'
    );

    expect(output).toContain(`- ${apiPackage1}`);
    expect(output).toContain(`- ${apiPackage2}`);
    expect(output).toContain(
      `NX   Running release version for project: ${apiPackage1}`
    );
    expect(output).toContain(
      `NX   Running release version for project: ${apiPackage2}`
    );
    expect(output).not.toContain(
      `NX   Running release version for project: ${otherPackage}`
    );
  });
});
