import { getPackageName, updateDependenciesInNxJson } from './nx-installation';

describe('nx managed installation utils', () => {
  describe('get package name', () => {
    it.each([
      ['plugin', 'plugin'],
      ['plugin/other', 'plugin'],
      ['@scope/plugin', '@scope/plugin'],
      ['@scope/plugin/other', '@scope/plugin'],
    ])('should read package name for %s: %s', (input, expected) => {
      expect(getPackageName(input)).toEqual(expected);
    });
  });

  describe('updateDependenciesInNxJson', () => {
    it('should handle legacy nx json dependencies', async () => {
      const updated = await updateDependenciesInNxJson(
        {
          installation: {
            version: '1.0.0',
            plugins: {
              plugin: '1.0.0',
            },
          },
        },
        {
          plugin: { version: '2.0.0' },
        }
      );

      expect(updated).toEqual({
        installation: {
          version: '1.0.0',
          plugins: {
            plugin: '2.0.0',
          },
        },
      });
    });

    it('should update plugin versions in plugins array', async () => {
      const updated = await updateDependenciesInNxJson(
        {
          installation: {
            version: '1.0.0',
          },
          plugins: [{ plugin: 'plugin', version: '1.0.0' }],
        },
        {
          plugin: { version: '2.0.0' },
        }
      );

      expect(updated).toEqual({
        installation: {
          version: '1.0.0',
        },
        plugins: [{ plugin: 'plugin', version: '2.0.0' }],
      });
    });

    it('should update plugin versions in plugins array and installation.plugins', async () => {
      const updated = await updateDependenciesInNxJson(
        {
          installation: {
            version: '1.0.0',
            plugins: {
              plugin: '1.0.0',
            },
          },
          plugins: [{ plugin: 'other', version: '1.0.0' }],
        },
        {
          plugin: { version: '2.0.0' },
          other: { version: '2.0.1' },
        }
      );

      expect(updated).toEqual({
        installation: {
          version: '1.0.0',
          plugins: {
            plugin: '2.0.0',
          },
        },
        plugins: [{ plugin: 'other', version: '2.0.1' }],
      });
    });
  });
});
