import { assertWorkspaceValidity } from './assert-workspace-validity';
import { output } from '../utilities/output';

describe('assertWorkspaceValidity', () => {
  let mockNxJson: any;
  let mockWorkspaceJson: any;

  beforeEach(() => {
    mockNxJson = {
      implicitDependencies: {
        'nx.json': '*',
      },
    };
    mockWorkspaceJson = {
      projects: {
        app1: {},
        'app1-e2e': {},
        app2: {},
        'app2-e2e': {},
        lib1: {},
        lib2: {},
      },
    };
  });

  it('should not throw for a valid workspace', () => {
    assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);
  });

  it('should throw for an invalid top-level implicit dependency', () => {
    jest.spyOn(output, 'error');
    mockNxJson.implicitDependencies = {
      'README.md': ['invalidproj'],
    };

    const mockExit = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {}) as any);
    assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(output.error).toHaveBeenCalledWith({
      title: 'Configuration Error',
      bodyLines: [
        `The following implicitDependencies specified in nx.json are invalid:
    README.md
        invalidproj`,
      ],
    });
    mockExit.mockRestore();
  });

  it('should throw for an invalid project-level implicit dependency', () => {
    jest.spyOn(output, 'error');
    mockWorkspaceJson.projects.app2.implicitDependencies = ['invalidproj'];

    const mockExit = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {}) as any);
    assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(output.error).toHaveBeenCalledWith({
      title: 'Configuration Error',
      bodyLines: [
        `The following implicitDependencies specified in nx.json are invalid:
    app2
        invalidproj`,
      ],
    });
    mockExit.mockRestore();
  });

  it('should throw for a project-level implicit dependency that is a string', () => {
    jest.spyOn(output, 'error');
    mockNxJson.implicitDependencies['nx.json'] = 'invalidproj';

    const mockExit = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {}) as any);
    assertWorkspaceValidity(mockWorkspaceJson, mockNxJson);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(output.error).toHaveBeenCalledWith({
      title: 'Configuration Error',
      bodyLines: [
        'nx.json is not configured properly. "nx.json" is improperly configured to implicitly depend on "invalidproj" but should be an array of project names or "*".',
      ],
    });
    mockExit.mockRestore();
  });
});
