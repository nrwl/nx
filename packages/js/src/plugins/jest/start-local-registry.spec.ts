import { logger } from '@nx/devkit';
import { execSync } from 'child_process';
import type { EventEmitter } from 'node:events';
import { createServer, type Server } from 'node:http';
import { startLocalRegistry } from './start-local-registry';

const registryProcess = vi.hoisted(() => ({
  child: undefined as
    | (EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      })
    | undefined,
}));
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const { EventEmitter } = await import('node:events');
  return {
    ...actual,
    // Keeps the npm token away from the real user config
    execSync: vi.fn(),
    fork: vi.fn(() => {
      registryProcess.child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: vi.fn(),
      });
      return registryProcess.child;
    }),
  };
});

describe('startLocalRegistry', () => {
  let registry: Server;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    await new Promise((resolve) => registry.close(resolve));
  });

  it.each([
    ['skips', 'rejects', true, undefined],
    ['sets', 'accepts', false, 'secretVerdaccioToken'],
  ])(
    '%s the placeholder token when the registry %s it',
    async (_, __, rejectsPlaceholder, token) => {
      // Stands in for Verdaccio 7, which rejects the placeholder unless its config enables jwt tokens
      registry = createServer((req, res) => {
        res.statusCode =
          rejectsPlaceholder &&
          req.headers.authorization === 'Bearer secretVerdaccioToken'
            ? 401
            : 200;
        res.end();
      });
      await new Promise<void>((resolve) =>
        registry.listen(0, '127.0.0.1', resolve)
      );
      const { port } = registry.address() as { port: number };
      const registryUrl = `http://127.0.0.1:${port}`;
      const tokenKey = `//127.0.0.1:${port}/:_authToken`;
      for (const key of [
        'npm_config_registry',
        'pnpm_config_registry',
        `pnpm_config_${tokenKey}`,
        'BUN_CONFIG_REGISTRY',
        'BUN_CONFIG_TOKEN',
        'YARN_REGISTRY',
        'YARN_NPM_REGISTRY_SERVER',
        'YARN_UNSAFE_HTTP_WHITELIST',
      ]) {
        vi.stubEnv(key, undefined);
      }

      const started = startLocalRegistry({
        localRegistryTarget: 'workspace:local-registry',
        listenAddress: '127.0.0.1',
      });
      registryProcess.child.stdout.emit(
        'data',
        Buffer.from(`Verdaccio is listening on ${registryUrl}/\n`)
      );
      const stop = await started;

      const tokenCommands = () =>
        vi
          .mocked(execSync)
          .mock.calls.map(([command]) => command)
          .filter((command) => command.includes(tokenKey));
      const setToken = `npm config set ${tokenKey} "secretVerdaccioToken" --ws=false`;
      expect(tokenCommands()).toEqual(token ? [setToken] : []);
      expect(process.env[`pnpm_config_${tokenKey}`]).toBe(token);
      expect(process.env.BUN_CONFIG_TOKEN).toBe(token);
      expect(process.env.npm_config_registry).toBe(registryUrl);
      expect(process.env.pnpm_config_registry).toBe(registryUrl);
      expect(process.env.BUN_CONFIG_REGISTRY).toBe(registryUrl);
      expect(warn).toHaveBeenCalledTimes(rejectsPlaceholder ? 1 : 0);

      stop();

      expect(registryProcess.child.kill).toHaveBeenCalled();
      expect(tokenCommands()).toEqual(
        token ? [setToken, `npm config delete ${tokenKey} --ws=false`] : []
      );
    }
  );
});
