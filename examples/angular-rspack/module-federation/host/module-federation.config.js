module.exports = {
  name: 'examples_angular_rspack_mf_host',
  filename: 'remoteEntry.js',
  library: { type: 'module' },
  dts: false,
  remotes: {
    'examples-angular-rspack-mf-remote': 'http://localhost:4201/remoteEntry.js',
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
