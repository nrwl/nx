import { expoBuildTarget, expoTestTarget } from './get-targets';

describe('getTargets', () => {
  it('should return ios test target for expo projects', () => {
    expect(expoTestTarget('ios.sim', 'test')).toEqual({
      options: {
        detoxConfiguration: 'ios.sim.eas',
        buildTarget: 'test:build-ios',
      },
      configurations: {
        local: {
          detoxConfiguration: 'ios.sim.local',
          buildTarget: 'test:build-ios:local',
        },
        bare: {
          detoxConfiguration: 'ios.sim.debug',
          buildTarget: 'test:build-ios:bare',
        },
        production: {
          detoxConfiguration: 'ios.sim.release',
          buildTarget: 'test:build-ios:production',
        },
      },
    });
  });

  it('should return ios build target for expo projects', () => {
    expect(expoBuildTarget('ios.sim')).toEqual({
      options: {
        detoxConfiguration: 'ios.sim.eas',
      },
      configurations: {
        local: {
          detoxConfiguration: 'ios.sim.local',
        },
        bare: {
          detoxConfiguration: 'ios.sim.debug',
        },
        production: {
          detoxConfiguration: 'ios.sim.release',
        },
      },
    });
  });
});
