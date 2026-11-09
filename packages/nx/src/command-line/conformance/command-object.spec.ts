import Module = require('module');
import { output } from '../../utils/output';
import { resolveConformanceCommandObject } from './command-object';

describe('resolveConformanceCommandObject', () => {
  const originalLoad = (Module as any)._load;

  function loadConformanceAs(load: () => unknown) {
    vi.spyOn(Module as any, '_load').mockImplementation(function (
      request: string,
      ...rest: unknown[]
    ) {
      return request === '@nx/conformance'
        ? load()
        : originalLoad.call(this, request, ...rest);
    });
  }

  function runHandler(
    command: ReturnType<typeof resolveConformanceCommandObject>
  ) {
    const error = vi.spyOn(output, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    command.handler({} as any);
    return error.mock.calls[0][0];
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should wrap the plugin builder with the verbose option', () => {
    const builder = vi.fn((yargs) => yargs);
    loadConformanceAs(() => ({
      yargsConformanceCheckCommand: {
        command: 'conformance:check',
        builder,
        handler: () => {},
      },
    }));

    const command = resolveConformanceCommandObject('conformance:check');
    const yargs = {
      option: vi.fn().mockReturnThis(),
      middleware: vi.fn().mockReturnThis(),
    };
    (command.builder as Function)(yargs);

    expect(command.command).toBe('conformance:check');
    expect(yargs.option).toHaveBeenCalledWith('verbose', expect.anything());
    expect(builder).toHaveBeenCalledWith(yargs);
  });

  it('should ask to install the plugin when @nx/conformance is missing', () => {
    loadConformanceAs(() => {
      throw Object.assign(new Error(`Cannot find module '@nx/conformance'`), {
        code: 'MODULE_NOT_FOUND',
      });
    });

    const command = resolveConformanceCommandObject('conformance');

    expect(runHandler(command).title).toBe(
      'nx conformance requires the @nx/conformance plugin'
    );
  });

  it('should report the load error when an installed plugin fails to load', () => {
    loadConformanceAs(() => {
      throw Object.assign(new Error(`Cannot find module 'ajv'`), {
        code: 'MODULE_NOT_FOUND',
      });
    });

    const command = resolveConformanceCommandObject('conformance');
    const reported = runHandler(command);

    expect(reported.title).toBe(
      'nx conformance could not load the @nx/conformance plugin'
    );
    expect(reported.bodyLines).toContain(`Cannot find module 'ajv'`);
  });
});
