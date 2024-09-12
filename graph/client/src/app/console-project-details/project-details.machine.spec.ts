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
    expect(service.state.context.errors).toEqual(null);
  });

  it('should handle setting project and source map', () => {
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
    });

    expect(service.state.context.project).toEqual({
      type: 'app',
      name: 'proj',
      data: {},
    });
    expect(service.state.context.sourceMap).toEqual({
      root: ['project.json', 'nx-core-build-project-json-nodes'],
    });
  });

  it('should handle errors', () => {
    const testError = {
      message: 'test',
      stack: 'test',
      cause: 'test',
      name: 'test',
      pluginName: 'test',
    };

    service.send({
      type: 'setErrors',
      errors: [testError],
    });
    expect(service.state.value).toEqual('error');
    expect(service.state.context.errors).toBeDefined();

    service.send({ type: 'clearErrors' });
    expect(service.state.value).toEqual('idle');

    service.send({
      type: 'setErrors',
      errors: [testError],
    });
    expect(service.state.value).toEqual('error');
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
    });
    // Still in error state
    expect(service.state.value).toEqual('error');
  });
});
