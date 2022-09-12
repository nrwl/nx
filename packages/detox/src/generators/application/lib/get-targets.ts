export function reactNativeBuildTarget(platform: 'ios.sim' | 'android.emu') {
  return {
    options: {
      detoxConfiguration: `${platform}.debug`,
    },
    configurations: {
      production: {
        detoxConfiguration: `${platform}.release`,
      },
    },
  };
}

export function expoBuildTarget(platform: 'ios.sim' | 'android.emu') {
  return {
    options: {
      detoxConfiguration: `${platform}.debug`,
    },
    configurations: {
      local: {
        detoxConfiguration: `${platform}.local`,
      },
      bare: {
        detoxConfiguration: `${platform}.debug`,
      },
      production: {
        detoxConfiguration: `${platform}.release`,
      },
    },
  };
}

export function reactNativeTestTarget(
  platform: 'ios.sim' | 'android.emu',
  name: string
) {
  return {
    options: {
      detoxConfiguration: `${platform}.debug`,
      buildTarget: `${name}:build-ios`,
    },
    configurations: {
      production: {
        detoxConfiguration: `${platform}.release`,
        buildTarget: `${name}:build-ios:production`,
      },
    },
  };
}

export function expoTestTarget(
  platform: 'ios.sim' | 'android.emu',
  name: string
) {
  return {
    options: {
      detoxConfiguration: `${platform}.eas`,
      buildTarget: `${name}:build-ios`,
    },
    configurations: {
      local: {
        detoxConfiguration: `${platform}.local`,
        buildTarget: `${name}:build-ios:local`,
      },
      bare: {
        detoxConfiguration: `${platform}.debug`,
        buildTarget: `${name}:build-ios:bare`,
      },
      production: {
        detoxConfiguration: `${platform}.release`,
        buildTarget: `${name}:build-ios:production`,
      },
    },
  };
}
