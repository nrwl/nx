module.exports = {
  name: 'examples_angular_rspack_mf_remote',
  filename: 'remoteEntry.js',
  library: { type: 'module' },
  dts: false,
  exposes: {
    './Routes': './src/app/remote-entry/entry.routes.ts',
  },
  shared: {
    '@angular/common': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '~22.0.0',
    },
    '@angular/core': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '~22.0.0',
    },
    '@angular/platform-browser': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '~22.0.0',
    },
    '@angular/router': {
      singleton: true,
      strictVersion: true,
      requiredVersion: '~22.0.0',
    },
  },
};
