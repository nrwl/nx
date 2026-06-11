"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// Must be the first import — see enable-compile-cache.ts.
require("../../utils/enable-compile-cache");
const output_1 = require("../../utils/output");
const server_1 = require("./server");
const process = tslib_1.__importStar(require("process"));
(async () => {
    try {
        await (0, server_1.startServer)();
    }
    catch (err) {
        output_1.output.error({
            title: err?.message ||
                'Something unexpected went wrong when starting the server',
        });
        process.exit(1);
    }
})();
