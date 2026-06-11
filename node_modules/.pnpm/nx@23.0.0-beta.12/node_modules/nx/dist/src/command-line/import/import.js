"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importHandler = importHandler;
const tslib_1 = require("tslib");
const path_1 = require("path");
const node_fs_1 = require("node:fs");
const pc = tslib_1.__importStar(require("picocolors"));
const git_utils_1 = require("../../utils/git-utils");
const promises_1 = require("node:fs/promises");
const tmp_1 = require("tmp");
const enquirer_1 = require("enquirer");
const output_1 = require("../../utils/output");
const createSpinner = require('ora');
const init_v2_1 = require("../init/init-v2");
const nx_json_1 = require("../../config/nx-json");
const fileutils_1 = require("../../utils/fileutils");
const workspace_root_1 = require("../../utils/workspace-root");
const package_manager_1 = require("../../utils/package-manager");
const workspace_context_1 = require("../../utils/workspace-context");
const utils_1 = require("../init/implementation/utils");
const command_line_utils_1 = require("../../utils/command-line-utils");
const prepare_source_repo_1 = require("./utils/prepare-source-repo");
const merge_remote_source_1 = require("./utils/merge-remote-source");
const minimatch_1 = require("minimatch");
const configure_plugins_1 = require("../init/configure-plugins");
const check_compatible_with_plugins_1 = require("../init/implementation/check-compatible-with-plugins");
const native_1 = require("../../native");
const ai_output_1 = require("./utils/ai-output");
const init_v2_2 = require("../init/init-v2");
const importRemoteName = '__tmp_nx_import__';
async function importHandler(options) {
    process.env.NX_RUNNING_NX_IMPORT = 'true';
    let { sourceRepository, ref, source, destination, verbose } = options;
    const aiMode = (0, native_1.isAiAgent)();
    if (aiMode) {
        options.interactive = false;
        (0, ai_output_1.logProgress)('starting', 'Importing repository...');
        // Check for missing required arguments — report all at once
        const missingFields = [];
        if (!sourceRepository)
            missingFields.push('sourceRepository');
        if (!ref)
            missingFields.push('ref');
        if (!destination)
            missingFields.push('destination');
        if (missingFields.length > 0) {
            (0, ai_output_1.writeAiOutput)((0, ai_output_1.buildImportNeedsOptionsResult)(missingFields, sourceRepository));
            process.exit(0);
        }
        // Check if this is a plugin-only call (second step of two-step flow)
        if (destination && options.plugins) {
            const absDestAi = (0, path_1.join)(process.cwd(), destination);
            const destGitClient = new git_utils_1.GitRepository(process.cwd());
            const destFiles = await destGitClient.getGitFiles(absDestAi);
            if (destFiles.length > 0) {
                // Destination not empty + --plugins provided + AI mode = plugin-only mode
                return await handlePluginOnlyMode(options, destGitClient, verbose);
            }
        }
    }
    const destinationGitClient = new git_utils_1.GitRepository(process.cwd());
    if (await destinationGitClient.hasUncommittedChanges()) {
        throw new Error(`You have uncommitted changes in the destination repository. Commit or revert the changes and try again.`);
    }
    if (!aiMode) {
        output_1.output.log({
            title: 'Nx will walk you through the process of importing code from the source repository into this repository:',
            bodyLines: [
                `1. Nx will clone the source repository into a temporary directory`,
                `2. The project code from the sourceDirectory will be moved to the destinationDirectory on a temporary branch in this repository`,
                `3. The temporary branch will be merged into the current branch in this repository`,
                `4. Nx will recommend plugins to integrate any new tools used in the imported code`,
                '',
                `Git history will be preserved during this process as long as you MERGE these changes. Do NOT squash and do NOT rebase the changes when merging branches.  If you would like to UNDO these changes, run "git reset HEAD~1 --hard"`,
            ],
        });
    }
    const tempImportDirectory = (0, path_1.join)(tmp_1.tmpdir, 'nx-import');
    if (!sourceRepository) {
        sourceRepository = (await (0, enquirer_1.prompt)([
            {
                type: 'input',
                name: 'sourceRepository',
                message: 'What is the URL of the repository you want to import? (This can be a local git repository or a git remote URL)',
                required: true,
            },
        ])).sourceRepository;
    }
    try {
        const maybeLocalDirectory = await (0, promises_1.stat)(sourceRepository);
        if (maybeLocalDirectory.isDirectory()) {
            sourceRepository = (0, path_1.resolve)(sourceRepository);
        }
    }
    catch (e) {
        // It's a remote url
    }
    const sourceTempRepoPath = (0, path_1.join)(tempImportDirectory, 'repo');
    let spinner;
    if (aiMode) {
        (0, ai_output_1.logProgress)('cloning', `Cloning ${sourceRepository} into ${sourceTempRepoPath}...`);
    }
    else {
        spinner = createSpinner(`Cloning ${sourceRepository} into a temporary directory: ${sourceTempRepoPath} (Use --depth to limit commit history and speed up clone times)`).start();
    }
    try {
        await (0, promises_1.rm)(tempImportDirectory, { recursive: true });
    }
    catch { }
    await (0, promises_1.mkdir)(tempImportDirectory, { recursive: true });
    let sourceGitClient;
    try {
        sourceGitClient = await (0, git_utils_1.cloneFromUpstream)(sourceRepository, sourceTempRepoPath, {
            originName: importRemoteName,
            depth: options.depth,
        });
    }
    catch (e) {
        if (!aiMode) {
            spinner.fail(`Failed to clone ${sourceRepository} into ${sourceTempRepoPath}`);
        }
        let errorMessage = `Failed to clone ${sourceRepository} into ${sourceTempRepoPath}. Please double check the remote and try again.\n${e.message}`;
        throw new Error(errorMessage);
    }
    if (!aiMode) {
        spinner.succeed(`Cloned into ${sourceTempRepoPath}`);
    }
    // Detecting the package manager before preparing the source repo for import.
    const sourcePackageManager = (0, package_manager_1.detectPackageManager)(sourceGitClient.root);
    if (!ref) {
        if (aiMode) {
            throw new Error('The --ref option is required when running in agent mode.');
        }
        const branchChoices = await sourceGitClient.listBranches();
        ref = (await (0, enquirer_1.prompt)([
            {
                type: 'autocomplete',
                name: 'ref',
                message: `Which branch do you want to import?`,
                choices: branchChoices,
                /**
                 * Limit the number of choices so that it fits on screen
                 */
                limit: process.stdout.rows - 3,
                required: true,
            },
        ])).ref;
    }
    if (!source) {
        if (aiMode) {
            // Default to importing the entire repository in agent mode
            source = '.';
        }
        else {
            source = (await (0, enquirer_1.prompt)([
                {
                    type: 'input',
                    name: 'source',
                    message: `Which directory do you want to import into this workspace? (leave blank to import the entire repository)`,
                },
            ])).source;
        }
    }
    if (!destination) {
        if (aiMode) {
            throw new Error('The --destination option is required when running in agent mode.');
        }
        destination = (await (0, enquirer_1.prompt)([
            {
                type: 'input',
                name: 'destination',
                message: 'Where in this workspace should the code be imported into?',
                required: true,
                initial: source ? source : undefined,
            },
        ])).destination;
    }
    const absSource = (0, path_1.join)(sourceTempRepoPath, source);
    if ((0, path_1.isAbsolute)(destination)) {
        throw new Error(`The destination directory must be a relative path in this repository.`);
    }
    const absDestination = (0, path_1.join)(process.cwd(), destination);
    await assertDestinationEmpty(destinationGitClient, absDestination);
    const tempImportBranch = getTempImportBranch(ref);
    await sourceGitClient.addFetchRemote(importRemoteName, ref);
    await sourceGitClient.fetch(importRemoteName, ref);
    if (!aiMode) {
        spinner.succeed(`Fetched ${ref} from ${sourceRepository}`);
        spinner.start(`Checking out a temporary branch, ${tempImportBranch} based on ${ref}`);
    }
    await sourceGitClient.checkout(tempImportBranch, {
        new: true,
        base: `${importRemoteName}/${ref}`,
    });
    if (!aiMode) {
        spinner.succeed(`Created a ${tempImportBranch} branch based on ${ref}`);
    }
    try {
        await (0, promises_1.stat)(absSource);
    }
    catch (e) {
        throw new Error(`The source directory ${source} does not exist in ${sourceRepository}. Please double check to make sure it exists.`);
    }
    const packageManager = (0, package_manager_1.detectPackageManager)(workspace_root_1.workspaceRoot);
    const sourceIsNxWorkspace = (0, node_fs_1.existsSync)((0, path_1.join)(sourceGitClient.root, 'nx.json'));
    const relativeDestination = (0, path_1.relative)(destinationGitClient.root, absDestination);
    if (aiMode) {
        (0, ai_output_1.logProgress)('filtering', 'Filtering git history...');
    }
    await (0, prepare_source_repo_1.prepareSourceRepo)(sourceGitClient, ref, source, relativeDestination, tempImportBranch, sourceRepository);
    await createTemporaryRemote(destinationGitClient, (0, path_1.join)(sourceTempRepoPath, '.git'), importRemoteName);
    if (aiMode) {
        (0, ai_output_1.logProgress)('merging', 'Merging into workspace...');
    }
    await (0, merge_remote_source_1.mergeRemoteSource)(destinationGitClient, sourceRepository, tempImportBranch, destination, importRemoteName, ref);
    if (!aiMode) {
        spinner.start('Cleaning up temporary files and remotes');
    }
    await (0, promises_1.rm)(tempImportDirectory, { recursive: true });
    await destinationGitClient.deleteGitRemote(importRemoteName);
    if (!aiMode) {
        spinner.succeed('Cleaned up temporary files and remotes');
    }
    const pmc = (0, package_manager_1.getPackageManagerCommand)();
    const nxJson = (0, nx_json_1.readNxJson)(workspace_root_1.workspaceRoot);
    (0, workspace_context_1.resetWorkspaceContext)();
    let packageJson;
    try {
        packageJson = (0, fileutils_1.readJsonFile)('package.json');
    }
    catch {
        packageJson = null;
    }
    let plugins;
    let updatePackageScripts;
    let detectedButNotInstalled;
    if (aiMode) {
        (0, ai_output_1.logProgress)('detecting-plugins', 'Checking for recommended plugins...');
        const parsedPlugins = parsePluginsFlag(options.plugins);
        if (parsedPlugins === 'skip') {
            plugins = [];
            updatePackageScripts = false;
        }
        else if (parsedPlugins === 'all') {
            const detected = await (0, init_v2_1.detectPlugins)(nxJson, packageJson, false, true);
            plugins = detected.plugins;
            updatePackageScripts = detected.updatePackageScripts;
        }
        else if (Array.isArray(parsedPlugins)) {
            plugins = parsedPlugins;
            updatePackageScripts = true;
        }
        else {
            // No --plugins flag: detect and report, let agent decide
            const detected = await (0, init_v2_1.detectPlugins)(nxJson, packageJson, false, true);
            if (detected.plugins.length > 0) {
                detectedButNotInstalled = detected.plugins;
            }
            plugins = [];
            updatePackageScripts = false;
        }
    }
    else {
        const detected = await (0, init_v2_1.detectPlugins)(nxJson, packageJson, options.interactive, true);
        plugins = detected.plugins;
        updatePackageScripts = detected.updatePackageScripts;
    }
    if (!aiMode && packageManager !== sourcePackageManager) {
        output_1.output.warn({
            title: `Mismatched package managers`,
            bodyLines: [
                `The source repository is using a different package manager (${sourcePackageManager}) than this workspace (${packageManager}).`,
                `This could lead to install issues due to discrepancies in "package.json" features.`,
            ],
        });
    }
    await handleMissingWorkspacesEntry(packageManager, pmc, relativeDestination, destinationGitClient);
    let installed = await runInstallDestinationRepo(packageManager, destinationGitClient);
    if (installed) {
        // Check compatibility with existing plugins for the workspace included new imported projects
        if (nxJson.plugins?.length > 0) {
            const incompatiblePlugins = await (0, check_compatible_with_plugins_1.checkCompatibleWithPlugins)();
            if (Object.keys(incompatiblePlugins).length > 0) {
                (0, check_compatible_with_plugins_1.updatePluginsInNxJson)(workspace_root_1.workspaceRoot, incompatiblePlugins);
                await destinationGitClient.amendCommit();
            }
        }
        if (plugins.length > 0) {
            installed = await runPluginsInstall(plugins, pmc, destinationGitClient);
            if (installed) {
                const { succeededPlugins } = await (0, configure_plugins_1.configurePlugins)(plugins, updatePackageScripts, pmc, workspace_root_1.workspaceRoot, verbose);
                if (succeededPlugins.length > 0) {
                    await destinationGitClient.amendCommit();
                }
            }
        }
    }
    console.log(await destinationGitClient.showStat());
    if (!aiMode && installed === false) {
        const pmc = (0, package_manager_1.getPackageManagerCommand)(packageManager);
        output_1.output.warn({
            title: `The import was successful, but the install failed`,
            bodyLines: [
                `You may need to run "${pmc.install}" manually to resolve the issue. The error is logged above.`,
            ],
        });
        if (plugins.length > 0) {
            output_1.output.error({
                title: `Failed to install plugins`,
                bodyLines: [
                    'The following plugins were not installed:',
                    ...plugins.map((p) => `- ${pc.bold(p)}`),
                ],
            });
            output_1.output.error({
                title: `To install the plugins manually`,
                bodyLines: [
                    'You may need to run commands to install the plugins:',
                    ...plugins.map((p) => `- ${pc.bold(pmc.exec + ' nx add ' + p)}`),
                ],
            });
        }
    }
    if (!aiMode && source != destination) {
        output_1.output.warn({
            title: `Check configuration files`,
            bodyLines: [
                `The source directory (${source}) and destination directory (${destination}) are different.`,
                `You may need to update configuration files to match the directory in this repository.`,
                sourceIsNxWorkspace
                    ? `For example, path options in project.json such as "main", "tsConfig", and "outputPath" need to be updated.`
                    : `For example, relative paths in tsconfig.json and other tooling configuration files may need to be updated.`,
            ],
        });
    }
    // When only a subdirectory is imported, there might be devDependencies in the root package.json file
    // that needs to be ported over as well.
    if (!aiMode && ref) {
        output_1.output.log({
            title: `Check root dependencies`,
            bodyLines: [
                `"dependencies" and "devDependencies" are not imported from the source repository (${sourceRepository}).`,
                `You may need to add some of those dependencies to this workspace in order to run tasks successfully.`,
            ],
        });
    }
    if (!aiMode) {
        output_1.output.log({
            title: `Merging these changes into ${(0, command_line_utils_1.getBaseRef)(nxJson)}`,
            bodyLines: [
                `MERGE these changes when merging these changes.`,
                `Do NOT squash these commits when merging these changes.`,
                `If you rebase, make sure to use "--rebase-merges" to preserve merge commits.`,
                `To UNDO these changes, run "git reset HEAD~1 --hard"`,
            ],
        });
    }
    if (aiMode) {
        if (detectedButNotInstalled && detectedButNotInstalled.length > 0) {
            // Import is done but plugins need selection — return needs_input
            (0, ai_output_1.writeAiOutput)((0, ai_output_1.buildImportNeedsPluginSelectionResult)({
                detectedPlugins: detectedButNotInstalled.map((name) => ({
                    name,
                    reason: (0, init_v2_2.getPluginReason)(name),
                })),
                sourceRepository,
                ref,
                source: source || '.',
                destination,
            }));
        }
        else {
            const warnings = [];
            if (packageManager !== sourcePackageManager) {
                warnings.push({
                    type: 'package_manager_mismatch',
                    message: `Source uses ${sourcePackageManager}, workspace uses ${packageManager}`,
                    hint: 'Check for package.json feature discrepancies',
                });
            }
            if (source !== destination) {
                warnings.push({
                    type: 'config_path_mismatch',
                    message: `Source directory (${source}) differs from destination (${destination})`,
                    hint: 'Update relative paths in configuration files (tsconfig.json, project.json, etc.)',
                });
            }
            if (ref) {
                warnings.push({
                    type: 'missing_root_deps',
                    message: 'Root dependencies and devDependencies are not imported',
                    hint: 'Manually add required dependencies from the source repository',
                });
            }
            if (!installed) {
                warnings.push({
                    type: 'install_failed',
                    message: 'Package installation failed after import',
                    hint: `Run "${pmc.install}" manually to resolve`,
                });
            }
            (0, ai_output_1.writeAiOutput)((0, ai_output_1.buildImportSuccessResult)({
                sourceRepository,
                ref,
                source: source || '.',
                destination,
                pluginsInstalled: plugins.filter(() => installed),
                warnings: warnings.length > 0 ? warnings : undefined,
            }));
        }
    }
}
async function assertDestinationEmpty(gitClient, absDestination) {
    const files = await gitClient.getGitFiles(absDestination);
    if (files.length > 0) {
        throw new Error(`Destination directory ${absDestination} is not empty. Please make sure it is empty before importing into it.`);
    }
}
/**
 * Handle the plugin-only mode (second call in two-step AI flow).
 * Destination already has imported code, just install plugins.
 */
