import { join } from 'node:path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { getImplementationFactory } from '../../config/schema-utils';
import { getExecutorInformation } from './executor-utils';

vi.mock('../../config/schema-utils', () => ({
  getImplementationFactory: vi.fn(() => () => ({})),
  resolveSchema: vi.fn((schema: string, directory: string) =>
    join(directory, schema)
  ),
}));

describe('getExecutorInformation', () => {
  it('reads an aliased builder from the package that declares it', () => {
    const fs = new TempFs('executor-utils-alias');
    fs.createFilesSync({
      'node_modules/alias-pkg/package.json': JSON.stringify({
        name: 'alias-pkg',
        executors: './executors.json',
      }),
      'node_modules/alias-pkg/executors.json': JSON.stringify({
        builders: { build: 'impl-pkg:build' },
      }),
      'node_modules/impl-pkg/package.json': JSON.stringify({
        name: 'impl-pkg',
        executors: './executors.json',
      }),
      'node_modules/impl-pkg/executors.json': JSON.stringify({
        executors: {
          build: { implementation: './build', schema: './schema.json' },
        },
      }),
      'node_modules/impl-pkg/schema.json': JSON.stringify({ properties: {} }),
    });

    getExecutorInformation('alias-pkg', 'build', fs.tempDir, {});

    expect(vi.mocked(getImplementationFactory)).toHaveBeenCalledWith(
      './build',
      join(fs.tempDir, 'node_modules/impl-pkg'),
      'alias-pkg',
      {},
      'impl-pkg'
    );
    fs.cleanup();
  });
});
