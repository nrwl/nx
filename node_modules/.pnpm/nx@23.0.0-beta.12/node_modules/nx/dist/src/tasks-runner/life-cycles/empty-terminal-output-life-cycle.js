"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyTerminalOutputLifeCycle = void 0;
const output_1 = require("../../utils/output");
const utils_1 = require("../utils");
class EmptyTerminalOutputLifeCycle {
    printTaskTerminalOutput(task, cacheStatus, terminalOutput) {
        if (cacheStatus === 'success' ||
            cacheStatus === 'failure' ||
            cacheStatus === 'skipped') {
            const args = (0, utils_1.getPrintableCommandArgsForTask)(task);
            output_1.output.logCommandOutput(args.join(' '), cacheStatus, terminalOutput);
        }
    }
}
exports.EmptyTerminalOutputLifeCycle = EmptyTerminalOutputLifeCycle;
