// This is a workaround for a problem in Nx 13.0.0-beta.7
// TODO(jack): Can remove this after we patch Nx in 13.0.0 beta.8 or final release.
module.exports = (config) => {
  config.optimization.providedExports = true;
  return config;
};