async function handlePluginOnlyMode(options, destinationGitClient, verbose) {
    (0, ai_output_1.logProgress)('installing-plugins', 'Installing plugins for imported project...');
    const pmc = (0, package_manager_1.getPackageManagerCommand)();
    const nxJson = (0, nx_json_1.readNxJson)(workspace_root_1.workspaceRoot);
    let packageJson;
    try {
        packageJson = (0, fileutils_1.readJsonFile)('package.json');
    }
    catch {
        packageJson = null;
    }
    const parsedPlugins = parsePluginsFlag(options.plugins);
    let plugins;
    let updatePackageScripts;
    if (parsedPlugins === 'skip') {
        plugins = [];
        updatePackageScripts = false;
    }
    else if (parsedPlugins === 'all') {
        const detected = await (0, init_v2_1.detectPlugins)(nxJson, packageJson, false, true);
        plugins = detected.plugins;
        updatePackageScripts = detected.updatePackageScripts;
    }
    else if (Array.isArray(parsedPlugins)) {
        plugins = parsedPlugins;
        updatePackageScripts = true;
    }
    else {
        plugins = [];
        updatePackageScripts = false;
    }
    if (plugins.length > 0) {
        const installed = await runPluginsInstall(plugins, pmc, destinationGitClient);
        if (installed) {
            const { succeededPlugins } = await (0, configure_plugins_1.configurePlugins)(plugins, updatePackageScripts, pmc, workspace_root_1.workspaceRoot, verbose);
            if (succeededPlugins.length > 0) {
                await destinationGitClient.amendCommit();
            }
        }
    }
    (0, ai_output_1.writeAiOutput)((0, ai_output_1.buildImportSuccessResult)({
        sourceRepository: options.sourceRepository,
        ref: options.ref,
        source: options.source || '.',
        destination: options.destination,
        pluginsInstalled: plugins,
    }));
}
function getTempImportBranch(sourceBranch) {
    return `__nx_tmp_import__/${sourceBranch}`;
}
async function createTemporaryRemote(destinationGitClient, sourceRemoteUrl, remoteName) {
    try {
        await destinationGitClient.deleteGitRemote(remoteName);
    }
    catch { }
    await destinationGitClient.addGitRemote(remoteName, sourceRemoteUrl);
    await destinationGitClient.fetch(remoteName);
}
/**
 * Run install for the imported code and plugins
 * @returns true if the install failed
 */
