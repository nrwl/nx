"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsReportCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
exports.yargsReportCommand = {
    command: 'report',
    describe: 'Reports useful version numbers to copy into the Nx issue template.',
    handler: async () => {
        await (await (0, handle_import_1.handleImport)('./report.js', __dirname)).reportHandler();
        process.exit(0);
    },
};
