// Mock for ora - ora@9+ is ESM-only and breaks Jest in CommonJS mode
const spinner = {};
spinner.start =
  spinner.stop =
  spinner.succeed =
  spinner.fail =
  spinner.warn =
  spinner.info =
  spinner.clear =
  spinner.render =
    () => spinner;

module.exports = () => spinner;
module.exports.default = module.exports;
module.exports.promise = (action) => action;