async function runInstallDestinationRepo(packageManager, destinationGitClient) {
    let installed = true;
    try {
        output_1.output.log({
            title: 'Installing dependencies for imported code',
        });
        (0, utils_1.runInstall)(workspace_root_1.workspaceRoot, (0, package_manager_1.getPackageManagerCommand)(packageManager));
        await destinationGitClient.amendCommit();
    }
    catch (e) {
        installed = false;
        output_1.output.error({
            title: `Install failed: ${e.message || 'Unknown error'}`,
            bodyLines: [e.stack],
        });
    }
    return installed;
}
async function runPluginsInstall(plugins, pmc, destinationGitClient) {
    let installed = true;
    output_1.output.log({ title: 'Installing Plugins' });
    try {
        (0, configure_plugins_1.installPluginPackages)(workspace_root_1.workspaceRoot, pmc, plugins);
        await destinationGitClient.amendCommit();
    }
    catch (e) {
        installed = false;
        output_1.output.error({
            title: `Install failed: ${e.message || 'Unknown error'}`,
            bodyLines: [
                'The following plugins were not installed:',
                ...plugins.map((p) => `- ${pc.bold(p)}`),
                e.stack,
            ],
        });
        output_1.output.error({
            title: `To install the plugins manually`,
            bodyLines: [
                'You may need to run commands to install the plugins:',
                ...plugins.map((p) => `- ${pc.bold(pmc.exec + ' nx add ' + p)}`),
            ],
        });
    }
    return installed;
}
function parsePluginsFlag(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === 'skip') {
        return 'skip';
    }
    if (value === 'all') {
        return 'all';
    }
    return value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
}
/*
 * If the user imports a project that isn't in the workspaces entry, we should add that path to the workspaces entry.
 */
