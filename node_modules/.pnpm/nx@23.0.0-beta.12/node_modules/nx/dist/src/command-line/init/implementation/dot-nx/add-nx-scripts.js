"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nxWrapperPath = void 0;
exports.generateDotNxSetup = generateDotNxSetup;
exports.normalizeVersionForNxJson = normalizeVersionForNxJson;
exports.writeMinimalNxJson = writeMinimalNxJson;
exports.updateGitIgnore = updateGitIgnore;
exports.getNxWrapperContents = getNxWrapperContents;
exports.getShellScriptContents = getShellScriptContents;
exports.getBatchScriptContents = getBatchScriptContents;
exports.sanitizeWrapperScript = sanitizeWrapperScript;
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path = tslib_1.__importStar(require("path"));
const semver_1 = require("semver");
const tree_1 = require("../../../../generators/tree");
const json_1 = require("../../../../generators/utils/json");
const nxWrapperPath = (p = path) => p.join('.nx', 'nxw.js');
exports.nxWrapperPath = nxWrapperPath;
const NODE_MISSING_ERR = 'Nx requires NodeJS to be available. To install NodeJS and NPM, see: https://nodejs.org/en/download/ .';
const NPM_MISSING_ERR = 'Nx requires npm to be available. To install NodeJS and NPM, see: https://nodejs.org/en/download/ .';
const BATCH_SCRIPT_CONTENTS = [
    // don't log command to console
    `@ECHO OFF`,
    // Prevents path_to_root from being inherited by child processes
    `SETLOCAL`,
    `SET path_to_root=%~dp0`,
    // Checks if node is available
    `WHERE node >nul 2>nul`,
    `IF %ERRORLEVEL% NEQ 0 (ECHO ${NODE_MISSING_ERR} & GOTO exit)`,
    // Checks if npm is available
    `WHERE npm >nul 2>nul`,
    `IF %ERRORLEVEL% NEQ 0 (ECHO ${NPM_MISSING_ERR} & GOTO exit)`,
    // Executes the nx wrapper script
    `node ${path.win32.join('%path_to_root%', (0, exports.nxWrapperPath)(path.win32))} %*`,
    // Exits with the same error code as the previous command
    `:exit`,
    `  cmd /c exit /b %ERRORLEVEL%`,
].join('\r\n');
const SHELL_SCRIPT_CONTENTS = [
    // Execute in bash
    `#!/bin/bash`,
    // Checks if node is available
    `command -v node >/dev/null 2>&1 || { echo >&2 "${NODE_MISSING_ERR}"; exit 1; }`,
    // Checks if npm is available
    `command -v npm >/dev/null 2>&1 || { echo >&2 "${NPM_MISSING_ERR}"; exit 1; }`,
    // Gets the path to the root of the project
    `path_to_root=$(dirname $BASH_SOURCE)`,
    // Executes the nx wrapper script
    `node ${path.posix.join('$path_to_root', (0, exports.nxWrapperPath)(path.posix))} "$@"`,
].join('\n');
function generateDotNxSetup(version) {
    const host = new tree_1.FsTree(process.cwd(), false, '.nx setup');
    writeMinimalNxJson(host, version);
    updateGitIgnore(host);
    host.write((0, exports.nxWrapperPath)(), getNxWrapperContents());
    host.write('nx.bat', BATCH_SCRIPT_CONTENTS);
    host.write('nx', SHELL_SCRIPT_CONTENTS, {
        mode: fs_1.constants.S_IXUSR | fs_1.constants.S_IRUSR | fs_1.constants.S_IWUSR,
    });
    const changes = host.listChanges();
    (0, tree_1.printChanges)(changes);
    (0, tree_1.flushChanges)(host.root, changes);
    // Ensure that the dot-nx installation is available.
    // This is needed when using a global nx with dot-nx, otherwise running any nx command using global command will fail due to missing modules.
    // Pipe stderr so failures surface in telemetry instead of bare "Command failed: ./nx --version".
    try {
        (0, child_process_1.execSync)('./nx --version', {
            stdio: ['ignore', 'ignore', 'pipe'],
            encoding: 'utf8',
            windowsHide: true,
        });
    }
    catch (e) {
        if (e?.stderr)
            process.stderr.write(e.stderr);
        throw e;
    }
}
function normalizeVersionForNxJson(pkg, version) {
    if (!(0, semver_1.valid)(version)) {
        version = (0, child_process_1.execSync)(`npm view ${pkg}@${version} version`, {
            windowsHide: true,
        }).toString();
    }
    return version.trimEnd();
}
function writeMinimalNxJson(host, version) {
    if (!host.exists('nx.json')) {
        (0, json_1.writeJson)(host, 'nx.json', {
            installation: {
                version: normalizeVersionForNxJson('nx', version),
            },
        });
    }
}
function updateGitIgnore(host) {
    let contents = host.read('.gitignore', 'utf-8') ?? '';
    [
        '.nx/installation',
        '.nx/cache',
        '.nx/workspace-data',
        '.nx/self-healing',
    ].forEach((file) => {
        if (!contents.includes(file)) {
            contents = [contents, file].join('\n');
        }
    });
    host.write('.gitignore', contents);
}
// Gets the sanitized contents for nxw.js
function getNxWrapperContents() {
    return sanitizeWrapperScript((0, fs_1.readFileSync)(path.join(__dirname, 'nxw.js'), 'utf-8'));
}
// Gets the contents for the nx bash script
function getShellScriptContents() {
    return SHELL_SCRIPT_CONTENTS;
}
// Gets the contents for the nx.bat batch script
function getBatchScriptContents() {
    return BATCH_SCRIPT_CONTENTS;
}
// Remove any empty comments or comments that start with `//#: ` or eslint-disable comments.
// This removes the sourceMapUrl since it is invalid, as well as any internal comments.
function sanitizeWrapperScript(input) {
    const linesToRemove = [
        // Comments that start with //#
        '\\/\\/# .*',
        // Comments that are empty (often used for newlines between internal comments)
        '\\s*\\/\\/\\s*',
        // Comments that disable an eslint rule.
        '\\/\\/ eslint-disable-next-line.*',
    ];
    const regex = `(${linesToRemove.join('|')})$`;
    return input.replace(new RegExp(regex, 'gm'), '');
}
