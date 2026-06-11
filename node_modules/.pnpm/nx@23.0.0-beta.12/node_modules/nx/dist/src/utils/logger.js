"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.NX_ERROR = exports.NX_PREFIX = void 0;
exports.createLogger = createLogger;
exports.stripIndent = stripIndent;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const is_on_daemon_1 = require("../daemon/is-on-daemon");
const logger_1 = require("../daemon/logger");
exports.NX_PREFIX = pc.inverse(pc.bold(pc.cyan(' NX ')));
exports.NX_ERROR = pc.inverse(pc.bold(pc.red(' ERROR ')));
function createLogger(driver) {
    return {
        warn: (...v) => driver.warn(...v.map((s) => pc.bold(pc.yellow(s)))),
        error: (s) => {
            if (typeof s === 'string' && s.startsWith('NX ')) {
                driver.error(`\n${exports.NX_ERROR} ${pc.bold(pc.red(s.slice(3)))}\n`);
            }
            else if (s instanceof Error && s.stack) {
                driver.error(pc.bold(pc.red(s.stack)));
            }
            else {
                driver.error(pc.bold(pc.red(s)));
            }
        },
        info: (s) => {
            if (typeof s === 'string' && s.startsWith('NX ')) {
                driver.info(`\n${exports.NX_PREFIX} ${pc.bold(s.slice(3))}\n`);
            }
            else {
                driver.info(s);
            }
        },
        log: (...s) => {
            driver.log(...s);
        },
        debug: (...s) => {
            driver.debug(...s);
        },
        fatal: (...s) => {
            driver.error(...s);
        },
        verbose: (...s) => {
            if (process.env.NX_VERBOSE_LOGGING === 'true') {
                // verbose logs go to stderr to prevent things like `nx show projects | grep`
                // breaking when you enable verbose logging. The only potential breakage from
                // this would be if a tool counts any output on stderr as being an issue, but
                // there are likely other places that would trigger those same issues.
                driver.warn(...s);
            }
        },
    };
}
exports.logger = createLogger((0, is_on_daemon_1.isOnDaemon)()
    ? (() => {
        const log = logger_1.serverLogger.log.bind(logger_1.serverLogger);
        return {
            warn: log,
            error: log,
            debug: log,
            info: log,
            log: log,
        };
    })()
    : console);
function stripIndent(str) {
    const match = str.match(/^[ \t]*(?=\S)/gm);
    if (!match) {
        return str;
    }
    const indent = match.reduce((r, a) => Math.min(r, a.length), Infinity);
    const regex = new RegExp(`^[ \\t]{${indent}}`, 'gm');
    return str.replace(regex, '');
}
