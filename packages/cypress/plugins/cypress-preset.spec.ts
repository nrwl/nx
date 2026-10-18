import { spawn } from 'child_process';
import { request } from 'http';
import vitePreprocessor from '../src/plugins/preprocessor-vite';
import { nxE2EPreset } from './cypress-preset';

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: vi.fn(() => ({ pid: 123, kill: vi.fn(() => true) })),
}));
vi.mock('http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('http')>()),
  request: vi.fn(),
}));
vi.mock('../src/plugins/preprocessor-vite', () => ({
  default: vi.fn(() => 'vite-preprocessor'),
}));

// Each request answers with the next value: true responds, false errors.
function mockServerResponses(...responses: boolean[]) {
  vi.mocked(request).mockImplementation(((_url, onResponse) => {
    const handlers: Record<string, () => void> = {};
    return {
      on: (event: string, handler: () => void) => {
        handlers[event] = handler;
      },
      end: () => {
        if (responses.shift() ?? true) {
          onResponse();
        } else {
          handlers.error?.();
        }
      },
    };
  }) as any);
}

describe('nxE2EPreset setupNodeEvents', () => {
  const originalReadyUrl = process.env.NX_READY_URL;
  const webServerCommands = { default: 'nx run app:serve' };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NX_READY_URL;
  });

  afterAll(() => {
    if (originalReadyUrl === undefined) {
      delete process.env.NX_READY_URL;
    } else {
      process.env.NX_READY_URL = originalReadyUrl;
    }
  });

  it('should test against NX_READY_URL without starting a web server', async () => {
    process.env.NX_READY_URL = 'http://localhost:4300/';
    const preset = nxE2EPreset(__filename, { webServerCommands });
    const config = { baseUrl: 'http://localhost:4200' };

    const result = await preset.setupNodeEvents(vi.fn(), config);

    expect(result).toBe(config);
    expect(result.baseUrl).toBe('http://localhost:4300/');
    expect(spawn).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("should keep baseUrl's path and loopback host name, taking the reported port", async () => {
    process.env.NX_READY_URL = 'http://[::1]:4300/';
    const preset = nxE2EPreset(__filename, { webServerCommands });

    const result = await preset.setupNodeEvents(vi.fn(), {
      baseUrl: 'http://localhost:4200/app',
    });

    expect(result.baseUrl).toBe('http://localhost:4300/app');
  });

  it('should use NX_READY_URL when the config has no baseUrl', async () => {
    process.env.NX_READY_URL = 'http://localhost:4300/';
    const preset = nxE2EPreset(__filename, { webServerCommands });

    const result = await preset.setupNodeEvents(vi.fn(), {});

    expect(result).toEqual({ baseUrl: 'http://localhost:4300/' });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('should still register the vite preprocessor when NX_READY_URL is set', async () => {
    process.env.NX_READY_URL = 'http://localhost:4300/';
    const on = vi.fn();
    const preset = nxE2EPreset(__filename, {
      bundler: 'vite',
      webServerCommands,
    });

    await preset.setupNodeEvents(on, { baseUrl: 'http://localhost:4200' });

    expect(vitePreprocessor).toHaveBeenCalled();
    expect(on).toHaveBeenCalledWith('file:preprocessor', 'vite-preprocessor');
  });

  it('should apply NX_READY_URL through a wrapping setupNodeEvents that returns the config', async () => {
    process.env.NX_READY_URL = 'http://localhost:4300/';
    const preset = nxE2EPreset(__filename, { webServerCommands });
    const userConfig = {
      ...preset,
      async setupNodeEvents(on, config) {
        await preset.setupNodeEvents(on, config);
        return config;
      },
    };

    const result = await userConfig.setupNodeEvents(vi.fn(), {
      baseUrl: 'http://localhost:4200',
    });

    expect(result.baseUrl).toBe('http://localhost:4300/');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('should start the web server and wait for baseUrl when NX_READY_URL is not set', async () => {
    mockServerResponses(false, false, true);
    const on = vi.fn();
    const preset = nxE2EPreset(__filename, { webServerCommands });

    const result = await preset.setupNodeEvents(on, {
      baseUrl: 'http://localhost:4200',
    });

    expect(result).toBeUndefined();
    expect(spawn).toHaveBeenCalledWith(
      'nx run app:serve',
      expect.objectContaining({ shell: true })
    );
    expect(on).toHaveBeenCalledWith('after:run', expect.any(Function));
  });

  it('should reuse a server already running on baseUrl when NX_READY_URL is not set', async () => {
    mockServerResponses(true);
    const preset = nxE2EPreset(__filename, { webServerCommands });
    const config = { baseUrl: 'http://localhost:4200' };

    const result = await preset.setupNodeEvents(vi.fn(), config);

    expect(result).toBeUndefined();
    expect(config.baseUrl).toBe('http://localhost:4200');
    expect(spawn).not.toHaveBeenCalled();
  });
});
