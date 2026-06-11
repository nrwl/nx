"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showTargetOutputsHandler = showTargetOutputsHandler;
const utils_1 = require("../../../tasks-runner/utils");
const workspace_root_1 = require("../../../utils/workspace-root");
const utils_2 = require("./utils");
// ── Handler ─────────────────────────────────────────────────────────
async function showTargetOutputsHandler(args) {
    const t = await (0, utils_2.resolveTarget)(args);
    const outputsData = resolveOutputsData(t);
    if (args.check !== undefined) {
        const checkItems = (0, utils_2.deduplicateFolderEntries)(args.check);
        const results = checkItems.map((o) => resolveCheckOutputData(o, outputsData));
        if (results.length >= 2) {
            renderBatchCheckOutputs(results, outputsData.project, outputsData.target);
        }
        else {
            for (const data of results)
                renderCheckOutput(data);
        }
        for (const data of results) {
            process.exitCode ||=
                data.matchedOutput ||
                    data.containedOutputPaths.length ||
                    data.containedExpandedOutputs.length
                    ? 0
                    : 1;
        }
        return;
    }
    renderOutputs(outputsData, args);
}
function resolveOutputsData(t) {
    const { projectName, targetName, configuration, node } = t;
    const resolvedOutputs = (0, utils_1.getOutputsForTargetAndConfiguration)({ project: projectName, target: targetName, configuration }, {}, node);
    const targetConfig = node.data.targets?.[targetName];
    const configuredOutputs = targetConfig?.outputs ?? [];
    const mergedOptions = {
        ...targetConfig?.options,
        ...(configuration
            ? targetConfig?.configurations?.[configuration]
            : undefined),
    };
    const unresolvedOutputs = configuredOutputs.filter((o) => {
        if (!/\{options\./.test(o))
            return false;
        const unresolved = o.match(/\{options\.([^}]+)\}/g);
        return unresolved?.some((token) => {
            const key = token.slice('{options.'.length, -1);
            return mergedOptions[key] === undefined;
        });
    });
    let expandedOutputs;
    try {
        const { expandOutputs } = require('../../../native');
        expandedOutputs = expandOutputs(workspace_root_1.workspaceRoot, resolvedOutputs);
    }
    catch {
        expandedOutputs = resolvedOutputs;
    }
    return {
        project: projectName,
        target: targetName,
        outputPaths: resolvedOutputs,
        expandedOutputs,
        unresolvedOutputs,
    };
}
function resolveCheckOutputData(rawFileToCheck, outputsData) {
    const fileToCheck = (0, utils_2.normalizePath)(rawFileToCheck);
    const { outputPaths, expandedOutputs } = outputsData;
    let matchedOutput = null;
    for (const outputPath of outputPaths) {
        const normalizedOutput = outputPath.replace(/\\/g, '/');
        if (fileToCheck === normalizedOutput ||
            fileToCheck.startsWith(normalizedOutput + '/')) {
            matchedOutput = outputPath;
            break;
        }
    }
    if (!matchedOutput && expandedOutputs.includes(fileToCheck)) {
        matchedOutput = fileToCheck;
    }
    let containedOutputPaths = [];
    let containedExpandedOutputs = [];
    if (!matchedOutput) {
        if (fileToCheck === '') {
            containedOutputPaths = [...outputPaths];
            containedExpandedOutputs = [...expandedOutputs];
        }
        else {
            const dirPrefix = fileToCheck.endsWith('/')
                ? fileToCheck
                : fileToCheck + '/';
            containedOutputPaths = outputPaths.filter((o) => o.replace(/\\/g, '/').startsWith(dirPrefix));
            containedExpandedOutputs = expandedOutputs.filter((o) => o.replace(/\\/g, '/').startsWith(dirPrefix));
        }
    }
    return {
        value: rawFileToCheck,
        file: fileToCheck,
        project: outputsData.project,
        target: outputsData.target,
        matchedOutput,
        containedOutputPaths,
        containedExpandedOutputs,
    };
}
// ── Render ──────────────────────────────────────────────────────────
function renderOutputs(data, args) {
    if (args.json) {
        const jsonData = data;
        const result = {};
        for (const [k, v] of Object.entries(jsonData)) {
            if (Array.isArray(v) && v.length === 0)
                continue;
            result[k] = v;
        }
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    const c = (0, utils_2.pc)();
    console.log(`${c.bold('Output paths for')} ${c.cyan(data.project)}:${c.green(data.target)}`);
    if (data.outputPaths.length > 0) {
        (0, utils_2.printList)('Configured outputs', data.outputPaths);
    }
    if (data.expandedOutputs.length > 0) {
        (0, utils_2.printList)('Resolved outputs', data.expandedOutputs);
    }
    if (data.unresolvedOutputs.length > 0) {
        (0, utils_2.printList)(`${c.yellow('Unresolved outputs')} (option not set)`, data.unresolvedOutputs);
    }
    if (data.outputPaths.length === 0 && data.unresolvedOutputs.length === 0) {
        console.log(`\n  No outputs configured for this target.`);
    }
}
function renderCheckOutput(data) {
    const c = (0, utils_2.pc)();
    const displayPath = data.value || data.file;
    if (data.matchedOutput) {
        console.log(`${c.green('✓')} ${c.bold(displayPath)} is an output of ${c.cyan(data.project)}:${c.green(data.target)}`);
    }
    else if (data.containedOutputPaths.length > 0 ||
        data.containedExpandedOutputs.length > 0) {
        const uniquePaths = new Set([
            ...data.containedOutputPaths,
            ...data.containedExpandedOutputs,
        ]);
        console.log(`${c.yellow('~')} ${c.bold(displayPath)} is a directory containing ${c.bold(String(uniquePaths.size))} output path(s) for ${c.cyan(data.project)}:${c.green(data.target)}`);
        const extraExpanded = data.containedExpandedOutputs.filter((o) => !data.containedOutputPaths.includes(o));
        if (extraExpanded.length > 0) {
            (0, utils_2.printList)('Expanded outputs', extraExpanded);
        }
    }
    else {
        console.log(`${c.red('✗')} ${c.bold(displayPath)} is ${c.red('not')} an output of ${c.cyan(data.project)}:${c.green(data.target)}`);
    }
}
function renderBatchCheckOutputs(results, projectName, targetName) {
    const c = (0, utils_2.pc)();
    const label = `${c.cyan(projectName)}:${c.green(targetName)}`;
    const matched = [];
    const directories = [];
    const unmatched = [];
    for (const r of results) {
        if (r.matchedOutput) {
            matched.push(r.value);
        }
        else {
            const uniqueCount = new Set([
                ...r.containedOutputPaths,
                ...r.containedExpandedOutputs,
            ]).size;
            if (uniqueCount > 0) {
                directories.push({ value: r.file, count: uniqueCount });
            }
            else {
                unmatched.push(r.value);
            }
        }
    }
    if (matched.length > 0 || directories.length > 0) {
        console.log(`\n${c.green('✓')} These arguments were outputs of ${label}:`);
        for (const v of matched)
            console.log(`  ${v}`);
        for (const d of directories) {
            console.log(`  ${d.value} (directory containing ${d.count} output paths)`);
        }
    }
    if (unmatched.length > 0) {
        console.log(`\n${c.red('✗')} These arguments were ${c.red('not')} outputs of ${label}:`);
        for (const v of unmatched)
            console.log(`  ${v}`);
    }
}
