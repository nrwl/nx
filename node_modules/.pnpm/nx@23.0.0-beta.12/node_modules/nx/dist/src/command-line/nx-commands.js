"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandsObject = exports.parserConfiguration = void 0;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const yargs = tslib_1.__importStar(require("yargs"));
const analytics_1 = require("../analytics");
const output_1 = require("../utils/output");
const command_object_1 = require("./add/command-object");
const command_object_2 = require("./affected/command-object");
const command_object_3 = require("./configure-ai-agents/command-object");
const command_object_4 = require("./daemon/command-object");
const command_objects_1 = require("./deprecated/command-objects");
const command_object_5 = require("./exec/command-object");
const command_object_6 = require("./format/command-object");
const command_object_7 = require("./generate/command-object");
const command_object_8 = require("./graph/command-object");
const command_object_9 = require("./import/command-object");
const command_object_10 = require("./init/command-object");
const command_object_11 = require("./list/command-object");
const command_object_12 = require("./mcp/command-object");
const command_object_13 = require("./migrate/command-object");
const command_object_14 = require("./new/command-object");
const command_object_15 = require("./nx-cloud/apply-locally/command-object");
const command_object_16 = require("./nx-cloud/complete-run/command-object");
const command_object_17 = require("./nx-cloud/connect/command-object");
const command_object_18 = require("./nx-cloud/download-cloud-client/command-object");
const command_object_19 = require("./nx-cloud/fix-ci/command-object");
const command_object_20 = require("./nx-cloud/login/command-object");
const command_object_21 = require("./nx-cloud/logout/command-object");
const command_object_22 = require("./nx-cloud/record/command-object");
const command_object_23 = require("./nx-cloud/start-agent/command-object");
const command_object_24 = require("./nx-cloud/start-ci-run/command-object");
const command_object_25 = require("./register/command-object");
const command_object_26 = require("./release/command-object");
const command_object_27 = require("./repair/command-object");
const command_object_28 = require("./report/command-object");
const command_object_29 = require("./reset/command-object");
const command_object_30 = require("./run-many/command-object");
const command_object_31 = require("./run/command-object");
const command_object_32 = require("./show/command-object");
const command_object_33 = require("./sync/command-object");
const command_object_34 = require("./watch/command-object");
// Ensure that the output takes up the available width of the terminal.
yargs.wrap(yargs.terminalWidth());
exports.parserConfiguration = {
    'strip-dashed': true,
};
/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * be executed correctly.
 */
exports.commandsObject = yargs
    .parserConfiguration(exports.parserConfiguration)
    .usage(pc.bold('Smart Monorepos · Fast Builds'))
    .demandCommand(1, '')
    .command(command_object_25.yargsRegisterCommand)
    .command(command_object_1.yargsAddCommand)
    .command(command_object_3.yargsConfigureAiAgentsCommand)
    .command(command_object_2.yargsAffectedBuildCommand)
    .command(command_object_2.yargsAffectedCommand)
    .command(command_object_2.yargsAffectedE2ECommand)
    .command(command_object_2.yargsAffectedLintCommand)
    .command(command_object_2.yargsAffectedTestCommand)
    .command(command_objects_1.yargsAffectedGraphCommand)
    .command(command_object_17.yargsConnectCommand)
    .command(command_object_4.yargsDaemonCommand)
    .command(command_object_8.yargsGraphCommand)
    .command(command_object_5.yargsExecCommand)
    .command(command_object_6.yargsFormatCheckCommand)
    .command(command_object_6.yargsFormatWriteCommand)
    .command(command_object_7.yargsGenerateCommand)
    .command(command_object_9.yargsImportCommand)
    .command(command_object_10.yargsInitCommand)
    .command(command_object_13.yargsInternalMigrateCommand)
    .command(command_object_11.yargsListCommand)
    .command(command_object_13.yargsMigrateCommand)
    .command(command_object_14.yargsNewCommand)
    .command(command_objects_1.yargsPrintAffectedCommand)
    .command(command_object_26.yargsReleaseCommand)
    .command(command_object_27.yargsRepairCommand)
    .command(command_object_28.yargsReportCommand)
    .command(command_object_29.yargsResetCommand)
    .command(command_object_31.yargsRunCommand)
    .command(command_object_30.yargsRunManyCommand)
    .command(command_object_32.yargsShowCommand)
    .command(command_object_33.yargsSyncCommand)
    .command(command_object_33.yargsSyncCheckCommand)
    .command(command_object_17.yargsViewLogsCommand)
    .command(command_object_34.yargsWatchCommand)
    .command(command_object_31.yargsNxInfixCommand)
    .command(command_object_20.yargsLoginCommand)
    .command(command_object_21.yargsLogoutCommand)
    .command(command_object_22.yargsRecordCommand)
    .command(command_object_24.yargsStartCiRunCommand)
    .command(command_object_23.yargsStartAgentCommand)
    .command(command_object_16.yargsStopAllAgentsCommand)
    .command(command_object_19.yargsFixCiCommand)
    .command(command_object_15.yargsApplyLocallyCommand)
    .command(command_object_18.yargsDownloadCloudClientCommand)
    .command(command_object_12.yargsMcpCommand)
    .command(resolveConformanceCommandObject())
    .command(resolveConformanceCheckCommandObject())
    .scriptName('nx')
    .middleware((args) => {
    const context = exports.commandsObject.getInternalMethods().getContext();
    const command = (context.commands ?? []).join(' ') ||
        (args._ ?? []).slice(0, 1).join(' ');
    if (command) {
        (0, analytics_1.reportCommandRunEvent)(command, undefined, args);
    }
})
    .help(false)
    // NOTE: we handle --version in nx.ts, this just tells yargs that the option exists
    // so that it shows up in help. The default yargs implementation of --version is not
    // hit, as the implementation in nx.ts is hit first and calls process.exit(0).
    .version();
function createMissingConformanceCommand(command) {
    return {
        command,
        // Hide from --help output in the common case of not having the plugin installed
        describe: false,
        handler: () => {
            output_1.output.error({
                title: `${command} is not available`,
                bodyLines: [
                    `In order to use the \`nx ${command}\` command you must have an active Nx key and the \`@nx/conformance\` plugin installed.`,
                    '',
                    'To learn more, visit https://nx.dev/nx-enterprise/powerpack/conformance',
                ],
            });
            process.exit(1);
        },
    };
}
function resolveConformanceCommandObject() {
    try {
        const { yargsConformanceCommand } = (() => {
            try {
                return require('@nx/powerpack-conformance');
            }
            catch {
                return require('@nx/conformance');
            }
        })();
        return yargsConformanceCommand;
    }
    catch {
        return createMissingConformanceCommand('conformance');
    }
}
function resolveConformanceCheckCommandObject() {
    try {
        const { yargsConformanceCheckCommand } = (() => {
            try {
                return require('@nx/powerpack-conformance');
            }
            catch {
                return require('@nx/conformance');
            }
        })();
        return yargsConformanceCheckCommand;
    }
    catch {
        return createMissingConformanceCommand('conformance:check');
    }
}
