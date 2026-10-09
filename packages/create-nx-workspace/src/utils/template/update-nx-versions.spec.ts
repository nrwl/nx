import { updateNxVersionsInContent } from './update-nx-versions';

describe('updateNxVersionsInContent', () => {
  it('should update nx and @nx/* versions in devDependencies', () => {
    const content = JSON.stringify(
      {
        name: '@org/source',
        devDependencies: {
          '@nx/js': '23.0.1',
          '@swc/core': '1.15.8',
          nx: '23.0.1',
          typescript: '~6.0.3',
        },
      },
      null,
      2
    );

    const result = JSON.parse(updateNxVersionsInContent(content, '22.7.6'));

    expect(result.devDependencies).toEqual({
      '@nx/js': '22.7.6',
      '@swc/core': '1.15.8',
      nx: '22.7.6',
      typescript: '~6.0.3',
    });
  });

  it('should update nx and @nx/* versions in dependencies', () => {
    const content = JSON.stringify(
      {
        name: '@org/source',
        dependencies: {
          '@nx/devkit': '23.0.1',
          tslib: '^2.3.0',
        },
      },
      null,
      2
    );

    const result = JSON.parse(updateNxVersionsInContent(content, '22.7.6'));

    expect(result.dependencies).toEqual({
      '@nx/devkit': '22.7.6',
      tslib: '^2.3.0',
    });
  });

  it('should not touch packages that merely start with nx', () => {
    const content = JSON.stringify(
      {
        name: '@org/source',
        devDependencies: {
          'nx-cloud': '19.0.0',
          nx: '23.0.1',
        },
      },
      null,
      2
    );

    const result = JSON.parse(updateNxVersionsInContent(content, '22.7.6'));

    expect(result.devDependencies).toEqual({
      'nx-cloud': '19.0.0',
      nx: '22.7.6',
    });
  });

  it('should return original content when versions already match', () => {
    const content = JSON.stringify(
      {
        name: '@org/source',
        devDependencies: {
          '@nx/js': '22.7.6',
          nx: '22.7.6',
        },
      },
      null,
      2
    );

    expect(updateNxVersionsInContent(content, '22.7.6')).toBe(content);
  });

  it('should return original content when there are no dependency sections', () => {
    const content = JSON.stringify({ name: '@org/source' }, null, 2);

    expect(updateNxVersionsInContent(content, '22.7.6')).toBe(content);
  });
});
