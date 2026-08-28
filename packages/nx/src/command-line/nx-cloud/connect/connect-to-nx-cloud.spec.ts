import type { Mock } from 'vitest';
vi.mock('@clack/prompts', () => ({
  autocomplete: vi.fn(),
  isCancel: () => false,
}));

vi.mock('../../../utils/ab-testing', async () => ({
  ...(await vi.importActual('../../../utils/ab-testing')),
  recordStat: vi.fn(),
}));

import { autocomplete } from '@clack/prompts';
import { withEnvironmentVariables } from '../../../internal-testing-utils/with-environment';
import {
  connectExistingRepoToNxCloudPrompt,
  onlyDefaultRunnerIsUsed,
} from './connect-to-nx-cloud';

describe('connect-to-nx-cloud', () => {
  describe('onlyDefaultRunnerIsUsed', () => {
    it('should say no if tasks runner options is undefined and nxCloudAccessToken is set', () => {
      expect(
        withEnvironmentVariables(
          {
            NX_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              nxCloudAccessToken: 'xxx-xx-xxx',
            })
        )
      ).toBe(false);
    });

    it('should say no if tasks runner options is undefined and nxCloudId is set', () => {
      expect(
        withEnvironmentVariables(
          {
            NX_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              nxCloudId: 'xxxxxxx',
              nxCloudUrl: 'https://my-nx-cloud.app',
            })
        )
      ).toBe(false);
    });

    it('should say no if cloud access token is in env', () => {
      const defaultRunnerUsed = withEnvironmentVariables(
        {
          NX_CLOUD_ACCESS_TOKEN: 'xxx-xx-xxx',
        },
        () => onlyDefaultRunnerIsUsed({})
      );

      expect(defaultRunnerUsed).toBe(false);
    });

    it('should say yes if tasks runner options is undefined and nxCloudAccessToken/nxCloudId is not set', () => {
      expect(
        withEnvironmentVariables(
          {
            NX_CLOUD_ACCESS_TOKEN: null,
          },
          () => onlyDefaultRunnerIsUsed({})
        )
      ).toBe(true);
    });

    it('should say yes if tasks runner options is set to default runner', () => {
      expect(
        withEnvironmentVariables(
          {
            NX_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  runner: 'nx/tasks-runners/default',
                },
              },
            })
        )
      ).toBeTruthy();
    });

    it('should say no if tasks runner is set to a custom runner', () => {
      expect(
        withEnvironmentVariables(
          {
            NX_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  runner: 'custom-runner',
                },
              },
            })
        )
      ).toBeFalsy();
    });

    it('should say yes if tasks runner has options, but no runner and not using cloud', () => {
      expect(
        withEnvironmentVariables(
          {
            NX_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  options: {
                    foo: 'bar',
                  },
                },
              },
            })
        )
      ).toBeTruthy();
    });

    it('should say no if tasks runner has options, but no runner and using cloud', () => {
      expect(
        withEnvironmentVariables(
          {
            NX_CLOUD_ACCESS_TOKEN: null,
          },
          () =>
            onlyDefaultRunnerIsUsed({
              tasksRunnerOptions: {
                default: {
                  options: {
                    foo: 'bar',
                  },
                },
              },
              nxCloudAccessToken: 'xxx-xx-xxx',
            })
        )
      ).toBeFalsy();
    });
  });
});

describe('nxCloudPrompt option mapping', () => {
  const mockAutocomplete = autocomplete as unknown as Mock;

  beforeEach(() => {
    mockAutocomplete.mockReset();
  });

  // The message choices are `{ value, name }` with `name` as the display text.
  // Mapping `name` into clack's `value` made the prompt answer with the label,
  // so every caller comparison against 'skip' / 'yes' silently missed.
  it('offers the choice keys as values, not their labels', async () => {
    mockAutocomplete.mockResolvedValueOnce('skip');

    await connectExistingRepoToNxCloudPrompt('init', 'setupNxCloud', false);

    const { options, initialValue } = mockAutocomplete.mock.calls[0][0];
    expect(options.length).toBeGreaterThan(1);
    // every value is a lowercase key, never the human-readable label
    for (const option of options) {
      expect(option.value).toMatch(/^[a-z][a-z-]*$/);
      expect(option.value).not.toBe(option.label);
    }
    // the initial selection is a value too, not a label
    expect(options.map((o: { value: string }) => o.value)).toContain(
      initialValue
    );
  });

  it('returns the selected key unchanged', async () => {
    mockAutocomplete.mockImplementationOnce(
      ({ options }: { options: { value: string }[] }) =>
        options.find((o) => o.value === 'skip')?.value
    );

    await expect(
      connectExistingRepoToNxCloudPrompt('init', 'setupNxCloud', false)
    ).resolves.toBe('skip');
  });

  it('blocks a submit that matched no option', async () => {
    mockAutocomplete.mockResolvedValueOnce('skip');

    await connectExistingRepoToNxCloudPrompt('init', 'setupNxCloud', false);

    const { validate } = mockAutocomplete.mock.calls[0][0];
    expect(validate(undefined)).toEqual(expect.any(String));
    expect(validate('skip')).toBeUndefined();
  });
});
