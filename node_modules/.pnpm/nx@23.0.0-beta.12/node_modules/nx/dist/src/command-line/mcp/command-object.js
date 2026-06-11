"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsMcpCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
exports.yargsMcpCommand = {
    command: 'mcp',
    describe: 'Starts the Nx MCP server.',
    // @ts-expect-error - yargs types are outdated, refer to docs - https://github.com/yargs/yargs/blob/main/docs/api.md#commandmodule
    builder: async (y, helpOrVersionSet) => {
        if (helpOrVersionSet) {
            (await (0, handle_import_1.handleImport)('./mcp', __dirname)).showHelp();
            process.exit(0);
        }
        return y
            .version(false)
            .strict(false)
            .parserConfiguration({
            'unknown-options-as-args': true,
            'populate--': true,
        })
            .usage('')
            .help(false)
            .showHelpOnFail(false);
    },
    handler: async (args) => {
        await (await (0, handle_import_1.handleImport)('./mcp.js', __dirname)).mcpHandler(args);
        process.exit(0);
    },
};