async function handleMissingWorkspacesEntry(pm, pmc, pkgPath, destinationGitClient) {
    if (!(0, package_manager_1.isWorkspacesEnabled)(pm, workspace_root_1.workspaceRoot)) {
        output_1.output.warn({
            title: `Missing workspaces in package.json`,
            bodyLines: pm === 'npm'
                ? [
                    `We recommend enabling NPM workspaces to install dependencies for the imported project.`,
                    `Add \`"workspaces": ["${pkgPath}"]\` to package.json and run "${pmc.install}".`,
                    `See: https://docs.npmjs.com/cli/using-npm/workspaces`,
                ]
                : pm === 'yarn'
                    ? [
                        `We recommend enabling Yarn workspaces to install dependencies for the imported project.`,
                        `Add \`"workspaces": ["${pkgPath}"]\` to package.json and run "${pmc.install}".`,
                        `See: https://yarnpkg.com/features/workspaces`,
                    ]
                    : pm === 'bun'
                        ? [
                            `We recommend enabling Bun workspaces to install dependencies for the imported project.`,
                            `Add \`"workspaces": ["${pkgPath}"]\` to package.json and run "${pmc.install}".`,
                            `See: https://bun.sh/docs/install/workspaces`,
                        ]
                        : [
                            `We recommend enabling PNPM workspaces to install dependencies for the imported project.`,
                            `Add the following entry to to pnpm-workspace.yaml and run "${pmc.install}":`,
                            pc.bold(`packages:\n  - '${pkgPath}'`),
                            `See: https://pnpm.io/workspaces`,
                        ],
        });
    }
    else {
        let workspaces = (0, package_manager_1.getPackageWorkspaces)(pm, workspace_root_1.workspaceRoot);
        const isPkgIncluded = workspaces.some((w) => (0, minimatch_1.minimatch)(pkgPath, w));
        if (isPkgIncluded) {
            return;
        }
        (0, package_manager_1.addPackagePathToWorkspaces)(pkgPath, pm, workspaces, workspace_root_1.workspaceRoot);
        await destinationGitClient.amendCommit();
        output_1.output.success({
            title: `Project added in workspaces`,
            bodyLines: pm === 'npm' || pm === 'yarn' || pm === 'bun'
                ? [
                    `The imported project (${pc.bold(pkgPath)}) is missing the "workspaces" field in package.json.`,
                    `Added "${pc.bold(pkgPath)}" to workspaces.`,
                ]
                : [
                    `The imported project (${pc.bold(pkgPath)}) is missing the "packages" field in pnpm-workspaces.yaml.`,
                    `Added "${pc.bold(pkgPath)}" to packages.`,
                ],
        });
    }
}
