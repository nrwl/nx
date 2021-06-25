import { logger } from '@nrwl/devkit';
import { requireShim } from './require-shim';

const result = requireShim('webpack/package.json');
const version = result?.version;

exports.default = undefined;

const forceWebpack4 = process.env.NX_FORCE_WEBPACK_4;

exports.isWebpack5 = !forceWebpack4 && /^5\./.test(version);

let hasLogged = false;

if (exports.isWebpack5) {
  if (!hasLogged) {
    logger.info(
      `NX Using webpack 5. Reason: detected in node_modules/webpack/package.json`
    );
    hasLogged = true;
  }
  Object.assign(
    exports,
    require('./bundle5')(() => {
      exports.isWebpack5 = false;
    })
  );
} else {
  if (!hasLogged) {
    logger.info(
      `NX Using webpack 4. Reason: ${
        forceWebpack4
          ? 'NX_FORCE_WEBPACK_4 was set'
          : 'detected in node_modules/webpack/package.json'
      }`
    );
    hasLogged = true;
  }
  Object.assign(exports, require('./bundle4')());
}
