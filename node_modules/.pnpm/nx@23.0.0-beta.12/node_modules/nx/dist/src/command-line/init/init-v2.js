"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initHandler = initHandler;
exports.getPluginReason = getPluginReason;
exports.detectPlugins = detectPlugins;
const fs_1 = require("fs");
const path_1 = require("path");
const enquirer_1 = require("enquirer");
const semver_1 = require("semver");
const nx_json_1 = require("../../config/nx-json");
const fileutils_1 = require("../../utils/fileutils");
const get_package_name_from_import_path_1 = require("../../utils/get-package-name-from-import-path");
const output_1 = require("../../utils/output");
const package_manager_1 = require("../../utils/package-manager");
const versions_1 = require("../../utils/versions");
const workspace_context_1 = require("../../utils/workspace-context");
const connect_to_nx_cloud_1 = require("../nx-cloud/connect/connect-to-nx-cloud");
const configure_plugins_1 = require("./configure-plugins");
const ai_agent_prompts_1 = require("./ai-agent-prompts");
const set_up_ai_agents_1 = require("../../ai/set-up-ai-agents/set-up-ai-agents");
const tree_1 = require("../../generators/tree");
const add_nx_to_monorepo_1 = require("./implementation/add-nx-to-monorepo");
const add_nx_to_npm_repo_1 = require("./implementation/add-nx-to-npm-repo");
const add_nx_to_turborepo_1 = require("./implementation/add-nx-to-turborepo");
const angular_1 = require("./implementation/angular");
const add_nx_scripts_1 = require("./implementation/dot-nx/add-nx-scripts");
const utils_1 = require("./implementation/utils");
const provenance_1 = require("../../utils/provenance");
const devkit_internals_1 = require("../../devkit-internals");
const handle_import_1 = require("../../utils/handle-import");
const native_1 = require("../../native");
const detect_ai_agent_1 = require("../../ai/detect-ai-agent");
const ab_testing_1 = require("../../utils/ab-testing");
const is_ci_1 = require("../../utils/is-ci");
const package_manager_2 = require("../../utils/package-manager");
const ai_output_1 = require("./utils/ai-output");
async function initHandler(options, inner = false) {
    // Use environment variable to force local execution
    if (process.env.NX_USE_LOCAL === 'true' || inner) {
        return await initHandlerImpl(options);
    }
    let cleanup;
    try {
        await (0, provenance_1.ensurePackageHasProvenance)('nx', 'latest');
        const packageInstallResults = (0, devkit_internals_1.installPackageToTmp)('nx', 'latest');
        cleanup = packageInstallResults.cleanup;
        let modulePath = require.resolve('nx/src/command-line/init/init-v2.js', {
            paths: [packageInstallResults.tempDir],
        });
        const module = await (0, handle_import_1.handleImport)(modulePath);
        const result = await module.initHandler(options, true);
        cleanup();
        return result;
    }
    catch (error) {
        if (cleanup) {
            cleanup();
        }
        // Fall back to local implementation
        return initHandlerImpl(options);
    }
}
async function recordInitError(error, baseMeta) {
    const errorMessage = (0, utils_1.toErrorString)(error);
    const errorCode = (0, ai_output_1.determineErrorCode)(error);
    const stderr = (0, utils_1.readErrorStderr)(error).trim();
    const telemetryMessage = (stderr ? `${errorMessage} | stderr: ${stderr.slice(-250)}` : errorMessage).slice(0, 500);
    const errorName = (0, utils_1.extractErrorName)(error, stderr);
    await (0, ab_testing_1.recordStat)({
        command: 'init',
        nxVersion: versions_1.nxVersion,
        useCloud: false,
        meta: {
            type: 'error',
            errorCode,
            errorName,
            errorMessage: telemetryMessage,
            ...baseMeta,
        },
    });
    if (baseMeta.aiAgent) {
        const errorLogPath = (0, ai_output_1.writeErrorLog)(error);
        (0, ai_output_1.writeAiOutput)((0, ai_output_1.buildErrorResult)(errorMessage, errorCode, errorLogPath));
    }
    else {
        // Restore the cursor in case the user bailed during an interactive
        // prompt. Skip for AI agents — it would corrupt NDJSON output.
        process.stdout.write('\x1b[?25h');
    }
    process.exit(1);
}
async function initHandlerImpl(options) {
    process.env.NX_RUNNING_NX_INIT = 'true';
    const baseMeta = {
        nodeVersion: process.versions.node,
        os: process.platform,
        packageManager: (0, package_manager_2.detectPackageManager)(),
        aiAgent: (0, native_1.isAiAgent)(),
        isCI: (0, is_ci_1.isCI)(),
    };
    (0, ab_testing_1.recordStat)({
        command: 'init',
        nxVersion: versions_1.nxVersion,
        useCloud: false,
        meta: { type: 'start', ...baseMeta },
    });
    try {
        return await runInit(options, baseMeta);
    }
    catch (error) {
        await recordInitError(error, baseMeta);
    }
}
async function runInit(options, baseMeta) {
    const version = process.env.NX_VERSION ?? ((0, semver_1.prerelease)(versions_1.nxVersion) ? versions_1.nxVersion : 'latest');
    if (process.env.NX_VERSION) {
        output_1.output.log({ title: `Using version ${process.env.NX_VERSION}` });
    }
    // AI agent mode: apply defaults for non-interactive operation
    const aiMode = (0, native_1.isAiAgent)();
    if (aiMode) {
        options.interactive = false; // Force non-interactive
        if (options.nxCloud === undefined) {
            options.nxCloud = false; // Default to skip Nx Cloud
        }
        // Auto-detect .nx installation for non-JS projects
        if (options.useDotNxInstallation === undefined) {
            const hasPackageJson = (0, fs_1.existsSync)('package.json');
            options.useDotNxInstallation = !hasPackageJson;
        }
        // Auto-detect and set the current AI agent for setup
        if (options.aiAgents === undefined) {
            const detectedAgent = (0, detect_ai_agent_1.detectAiAgent)();
            if (detectedAgent) {
                options.aiAgents = [detectedAgent];
            }
        }
        // Set default cacheable operations for AI mode
        // These are commonly cacheable scripts that benefit from caching
        if (options.cacheable === undefined) {
            options.cacheable = ['build', 'test', 'lint'];
        }
        (0, ai_output_1.logProgress)('starting', 'Initializing Nx...');
    }
    // TODO(jack): Remove this Angular logic once `@nx/angular` is compatible with inferred targets.
    if ((0, fs_1.existsSync)('angular.json')) {
        await (0, angular_1.addNxToAngularCliRepo)({
            ...options,
            integrated: !!options.integrated,
        });
        (0, utils_1.printFinalMessage)({
            learnMoreLink: 'https://nx.dev/technologies/angular/migration/angular',
        });
        return;
    }
    // When in an empty directory (no package.json) and the user hasn't explicitly
    // chosen a setup method, prompt them to pick between .nx and package.json setup.
    // Skip the prompt when stdin is not a TTY (e.g. CI, e2e tests) to avoid hangs.
    if (!(0, fs_1.existsSync)('package.json') &&
        !options.useDotNxInstallation &&
        options.interactive &&
        !aiMode &&
        process.stdin.isTTY) {
        const setupMode = await (0, enquirer_1.prompt)([
            {
                type: 'select',
                name: 'setupMode',
                message: 'How would you like to set up Nx in this directory?',
                choices: [
                    {
                        name: '.nx installation (recommended for non-JavaScript projects)',
                    },
                    {
                        name: 'package.json installation (recommended for JavaScript/TypeScript projects)',
                    },
                ],
            },
        ]).then((r) => r.setupMode);
        if (setupMode.startsWith('package.json')) {
            // Create a minimal package.json so the JS/TS workflow takes over
            const workspaceName = (0, path_1.basename)(process.cwd());
            (0, fileutils_1.writeJsonFile)('package.json', {
                name: workspaceName,
                version: '0.0.0',
                private: true,
            });
        }
        else {
            options.useDotNxInstallation = true;
        }
    }
    const _isNonJs = !(0, fs_1.existsSync)('package.json') || options.useDotNxInstallation;
    const packageJson = _isNonJs
        ? null
        : (0, fileutils_1.readJsonFile)('package.json');
    const _isTurborepo = (0, fs_1.existsSync)('turbo.json');
    const _isMonorepo = _isNonJs ? false : (0, utils_1.isMonorepo)(packageJson);
    // AI mode defaults to minimum setup, humans can choose
    let guided = !aiMode; // Default to minimum (false) for AI, guided (true) for humans
    if (options.interactive && !(_isTurborepo || _isNonJs)) {
        const setupType = await (0, enquirer_1.prompt)([
            {
                type: 'select',
                name: 'setupPreference',
                message: 'Would you like a minimum or guided setup?',
                choices: [{ name: 'Minimum' }, { name: 'Guided' }],
            },
        ]).then((r) => r.setupPreference);
        guided = setupType === 'Guided';
    }
    /**
     * Turborepo users must have set up individual scripts already, and we keep the transition as minimal as possible.
     * We log a message during the conversion process in addNxToTurborepo about how they can learn more about the power
     * of Nx plugins and how it would allow them to infer all the relevant scripts automatically, including all cache
     * inputs and outputs.
     */
    if (_isTurborepo) {
        if (aiMode) {
            (0, ai_output_1.logProgress)('detecting', 'Detected Turborepo project');
        }
        await (0, add_nx_to_turborepo_1.addNxToTurborepo)({
            interactive: options.interactive,
        });
        (0, utils_1.printFinalMessage)({
            learnMoreLink: 'https://nx.dev/recipes/adopting-nx/from-turborepo',
        });
        return;
    }
    const pmc = (0, package_manager_1.getPackageManagerCommand)();
    if (_isMonorepo) {
        if (aiMode) {
            (0, ai_output_1.logProgress)('detecting', 'Detected monorepo project');
        }
        await (0, add_nx_to_monorepo_1.addNxToMonorepo)({
            interactive: options.interactive,
            nxCloud: false,
            cacheable: options.cacheable,
        }, guided);
    }
    else if (_isNonJs) {
        if (aiMode) {
            (0, ai_output_1.logProgress)('detecting', 'Detected non-JavaScript project');
        }
        (0, add_nx_scripts_1.generateDotNxSetup)(version);
        console.log('');
    }
    else {
        if (aiMode) {
            (0, ai_output_1.logProgress)('detecting', 'Detected NPM project');
        }
        await (0, add_nx_to_npm_repo_1.addNxToNpmRepo)({
            interactive: options.interactive,
            nxCloud: false,
            cacheable: options.cacheable,
        }, guided);
    }
    const repoRoot = process.cwd();
    if (aiMode) {
        (0, ai_output_1.logProgress)('configuring', 'Creating nx.json...');
    }
    (0, utils_1.createNxJsonFile)(repoRoot, [], options.cacheable ?? [], {});
    (0, utils_1.updateGitIgnore)(repoRoot);
    const nxJson = (0, nx_json_1.readNxJson)(repoRoot);
    // Handle plugins based on mode and flags
    let pluginsToInstall = [];
    let updatePackageScripts = false;
    if (aiMode) {
        // AI mode: handle --plugins flag
        const parsedPlugins = parsePluginsFlag(options.plugins);
        if (parsedPlugins === 'skip') {
            // Skip plugins entirely
            (0, ai_output_1.logProgress)('detecting', 'Skipping plugin installation');
            pluginsToInstall = [];
        }
        else {
            // Need to detect plugins for 'all' or to return needs_input
            (0, ai_output_1.logProgress)('detecting', 'Checking for recommended plugins...');
            const { plugins: detectedPluginNames } = await detectPlugins(nxJson, packageJson, false // non-interactive
            );
            if (parsedPlugins === 'all') {
                // Install all detected plugins
                pluginsToInstall = detectedPluginNames;
                updatePackageScripts = true;
            }
            else if (Array.isArray(parsedPlugins)) {
                // Install specific plugins from the comma-separated list
                pluginsToInstall = parsedPlugins;
                updatePackageScripts = true;
            }
            else if (detectedPluginNames.length > 0) {
                // No --plugins flag provided and plugins were detected
                // Return needs_input for AI to ask user
                const detectedPlugins = detectedPluginNames.map((name) => ({
                    name,
                    reason: getPluginReason(name),
                }));
                (0, ai_output_1.logProgress)('detecting', `Detected ${detectedPluginNames.length} plugin(s): ${detectedPluginNames.join(', ')}`);
                (0, ai_output_1.writeAiOutput)((0, ai_output_1.buildNeedsInputResult)(detectedPlugins));
                process.exit(0);
            }
            // else: no plugins flag and no plugins detected, proceed with empty array
        }
        if (pluginsToInstall.length > 0) {
            (0, ai_output_1.logProgress)('installing', 'Installing Nx packages...');
            for (const plugin of pluginsToInstall) {
                (0, ai_output_1.logProgress)('plugins', `Installing ${plugin}...`);
            }
            (0, configure_plugins_1.installPluginPackages)(repoRoot, pmc, pluginsToInstall);
            await (0, configure_plugins_1.configurePlugins)(pluginsToInstall, updatePackageScripts, pmc, repoRoot, options.verbose);
        }
    }
    else if (guided) {
        // Non-AI guided mode: existing behavior with interactive prompts
        output_1.output.log({ title: '🧐 Checking dependencies' });
        const { plugins: _plugins, updatePackageScripts: _updatePackageScripts } = await detectPlugins(nxJson, packageJson, options.interactive);
        pluginsToInstall = _plugins;
        updatePackageScripts = _updatePackageScripts;
        if (pluginsToInstall.length > 0) {
            output_1.output.log({ title: '📦 Installing Nx' });
            (0, configure_plugins_1.installPluginPackages)(repoRoot, pmc, pluginsToInstall);
            await (0, configure_plugins_1.configurePlugins)(pluginsToInstall, updatePackageScripts, pmc, repoRoot, options.verbose);
        }
    }
    const selectedAgents = await (0, ai_agent_prompts_1.determineAiAgents)(options.aiAgents, options.interactive && guided);
    if (selectedAgents && selectedAgents.length > 0) {
        const tree = new tree_1.FsTree(repoRoot, false);
        const aiAgentsCallback = await (0, set_up_ai_agents_1.setupAiAgentsGenerator)(tree, {
            directory: '.',
            writeNxCloudRules: options.nxCloud !== false,
            packageVersion: 'latest',
            agents: [...selectedAgents],
        });
        const changes = tree.listChanges();
        (0, tree_1.flushChanges)(repoRoot, changes);
        if (aiAgentsCallback) {
            const results = await aiAgentsCallback();
            results.messages.forEach((m) => output_1.output.log(m));
            results.errors.forEach((e) => output_1.output.error(e));
        }
    }
    let nxCloudChoice;
    if (options.nxCloud === true) {
        nxCloudChoice = 'yes';
    }
    else if (options.nxCloud === false) {
        nxCloudChoice = 'skip';
    }
    else {
        nxCloudChoice = options.interactive
            ? await (0, connect_to_nx_cloud_1.connectExistingRepoToNxCloudPrompt)()
            : 'skip';
    }
    if (nxCloudChoice === 'yes') {
        await (0, utils_1.initCloud)('nx-init');
    }
    else if (nxCloudChoice === 'never') {
        (0, utils_1.setNeverConnectToCloud)(repoRoot);
    }
    await (0, ab_testing_1.recordStat)({
        command: 'init',
        nxVersion: version,
        useCloud: nxCloudChoice === 'yes',
        meta: {
            type: 'complete',
            nxCloudArg: nxCloudChoice,
            nodeVersion: process.versions.node,
            os: process.platform,
            packageManager: (0, package_manager_2.detectPackageManager)(),
            aiAgent: aiMode,
            isCI: (0, is_ci_1.isCI)(),
            pluginsInstalled: pluginsToInstall.join(','),
        },
    });
    // Output success result for AI agents
    if (aiMode) {
        (0, ai_output_1.writeAiOutput)((0, ai_output_1.buildSuccessResult)({
            nxVersion: version,
            pluginsInstalled: pluginsToInstall,
        }));
    }
    // Skip human-readable output for AI agents
    if (!aiMode) {
        (0, utils_1.printFinalMessage)({
            learnMoreLink: 'https://nx.dev/getting-started/adding-to-existing',
            appendLines: _isMonorepo
                ? [
                    `- Read a detailed guide about adding Nx to NPM/YARN/PNPM workspaces: https://nx.dev/recipes/adopting-nx/adding-to-monorepos`,
                    `- Learn how Nx helps manage your TypeScript monorepo: https://nx.dev/features/maintain-ts-monorepos`,
                ]
                : [],
        });
    }
}
/**
 * Generate a reason for why a plugin was detected.
 * Used for AI `needs_input` output.
 */
