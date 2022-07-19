export function reactNativeBuildTarget(platform: 'ios' | 'android') {
  return {
    options: {
      detoxConfiguration: `${platform}.sim.debug`,
    },
    configurations: {
      production: {
        detoxConfiguration: `${platform}.sim.release`,
      },
    },
  };
}

export function expoBuildTarget(platform: string) {
  return {
    options: {
      detoxConfiguration: `${platform}.sim.debug`,
    },
    configurations: {
      local: {
        detoxConfiguration: `${platform}.sim.local`,
      },
      bare: {
        detoxConfiguration: `${platform}.sim.debug`,
      },
      production: {
        detoxConfiguration: `${platform}.sim.release`,
      },
    },
  };
}

export function reactNativeTestTarget(platform: string, name: string) {
  return {
    options: {
      detoxConfiguration: `${platform}.sim.debug`,
      buildTarget: `${name}:build-ios`,
    },
    configurations: {
      production: {
        detoxConfiguration: `${platform}.sim.release`,
        buildTarget: `${name}:build-ios:production`,
      },
    },
  };
}

export function expoTestTarget(platform: string, name: string) {
  return {
    options: {
      detoxConfiguration: `${platform}.sim.eas`,
      buildTarget: `${name}:build-ios`,
    },
    configurations: {
      local: {
        detoxConfiguration: `${platform}.sim.local`,
        buildTarget: `${name}:build-ios:local`,
      },
      bare: {
        detoxConfiguration: `${platform}.sim.debug`,
        buildTarget: `${name}:build-ios:bare`,
      },
      production: {
        detoxConfiguration: `${platform}.sim.release`,
        buildTarget: `${name}:build-ios:production`,
      },
    },
  };
}
