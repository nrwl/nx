import { inlineProjectConfigurations } from './workspace';
import { readJsonFile } from '../utils/fileutils';

jest.mock('../utils/fileutils');

const libConfig = (name) => ({
  root: `libs/${name}`,
  sourceRoot: `libs/${name}/src`,
  targets: {},
});

describe('workspace', () => {
  it('should be able to inline project configurations', () => {
    const standaloneConfig = libConfig('lib1');

    (readJsonFile as jest.Mock).mockImplementation((path: string) => {
      if (path.endsWith('libs/lib1/project.json')) {
        return standaloneConfig;
      }
      throw `${path} not in mock!`;
    });

    const inlineConfig = {
      version: 1,
      projects: {
        lib1: 'libs/lib1',
        lib2: libConfig('lib2'),
      },
    };

    const resolved = inlineProjectConfigurations(inlineConfig);
    expect(resolved).toEqual({
      ...inlineConfig,
      projects: {
        ...inlineConfig.projects,
        lib1: { ...standaloneConfig },
      },
    });
  });
});
