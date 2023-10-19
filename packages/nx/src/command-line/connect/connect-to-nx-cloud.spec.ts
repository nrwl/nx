import { onlyDefaultRunnerIsUsed } from './connect-to-nx-cloud';

describe('connect-to-nx-cloud', () => {
  describe('onlyDefaultRunnerIsUsed', () => {
    it('should say no if tasks runner options is undefined and nxCloudAccessToken is set', () => {
      expect(
        onlyDefaultRunnerIsUsed({
          nxCloudAccessToken: 'xxx-xx-xxx',
        })
      ).toBe(false);
    });

    it('should say yes if tasks runner options is undefined and nxCloudAccessToken is not set', () => {
      expect(onlyDefaultRunnerIsUsed({})).toBe(true);
    });

    it('should say yes if tasks runner options is set to default runner', () => {
      expect(
        onlyDefaultRunnerIsUsed({
          tasksRunnerOptions: {
            default: {
              runner: 'nx/tasks-runners/default',
            },
          },
        })
      ).toBeTruthy();
    });

    it('should say no if tasks runner is set to a custom runner', () => {
      expect(
        onlyDefaultRunnerIsUsed({
          tasksRunnerOptions: {
            default: {
              runner: 'custom-runner',
            },
          },
        })
      ).toBeFalsy();
    });

    it('should say yes if tasks runner has options, but no runner and not using cloud', () => {
      expect(
        onlyDefaultRunnerIsUsed({
          tasksRunnerOptions: {
            default: {
              options: {
                foo: 'bar',
              },
            },
          },
        })
      ).toBeTruthy();
    });

    it('should say no if tasks runner has options, but no runner and using cloud', () => {
      expect(
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
      ).toBeFalsy();
    });
  });
});
