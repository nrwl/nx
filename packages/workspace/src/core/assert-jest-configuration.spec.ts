import { assertJestConfigValidity } from './assert-jest-configuration';
import { output } from '../utilities/output';

interface MockGraph {
  nodes: Record<
    string,
    {
      data: {
        targets: {
          test?: {
            executor: string;
          };
        };
        root: string;
      };
    }
  >;
}

describe('assertJestConfiguration()', () => {
  let mockGraph: MockGraph;
  let mockRootJestConfig: string;

  describe('Basic Workspace config with e2e app and lib that uses Karma', () => {
    beforeEach(() => {
      mockGraph = {
        nodes: {
          myApp: {
            data: {
              targets: {
                test: { executor: '@nrwl/jest:jest' },
              },
              root: 'test-root',
            },
          },
          'myApp-e2e': {
            data: { targets: {}, root: 'test-root-e2e' },
          },
          libWithOtherTestExecutor: {
            data: {
              targets: {
                test: {
                  executor: '@nrwl/karma:karma',
                },
              },
              root: 'test-karma',
            },
          },
        },
      };
    });
    describe('correct configuration', () => {
      beforeEach(() => {
        mockRootJestConfig = `module.exports = {
  projects: ['<rootDir>/test-root']
}
`;
      });
      it('Succeeds with success message', () => {
        const successSpy = jest.spyOn(output, 'success');
        assertJestConfigValidity(mockGraph as any, mockRootJestConfig);
        expect(successSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('typo in jest config', () => {
      beforeEach(() => {
        mockRootJestConfig = `module.exports = {
    projects: ['<rootDir>/test-root1']
  }
  `;
      });
      it('Fails with helpful message', () => {
        const errorSpy = jest.spyOn(output, 'error');
        const mockExit = jest
          .spyOn(process, 'exit')
          .mockImplementation(((code?: number) => {}) as any);
        assertJestConfigValidity(mockGraph as any, mockRootJestConfig);
        expect(errorSpy).toHaveBeenCalledWith({
          title: 'Configuration Error',
          bodyLines: [
            'The following projects from your `jest.config.js` file do not appear to exist in your workspace:',
            '  <rootDir>/test-root1',
          ],
        });
        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });
    describe('project missing in jest.config.js', () => {
      beforeEach(() => {
        mockRootJestConfig = `module.exports = {
      projects: []
    }
    `;
      });
      it('Fails with helpful message', () => {
        const errorSpy = jest.spyOn(output, 'error');
        const mockExit = jest
          .spyOn(process, 'exit')
          .mockImplementation(((code?: number) => {}) as any);
        assertJestConfigValidity(mockGraph as any, mockRootJestConfig);
        expect(errorSpy).toHaveBeenCalledWith({
          title: 'Configuration Error',
          bodyLines: [
            'You appear to be missing the following from the `projects` property of your root `jest.config.js`:',
            '  <rootDir>/test-root',
          ],
        });
        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });

    describe('`projects` property missing in jest.config.js', () => {
      beforeEach(() => {
        mockRootJestConfig = `module.exports = {}`;
      });
      it('Fails with helpful message', () => {
        const errorSpy = jest.spyOn(output, 'error');
        const mockExit = jest
          .spyOn(process, 'exit')
          .mockImplementation(((code?: number) => {}) as any);
        assertJestConfigValidity(mockGraph as any, mockRootJestConfig);
        expect(errorSpy).toHaveBeenCalledWith({
          title: 'Configuration Error',
          bodyLines: [
            'No `projects` property found in `jest.config.json`.',
            'The following array was expected from the project property:',
            `["<rootDir>/test-root"]`,
          ],
        });
        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });
  });
});
