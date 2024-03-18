import {
  getHelperDependency,
  HelperDependency,
} from './compiler-helper-dependency';
import { join } from 'path';

describe('getHelperDependency', () => {
  it('should support pnpm external nodes where the name is suffixed with the version', () => {
    const helperDependency = HelperDependency.tsc;
    const configPath = join(__dirname, 'test-fixtures', 'tsconfig.json');
    const dependencies = [];
    const projectGraph = {
      nodes: {},
      externalNodes: {
        'tslib@2.0.0': {
          name: 'npm:tslib@2.0.0' as const,
          type: 'npm' as const,
          data: {
            packageName: 'tslib',
            version: '2.0.0',
          },
        },
      },
      dependencies: {},
    };

    const result = getHelperDependency(
      helperDependency,
      configPath,
      dependencies,
      projectGraph
    );

    expect(result).toEqual({
      name: 'npm:tslib',
      outputs: [],
      node: {
        name: 'npm:tslib@2.0.0',
        type: 'npm',
        data: { packageName: 'tslib', version: '2.0.0' },
      },
    });
  });
});
