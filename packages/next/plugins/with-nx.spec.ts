import { getAliasForProject } from './with-nx';

describe('getAliasForProject', () => {
  it('should return the matching alias for a project', () => {
    const paths = {
      '@x/proj1': ['packages/proj1'],
      // customized lookup paths with relative path syntax
      '@x/proj2': ['./something-else', './packages/proj2'],
    };

    expect(
      getAliasForProject(
        {
          name: 'proj1',
          type: 'lib',
          data: {
            root: 'packages/proj1',
          },
        },
        paths
      )
    ).toEqual('@x/proj1');

    expect(
      getAliasForProject(
        {
          name: 'proj2',
          type: 'lib',
          data: {
            root: 'packages/proj2', // relative path
          },
        },
        paths
      )
    ).toEqual('@x/proj2');

    expect(
      getAliasForProject(
        {
          name: 'no-alias',
          type: 'lib',
          data: {
            root: 'packages/no-alias',
          },
        },
        paths
      )
    ).toEqual(null);
  });
});
