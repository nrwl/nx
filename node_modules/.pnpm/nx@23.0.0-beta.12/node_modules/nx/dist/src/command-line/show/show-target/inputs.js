"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showTargetInputsHandler = showTargetInputsHandler;
const workspace_root_1 = require("../../../utils/workspace-root");
const handle_import_1 = require("../../../utils/handle-import");
const utils_1 = require("./utils");
// ── Handler ─────────────────────────────────────────────────────────
async function showTargetInputsHandler(args) {
    const t = await (0, utils_1.resolveTarget)(args);
    const usesCustomHasher = (0, utils_1.hasCustomHasher)(t.projectName, t.targetName, t.graph);
    if (usesCustomHasher) {
        renderCustomHasherWarning(t.projectName, t.targetName, args);
        process.exitCode = 1;
        return;
    }
    const hashInputs = await resolveInputFiles(t);
    if (args.check !== undefined) {
        const checkItems = (0, utils_1.deduplicateFolderEntries)(args.check);
        const results = checkItems.map((input) => resolveCheckFromInputs(input, t.projectName, t.targetName, hashInputs));
        if (results.length >= 2) {
            renderBatchCheckInputs(results, t.projectName, t.targetName);
        }
        else {
            for (const data of results)
                renderCheckInput(data);
        }
        for (const data of results) {
            process.exitCode ||=
                data.isInput || data.containedInputFiles.length ? 0 : 1;
        }
        return;
    }
    renderInputs({ project: t.projectName, target: t.targetName, ...hashInputs }, t.node.data.targets[t.targetName].inputs, args);
}
async function resolveInputFiles(t) {
    const { projectName, targetName, configuration, graph, nxJson } = t;
    const { HashPlanInspector } = (await (0, handle_import_1.handleImport)('../../../hasher/hash-plan-inspector.js', __dirname));
    const inspector = new HashPlanInspector(graph, workspace_root_1.workspaceRoot, nxJson);
    await inspector.init();
    const plan = inspector.inspectTaskInputs({
        project: projectName,
        target: targetName,
        configuration,
    });
    const targetConfig = graph.nodes[projectName]?.data?.targets?.[targetName];
    const effectiveConfig = configuration ?? targetConfig?.defaultConfiguration;
    const taskId = effectiveConfig
        ? `${projectName}:${targetName}:${effectiveConfig}`
        : `${projectName}:${targetName}`;
    const result = plan[taskId];
    if (!result) {
        throw new Error(`Could not find hash plan for task "${taskId}". Available tasks: ${Object.keys(plan).join(', ')}`);
    }
    return result;
}
function resolveCheckFromInputs(rawValue, projectName, targetName, inputs) {
    for (const [category, arr] of [
        ['environment', inputs.environment],
        ['runtime', inputs.runtime],
        ['external', inputs.external],
        ['depOutputs', inputs.depOutputs],
    ]) {
        if (arr.includes(rawValue)) {
            return {
                value: rawValue,
                file: rawValue,
                project: projectName,
                target: targetName,
                isInput: true,
                matchedCategory: category,
                containedInputFiles: [],
            };
        }
    }
    const fileToCheck = (0, utils_1.normalizePath)(rawValue);
    const isFile = inputs.files.includes(fileToCheck);
    let containedInputFiles = [];
    if (!isFile) {
        if (fileToCheck === '') {
            containedInputFiles = inputs.files;
        }
        else {
            const dirPrefix = fileToCheck.endsWith('/')
                ? fileToCheck
                : fileToCheck + '/';
            containedInputFiles = inputs.files.filter((f) => f.startsWith(dirPrefix));
        }
    }
    return {
        value: rawValue,
        file: fileToCheck,
        project: projectName,
        target: targetName,
        isInput: isFile,
        matchedCategory: isFile || containedInputFiles.length > 0
            ? 'files'
            : null,
        containedInputFiles,
    };
}
// ── Render ──────────────────────────────────────────────────────────
function renderInputs(data, configuredInputs, args) {
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
    const c = (0, utils_1.pc)();
    console.log(`${c.bold('Inputs for')} ${c.cyan(data.project)}:${c.green(data.target)}`);
    if (configuredInputs && configuredInputs.length > 0) {
        (0, utils_1.printList)('Configured inputs', configuredInputs.map((i) => typeof i === 'string' ? i : JSON.stringify(i)));
    }
    (0, utils_1.printList)('External dependencies', [...data.external].sort());
    (0, utils_1.printList)('Runtime inputs', [...data.runtime].sort());
    (0, utils_1.printList)('Environment variables', [...data.environment].sort());
    (0, utils_1.printList)(`Files (${data.files.length})`, [...data.files, ...data.depOutputs].sort());
}
function renderCheckInput(data) {
    const c = (0, utils_1.pc)();
    const categoryLabel = data.matchedCategory
        ? ` (${data.matchedCategory})`
        : '';
    if (data.isInput) {
        console.log(`${c.green('✓')} ${c.bold(data.value)} is an input for ${c.cyan(data.project)}:${c.green(data.target)}${categoryLabel}`);
    }
    else if (data.containedInputFiles.length > 0) {
        console.log(`${c.yellow('~')} ${c.bold(data.file)} is a directory containing ${c.bold(String(data.containedInputFiles.length))} input file(s) for ${c.cyan(data.project)}:${c.green(data.target)}`);
        for (const f of [...data.containedInputFiles].sort())
            console.log(`  ${f}`);
    }
    else {
        console.log(`${c.red('✗')} ${c.bold(data.value)} is ${c.red('not')} an input for ${c.cyan(data.project)}:${c.green(data.target)}`);
    }
}
function renderBatchCheckInputs(results, projectName, targetName) {
    const c = (0, utils_1.pc)();
    const label = `${c.cyan(projectName)}:${c.green(targetName)}`;
    const matched = [];
    const directories = [];
    const unmatched = [];
    for (const r of results) {
        if (r.isInput) {
            matched.push(r.value);
        }
        else if (r.containedInputFiles.length > 0) {
            directories.push({ value: r.file, count: r.containedInputFiles.length });
        }
        else {
            unmatched.push(r.value);
        }
    }
    if (matched.length > 0 || directories.length > 0) {
        console.log(`\n${c.green('✓')} These arguments were inputs for ${label}:`);
        for (const v of matched)
            console.log(`  ${v}`);
        for (const d of directories) {
            console.log(`  ${d.value} (directory containing ${d.count} input files)`);
        }
    }
    if (unmatched.length > 0) {
        console.log(`\n${c.red('✗')} These arguments were ${c.red('not')} inputs for ${label}:`);
        for (const v of unmatched)
            console.log(`  ${v}`);
    }
}
function renderCustomHasherWarning(projectName, targetName, args) {
    const c = (0, utils_1.pc)();
    const label = `${c.cyan(projectName)}:${c.green(targetName)}`;
    if (args.json) {
        console.log(JSON.stringify({
            project: projectName,
            target: targetName,
            warning: 'This target uses a custom hasher. Configured inputs do not affect the cache hash.',
        }, null, 2));
        return;
    }
    console.log(`\n${c.yellow('⚠')} ${label} uses a ${c.yellow('custom hasher')}.`);
    console.log(`  Configured inputs do not affect the cache hash for this target.`);
    console.log(`  The executor's hasher determines what is included in the hash.`);
}
