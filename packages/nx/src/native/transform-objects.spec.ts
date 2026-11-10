import type { ProjectGraph } from '../config/project-graph';

const transfer = vi.hoisted(() => vi.fn((graph) => ({ graph })));
vi.mock('./index', () => ({ transferProjectGraph: transfer }));
import { transformProjectGraphForLocators } from './transform-objects';

describe('transformProjectGraphForLocators', () => {
  const graph = (): ProjectGraph =>
    ({
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: {
            root: 'apps/app',
            namedInputs: { production: ['default'] },
            targets: {
              build: {
                executor: 'x:y',
                inputs: ['production'],
                outputs: ['{projectRoot}/dist'],
                options: { a: 1 },
                configurations: { prod: { b: 2 } },
              },
            },
          },
        },
      },
      externalNodes: {
        'npm:react': {
          name: 'npm:react',
          type: 'npm',
          data: { packageName: 'react', version: '18.0.0' },
        },
      },
      dependencies: {
        app: [{ source: 'app', target: 'npm:react', type: 'static' }],
      },
    }) as unknown as ProjectGraph;

  beforeEach(() => transfer.mockClear());

  // The locators read roots and the filesets targets hash, nothing else.
  it('copies only project roots, named inputs and target inputs', () => {
    transformProjectGraphForLocators(graph());
    expect(transfer).toHaveBeenCalledWith({
      nodes: {
        app: {
          root: 'apps/app',
          namedInputs: { production: ['default'] },
          targets: { build: { inputs: ['production'] } },
        },
      },
      externalNodes: {},
      dependencies: {},
    });
  });

  it('copies each graph once', () => {
    const g = graph();
    expect(transformProjectGraphForLocators(g)).toBe(
      transformProjectGraphForLocators(g)
    );
    expect(transfer).toHaveBeenCalledTimes(1);
  });
});
