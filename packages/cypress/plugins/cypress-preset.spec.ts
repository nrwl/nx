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

// Cypress keeps the config file's values in rawJson
function fromConfigFile(baseUrl: string) {
  return { baseUrl, rawJson: { e2e: { baseUrl } } };
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
    const config = fromConfigFile('http://localhost:4200');

    const result = await preset.setupNodeEvents(vi.fn(), config);

    expect(result).toBe(config);
    expect(result.baseUrl).toBe('http://localhost:4300/');
    expect(spawn).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("should keep baseUrl's path and loopback host name, taking the reported port", async () => {
    process.env.NX_READY_URL = 'http://[::1]:4300/';
    const preset = nxE2EPreset(__filename, { webServerCommands });

    const result = await preset.setupNodeEvents(
      vi.fn(),
      fromConfigFile('http://localhost:4200/app')
    );

    expect(result.baseUrl).toBe('http://localhost:4300/app');
  });

  const ciOptions = {
    webServerCommands,
    ciWebServerCommand: 'nx run app:preview',
    ciBaseUrl: 'http://localhost:4300',
  };

  it.each([
    [
      '--config',
      { webServerCommands },
      {
        ...fromConfigFile('http://localhost:4200'),
        baseUrl: 'http://staging.example.com',
      },
    ],
    [
      'CYPRESS_BASE_URL read by the config file',
      { webServerCommands },
      {
        ...fromConfigFile('http://staging.example.com'),
        resolved: {
          baseUrl: { value: 'http://staging.example.com', from: 'env' },
        },
      },
    ],
    [
      '--config with the ciBaseUrl in an e2e task',
      ciOptions,
      {
        ...fromConfigFile('http://localhost:4200'),
        baseUrl: 'http://localhost:4300',
      },
    ],
  ])(
    'should wait for and keep a baseUrl from %s',
    async (_, options, config: Record<string, any>) => {
      process.env.NX_READY_URL = 'http://localhost:4301/';
      mockServerResponses(false, true);
      const preset = nxE2EPreset(__filename, options);
      const baseUrl = config.baseUrl;

      const result = await preset.setupNodeEvents(vi.fn(), config);

      expect(result).toBeUndefined();
      expect(config.baseUrl).toBe(baseUrl);
      expect(request).toHaveBeenCalledTimes(2);
      expect(spawn).not.toHaveBeenCalled();
    }
  );

  it('should fail and stop polling when a baseUrl override does not respond in time', async () => {
    process.env.NX_READY_URL = 'http://localhost:4300/';
    // Requests stay in flight until failed by hand
    const pending: Array<() => void> = [];
    vi.mocked(request).mockImplementation((() => {
      const handlers: Record<string, () => void> = {};
      return {
        on: (event: string, handler: () => void) => {
          handlers[event] = handler;
        },
        end: () => pending.push(() => handlers.error?.()),
      };
    }) as any);
    const preset = nxE2EPreset(__filename, {
      webServerCommands,
      webServerConfig: { timeout: 50 },
    });

    await expect(
      preset.setupNodeEvents(vi.fn(), {
        ...fromConfigFile('http://localhost:4200'),
        baseUrl: 'http://staging.example.com',
      })
    ).rejects.toThrow('http://staging.example.com did not respond within 50ms');
    pending.forEach((fail) => fail());
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(request).toHaveBeenCalledTimes(1);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('should move the ciBaseUrl of an inferred e2e-ci task to NX_READY_URL', async () => {
    process.env.NX_READY_URL = 'http://localhost:4301/';
    const preset = nxE2EPreset(__filename, ciOptions);

    const result = await preset.setupNodeEvents(vi.fn(), {
      ...fromConfigFile('http://localhost:4200'),
      baseUrl: 'http://localhost:4300',
      env: { webServerCommand: 'nx run app:preview' },
    });

    expect(result.baseUrl).toBe('http://localhost:4301/');
  });

  it('should move a baseUrl that only differs from the config file in form', async () => {
    process.env.NX_READY_URL = 'http://localhost:4300/';
    const preset = nxE2EPreset(__filename, { webServerCommands });

    const result = await preset.setupNodeEvents(vi.fn(), {
      ...fromConfigFile('http://localhost:4200'),
      baseUrl: 'http://localhost:4200/',
    });

    expect(result.baseUrl).toBe('http://localhost:4300/');
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

    await preset.setupNodeEvents(on, fromConfigFile('http://localhost:4200'));

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

    const result = await userConfig.setupNodeEvents(
      vi.fn(),
      fromConfigFile('http://localhost:4200')
    );

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
