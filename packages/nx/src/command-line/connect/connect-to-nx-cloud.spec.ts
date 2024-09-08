import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { onlyDefaultRunnerIsUsed } from './connect-to-nx-cloud';

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
