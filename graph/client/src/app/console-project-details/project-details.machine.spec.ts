import { interpret } from 'xstate';
import { projectDetailsMachine } from './project-details.machine';

describe('graphMachine', () => {
  let service;

  beforeEach(() => {
    service = interpret(projectDetailsMachine).start();
  });

  afterEach(() => {
    service.stop();
  });

  it('should have initial idle state', () => {
    expect(service.state.value).toEqual('idle');
    expect(service.state.context.project).toEqual(null);
    expect(service.state.context.errors).toBeUndefined();
  });

  it('should handle setting data', () => {
    service.send({
      type: 'loadData',
      project: {
        type: 'app',
        name: 'proj',
        data: {},
      },
      sourceMap: {
        root: ['project.json', 'nx-core-build-project-json-nodes'],
      },
      errors: [{ name: 'ERROR' }],
      connectedToCloud: true,
    });

    expect(service.state.value).toEqual('loaded');

    expect(service.state.context.project).toEqual({
      type: 'app',
      name: 'proj',
      data: {},
    });
    expect(service.state.context.sourceMap).toEqual({
      root: ['project.json', 'nx-core-build-project-json-nodes'],
    });
    expect(service.state.context.errors).toEqual([{ name: 'ERROR' }]);
    expect(service.state.context.connectedToCloud).toEqual(true);
  });
});
