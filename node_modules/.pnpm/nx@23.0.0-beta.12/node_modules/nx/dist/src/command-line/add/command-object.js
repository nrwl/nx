"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yargsAddCommand = void 0;
const handle_import_1 = require("../../utils/handle-import");
const shared_options_1 = require("../yargs-utils/shared-options");
exports.yargsAddCommand = {
    command: 'add <packageSpecifier>',
    describe: 'Install a plugin and initialize it.',
    builder: (yargs) => (0, shared_options_1.withVerbose)(yargs)
        .parserConfiguration({
        'strip-dashed': true,
        'unknown-options-as-args': true,
    })
        .positional('packageSpecifier', {
        type: 'string',
        description: 'The package name and optional version (e.g. `@nx/react` or `@nx/react@latest`) to install and initialize. If the version is not specified it will install the same version as the `nx` package for Nx core plugins or the latest version for other packages.',
    })
        .option('updatePackageScripts', {
        type: 'boolean',
        description: 'Update `package.json` scripts with inferred targets. Defaults to `true` when the package is a core Nx plugin.',
    })
        .example('$0 add @nx/react', 'Install the latest version of the `@nx/react` package and run its `@nx/react:init` generator')
        .example('$0 add non-core-nx-plugin', 'Install the latest version of the `non-core-nx-plugin` package and run its `non-core-nx-plugin:init` generator if available')
        .example('$0 add @nx/react@17.0.0', 'Install version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator'),
    handler: async (args) => {
        process.exit(await (0, handle_import_1.handleImport)('./add.js', __dirname).then((m) => m.addHandler((0, shared_options_1.withOverrides)(args))));
    },
};
