"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNxToTurborepo = addNxToTurborepo;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const fileutils_1 = require("../../../utils/fileutils");
const handle_import_1 = require("../../../utils/handle-import");
const output_1 = require("../../../utils/output");
const package_manager_1 = require("../../../utils/package-manager");
const utils_1 = require("./utils");
async function addNxToTurborepo(_options) {
    const repoRoot = process.cwd();
    output_1.output.log({
        title: 'Initializing Nx based on your old Turborepo configuration',
    });
    output_1.output.log({
        title: '💡 Did you know?',
        bodyLines: [
            '- Turborepo requires you to maintain all your common scripts like "build", "lint", "test" in all your packages, as well as their applicable cache inputs and outputs.',
            `- Nx is extensible and has plugins for the tools you use to infer all of this for you purely based on that tool's configuration file within your packages.`,
            '',
            '  - E.g. the `@nx/vite` plugin will infer the "build" script based on the existence of a vite.config.js file.',
            '  - Therefore with zero package level config, `nx build my-app` knows to run the `vite build` CLI directly, with all Nx cache inputs and outputs automatically inferred.',
            '',
            `NOTE: None of your existing package.json scripts will be modified as part of this initialization process, you can already use them as-is with Nx, but you can learn more about the benefits of Nx's inferred tasks at https://nx.dev/concepts/inferred-tasks`,
        ],
    });
    let nxJson = (0, utils_1.createNxJsonFromTurboJson)((0, fileutils_1.readJsonFile)('turbo.json'));
    const nxJsonPath = (0, node_path_1.join)(repoRoot, 'nx.json');
    // Turborepo workspaces usually have prettier installed, so try and match the formatting before writing the file
    try {
        const prettier = await (0, handle_import_1.handleImport)('prettier');
        const config = await prettier.resolveConfig(repoRoot);
        (0, node_fs_1.writeFileSync)(nxJsonPath, 
        // @ts-ignore - Always await prettier.format, in modern versions it's async
        await prettier.format(JSON.stringify(nxJson, null, 2), {
            ...(config ?? {}),
            parser: 'json',
        }));
    }
    catch (err) {
        // Apply fallback JSON write
        (0, fileutils_1.writeJsonFile)(nxJsonPath, nxJson);
    }
    const pmc = (0, package_manager_1.getPackageManagerCommand)();
    (0, utils_1.updateGitIgnore)(repoRoot);
    (0, utils_1.addDepsToPackageJson)(repoRoot);
    output_1.output.log({ title: '📦 Installing dependencies' });
    (0, utils_1.runInstall)(repoRoot, pmc);
}
