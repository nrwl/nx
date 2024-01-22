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
      detoxConfiguration: `${platform}.local`,
    },
    configurations: {
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
  e2eName: string
) {
  const buildPlatform = platform === 'ios.sim' ? 'ios' : 'android';

  return {
    options: {
      detoxConfiguration: `${platform}.debug`,
      buildTarget: `${e2eName}:build-${buildPlatform}`,
    },
    configurations: {
      production: {
        detoxConfiguration: `${platform}.release`,
        buildTarget: `${e2eName}:build-${buildPlatform}:production`,
      },
    },
  };
}

export function expoTestTarget(
  platform: 'ios.sim' | 'android.emu',
  e2eName: string
) {
  const buildPlatform = platform === 'ios.sim' ? 'ios' : 'android';

  return {
    options: {
      detoxConfiguration: `${platform}.local`,
      buildTarget: `${e2eName}:build-${buildPlatform}`,
    },
    configurations: {
      bare: {
        detoxConfiguration: `${platform}.debug`,
        buildTarget: `${e2eName}:build-${buildPlatform}:bare`,
      },
      production: {
        detoxConfiguration: `${platform}.release`,
        buildTarget: `${e2eName}:build-${buildPlatform}:production`,
      },
    },
  };
}