function getPluginReason(plugin) {
    const reasonMap = {
        '@nx/eslint': 'eslint detected in dependencies',
        '@nx/storybook': 'storybook detected in dependencies',
        '@nx/vite': 'vite detected in dependencies',
        '@nx/vitest': 'vitest detected in dependencies',
        '@nx/webpack': 'webpack detected in dependencies',
        '@nx/rspack': '@rspack/core detected in dependencies',
        '@nx/rollup': 'rollup detected in dependencies',
        '@nx/jest': 'jest detected in dependencies',
        '@nx/cypress': 'cypress detected in dependencies',
        '@nx/playwright': '@playwright/test detected in dependencies',
        '@nx/detox': 'detox detected in dependencies',
        '@nx/expo': 'expo detected in dependencies',
        '@nx/next': 'next.js detected in dependencies',
        '@nx/nuxt': 'nuxt detected in dependencies',
        '@nx/react-native': 'react-native detected in dependencies',
        '@nx/remix': '@remix-run/dev detected in dependencies',
        '@nx/rsbuild': '@rsbuild/core detected in dependencies',
        '@nx/react': '@react-router/dev detected in dependencies',
        '@nx/gradle': 'gradlew detected in workspace',
        '@nx/dotnet': '.NET project files detected',
        '@nx/maven': 'maven project files detected',
        '@nx/docker': 'Dockerfile detected in workspace',
    };
    return reasonMap[plugin] || `${plugin} detected`;
}
/**
 * Parse the --plugins flag value.
 * Returns: 'skip' | 'all' | string[] (specific plugins)
 */
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
    // Comma-separated list - filter out empty strings from edge cases like "--plugins=" or "--plugins=,"
    return value
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
}
const npmPackageToPluginMap = {
    // Generic JS tools
    eslint: '@nx/eslint',
    storybook: '@nx/storybook',
    // Bundlers
    vite: '@nx/vite',
    vitest: '@nx/vitest',
    webpack: '@nx/webpack',
    '@rspack/core': '@nx/rspack',
    rollup: '@nx/rollup',
    // Testing tools
    jest: '@nx/jest',
    cypress: '@nx/cypress',
    '@playwright/test': '@nx/playwright',
    // Frameworks
    detox: '@nx/detox',
    expo: '@nx/expo',
    next: '@nx/next',
    nuxt: '@nx/nuxt',
    'react-native': '@nx/react-native',
    '@remix-run/dev': '@nx/remix',
    '@rsbuild/core': '@nx/rsbuild',
    '@react-router/dev': '@nx/react',
};
async function detectPlugins(nxJson, packageJson, interactive, includeAngularCli) {
    let files = ['package.json'].concat((0, workspace_context_1.globWithWorkspaceContextSync)(process.cwd(), ['**/*/package.json']));
    const currentPlugins = new Set((nxJson.plugins ?? []).map((p) => {
        const plugin = typeof p === 'string' ? p : p.plugin;
        return (0, get_package_name_from_import_path_1.getPackageNameFromImportPath)(plugin);
    }));
    // Also treat already-installed @nx/* and @nrwl/* packages as current plugins
    const rootDeps = {
        ...packageJson?.dependencies,
        ...packageJson?.devDependencies,
    };
    for (const dep of Object.keys(rootDeps)) {
        if (dep.startsWith('@nx/') || dep.startsWith('@nrwl/')) {
            currentPlugins.add((0, get_package_name_from_import_path_1.getPackageNameFromImportPath)(dep));
        }
    }
    const detectedPlugins = new Set();
    for (const file of files) {
        if (!(0, fs_1.existsSync)(file))
            continue;
        let packageJson;
        try {
            packageJson = (0, fileutils_1.readJsonFile)(file);
        }
        catch {
            // Could have malformed JSON for unit tests, etc.
            continue;
        }
        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };
        const _npmPackageToPluginMap = {
            ...npmPackageToPluginMap,
        };
        if (includeAngularCli) {
            _npmPackageToPluginMap['@angular/cli'] = '@nx/angular';
        }
        for (const [dep, plugin] of Object.entries(_npmPackageToPluginMap)) {
            if (deps[dep]) {
                detectedPlugins.add(plugin);
            }
        }
    }
    let gradlewFiles = ['gradlew', 'gradlew.bat'].concat((0, workspace_context_1.globWithWorkspaceContextSync)(process.cwd(), [
        '**/gradlew',
        '**/gradlew.bat',
    ]));
    if (gradlewFiles.some((f) => (0, fs_1.existsSync)(f))) {
        detectedPlugins.add('@nx/gradle');
    }
    const dotnetProjectGlobs = ['**/*.csproj', '**/*.fsproj', '**/*.vbproj'];
    const dotnetFiles = (0, workspace_context_1.globWithWorkspaceContextSync)(process.cwd(), [
        ...dotnetProjectGlobs,
    ]);
    if (dotnetFiles.length > 0) {
        detectedPlugins.add('@nx/dotnet');
    }
    let mvnwFiles = (0, workspace_context_1.globWithWorkspaceContextSync)(process.cwd(), [
        'mvnw',
        'mvnw.cmd',
        'pom.xml',
        '**/mvnw',
        '**/mvnw.cmd',
        '**/pom.xml',
    ]);
    if (mvnwFiles.length > 0) {
        detectedPlugins.add('@nx/maven');
    }
    let dockerFiles = ['Dockerfile'].concat((0, workspace_context_1.globWithWorkspaceContextSync)(process.cwd(), ['**/Dockerfile']));
    if (dockerFiles.some((f) => (0, fs_1.existsSync)(f))) {
        detectedPlugins.add('@nx/docker');
    }
    // Remove existing plugins
    for (const plugin of detectedPlugins) {
        if (currentPlugins.has(plugin)) {
            detectedPlugins.delete(plugin);
        }
    }
    const plugins = Array.from(detectedPlugins);
    if (plugins.length === 0) {
        return {
            plugins: [],
            updatePackageScripts: false,
        };
    }
    if (!interactive) {
        output_1.output.log({
            title: `Recommended Plugins:`,
            bodyLines: [
                `Adding these Nx plugins to integrate with the tools used in your workspace:`,
                ...plugins.map((p) => `- ${p}`),
            ],
        });
        return {
            plugins,
            updatePackageScripts: true,
        };
    }
    output_1.output.log({
        title: `Recommended Plugins:`,
        bodyLines: [
            `Add these Nx plugins to integrate with the tools used in your workspace.`,
        ],
    });
    const pluginsToInstall = await (0, enquirer_1.prompt)([
        {
            name: 'plugins',
            type: 'multiselect',
            message: `Which plugins would you like to add? Press <Space> to select and <Enter> to submit.`,
            choices: plugins.map((p) => ({ name: p, value: p })),
            /**
             * limit is missing from the interface but it limits the amount of options shown
             */
            limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
        },
    ]).then((r) => r.plugins);
    if (pluginsToInstall?.length === 0)
        return {
            plugins: [],
            updatePackageScripts: false,
        };
    const updatePackageScripts = (0, fs_1.existsSync)('package.json') &&
        (await (0, enquirer_1.prompt)([
            {
                name: 'updatePackageScripts',
                type: 'autocomplete',
                message: `Do you want to start using Nx in your package.json scripts?`,
                choices: [
                    {
                        name: 'Yes',
                    },
                    {
                        name: 'No',
                    },
                ],
                initial: 0,
            },
        ]).then((r) => r.updatePackageScripts === 'Yes'));
    return { plugins: pluginsToInstall, updatePackageScripts };
}
