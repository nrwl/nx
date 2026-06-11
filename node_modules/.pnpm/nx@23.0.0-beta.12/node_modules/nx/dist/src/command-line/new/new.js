"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newWorkspace = newWorkspace;
const tree_1 = require("../../generators/tree");
const params_1 = require("../../utils/params");
const handle_errors_1 = require("../../utils/handle-errors");
const generator_utils_1 = require("../generate/generator-utils");
function removeSpecialFlags(generatorOptions) {
    delete generatorOptions.interactive;
    delete generatorOptions.help;
    delete generatorOptions.verbose;
    delete generatorOptions['--'];
    delete generatorOptions['$0'];
}
async function newWorkspace(cwd, args) {
    return (0, handle_errors_1.handleErrors)(process.env.NX_VERBOSE_LOGGING === 'true' || args.verbose, async () => {
        const isInteractive = args.interactive;
        const { normalizedGeneratorName, schema, implementationFactory } = (0, generator_utils_1.getGeneratorInformation)('@nx/workspace/generators.json', 'new', null, {});
        removeSpecialFlags(args);
        const combinedOpts = await (0, params_1.combineOptionsForGenerator)(args, '@nx/workspace/generators.json', normalizedGeneratorName, null, null, schema, isInteractive, null, null, false);
        const host = new tree_1.FsTree(cwd, false, 'nx new');
        const implementation = implementationFactory();
        const task = await implementation(host, combinedOpts);
        (0, tree_1.flushChanges)(cwd, host.listChanges());
        host.lock();
        if (task) {
            await task();
        }
    });
}
