"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LARGE_BUFFER = void 0;
exports.default = default_1;
exports.runCommands = runCommands;
exports.interpolateArgsIntoCommand = interpolateArgsIntoCommand;
const tslib_1 = require("tslib");
const yargs_parser_1 = tslib_1.__importDefault(require("yargs-parser"));
const is_tui_enabled_1 = require("../../tasks-runner/is-tui-enabled");
const pseudo_terminal_1 = require("../../tasks-runner/pseudo-terminal");
const utils_1 = require("../../tasks-runner/utils");
const noop_child_process_1 = require("../../tasks-runner/running-tasks/noop-child-process");
const running_tasks_1 = require("./running-tasks");
const shell_quoting_1 = require("../../utils/shell-quoting");
exports.LARGE_BUFFER = 1024 * 1000000;
const propKeys = [
    'command',
    'commands',
    'color',
    'no-color',
    'parallel',
    'no-parallel',
    'readyWhen',
    'cwd',
    'args',
    'envFile',
    '__unparsed__',
    'env',
    'usePty',
    'streamOutput',
    'verbose',
    'forwardAllArgs',
    'tty',
];
async function default_1(options, context) {
    const task = await runCommands(options, context);
    const results = await task.getResults();
    return {
        ...results,
        success: results.code === 0,
    };
}
async function runCommands(options, context, taskId) {
    const normalized = normalizeOptions(options);
    if (normalized.readyWhenStatus.length && !normalized.parallel) {
        throw new Error('ERROR: Bad executor config for run-commands - "readyWhen" can only be used when "parallel=true".');
    }
    if (options.commands.find((c) => c.prefix || c.prefixColor || c.color || c.bgColor) &&
        !options.parallel) {
        throw new Error('ERROR: Bad executor config for run-commands - "prefix", "prefixColor", "color" and "bgColor" can only be set when "parallel=true".');
    }
    // Handle empty commands array - return immediately with success
    if (normalized.commands.length === 0) {
        return new noop_child_process_1.NoopChildProcess({ code: 0, terminalOutput: '' });
    }
    const isSingleCommand = normalized.commands.length === 1;
    const usePseudoTerminal = (isSingleCommand || !options.parallel) && pseudo_terminal_1.PseudoTerminal.isSupported();
    const isSingleCommandAndCanUsePseudoTerminal = isSingleCommand &&
        usePseudoTerminal &&
        process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
        !normalized.commands[0].prefix &&
        normalized.usePty;
    const tuiEnabled = (0, is_tui_enabled_1.isTuiEnabled)();
    try {
        const resolvedTaskId = taskId ??
            (0, utils_1.createTaskId)(context.projectName, context.targetName, context.configurationName);
        const runningTask = isSingleCommandAndCanUsePseudoTerminal
            ? await (0, running_tasks_1.runSingleCommandWithPseudoTerminal)(normalized, context, resolvedTaskId)
            : options.parallel
                ? new running_tasks_1.ParallelRunningTasks(normalized, context, resolvedTaskId)
                : new running_tasks_1.SeriallyRunningTasks(normalized, context, tuiEnabled, resolvedTaskId);
        return runningTask;
    }
    catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
            console.error(e);
        }
        throw new Error(`ERROR: Something went wrong in run-commands - ${e.message}`);
    }
}
function normalizeOptions(options) {
    if (options.readyWhen && typeof options.readyWhen === 'string') {
        options.readyWhenStatus = [
            { stringToMatch: options.readyWhen, found: false },
        ];
    }
    else {
        options.readyWhenStatus =
            options.readyWhen?.map((stringToMatch) => ({
                stringToMatch,
                found: false,
            })) ?? [];
    }
    if (options.command) {
        options.commands = [
            {
                command: Array.isArray(options.command)
                    ? options.command.join(' ')
                    : options.command,
            },
        ];
        options.parallel = options.readyWhenStatus?.length > 0;
    }
    else {
        options.commands = options.commands.map((c) => typeof c === 'string' ? { command: c } : c);
    }
    if (options.args && Array.isArray(options.args)) {
        options.args = options.args.join(' ');
    }
    const unparsedCommandArgs = (0, yargs_parser_1.default)(options.__unparsed__, {
        configuration: {
            'parse-numbers': false,
            'parse-positional-numbers': false,
            'dot-notation': false,
            'camel-case-expansion': false,
        },
    });
    options.unknownOptions = Object.keys(options)
        .filter((p) => propKeys.indexOf(p) === -1 && unparsedCommandArgs[p] === undefined)
        .reduce((m, c) => ((m[c] = options[c]), m), {});
    options.parsedArgs = parseArgs(unparsedCommandArgs, options.unknownOptions, options.args);
    options.unparsedCommandArgs = unparsedCommandArgs;
    options.commands.forEach((c) => {
        c.command = interpolateArgsIntoCommand(c.command, options, c.forwardAllArgs ?? options.forwardAllArgs ?? true);
    });
    return options;
}
function interpolateArgsIntoCommand(command, opts, forwardAllArgs) {
    if (command.indexOf('{args.') > -1 && command.indexOf('{args}') > -1) {
        throw new Error('Command should not contain both {args} and {args.*} values. Please choose one to use.');
    }
    if (command.indexOf('{args.') > -1) {
        const regex = /{args\.([^}]+)}/g;
        return command.replace(regex, (_, group) => opts.parsedArgs[group] !== undefined ? opts.parsedArgs[group] : '');
    }
    else if (command.indexOf('{args}') > -1) {
        const regex = /{args}/g;
        const args = [
            ...unknownOptionsToArgsArray(opts),
            ...unparsedOptionsToArgsArray(opts),
        ];
        const argsString = `${args.join(' ')} ${opts.args ?? ''}`;
        return command.replace(regex, argsString);
    }
    else if (forwardAllArgs) {
        let args = '';
        if (Object.keys(opts.unknownOptions ?? {}).length > 0) {
            const unknownOptionsArgs = unknownOptionsToArgsArray(opts).join(' ');
            if (unknownOptionsArgs) {
                args += ` ${unknownOptionsArgs}`;
            }
        }
        if (opts.args) {
            args += ` ${opts.args}`;
        }
        if (opts.__unparsed__?.length > 0) {
            const filteredParsedOptions = unparsedOptionsToArgsArray(opts);
            if (filteredParsedOptions.length > 0) {
                args += ` ${filteredParsedOptions.join(' ')}`;
            }
        }
        return `${command}${args}`;
    }
    else {
        return command;
    }
}
function unknownOptionsToArgsArray(opts) {
    return Object.keys(opts.unknownOptions ?? {})
        .filter((k) => typeof opts.unknownOptions[k] !== 'object' &&
        opts.parsedArgs[k] === opts.unknownOptions[k])
        .map((k) => `--${k}=${opts.unknownOptions[k]}`)
        .map(wrapArgIntoQuotesIfNeeded);
}
function unparsedOptionsToArgsArray(opts) {
    const filteredParsedOptions = filterPropKeysFromUnParsedOptions(opts.__unparsed__, opts.parsedArgs);
    if (filteredParsedOptions.length > 0) {
        return rejoinQuotedFragments(filteredParsedOptions).map(wrapArgIntoQuotesIfNeeded);
    }
    return [];
}
/**
 * Rejoin shell word-split fragments of quoted values.
 *
 * When a CLI arg like --config \'{"env":"val"}\' is passed through execSync,
 * the shell word-splits on spaces, producing separate argv entries:
 *   ['--config', '\'{"env":"i', 'am', 'here"}\'']
 *
 * These fragments need to be rejoined before quoting logic processes them,
 * otherwise individual fragments get incorrectly re-quoted.
 */
function rejoinQuotedFragments(args) {
    const result = [];
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        const quoteChar = arg.length > 1 && (arg[0] === "'" || arg[0] === '"') ? arg[0] : null;
        if (quoteChar && !arg.endsWith(quoteChar)) {
            // Start of a word-split quoted value — collect until closing quote
            const fragments = [arg];
            let found = false;
            i++;
            while (i < args.length) {
                fragments.push(args[i]);
                if (args[i].endsWith(quoteChar)) {
                    found = true;
                    i++;
                    break;
                }
                i++;
            }
            if (found) {
                result.push(fragments.join(' '));
            }
            else {
                // No matching close quote — push fragments as-is
                result.push(...fragments);
            }
        }
        else {
            result.push(arg);
            i++;
        }
    }
    return result;
}
function parseArgs(unparsedCommandArgs, unknownOptions, args) {
    if (!args) {
        return { ...unknownOptions, ...unparsedCommandArgs };
    }
    return {
        ...unknownOptions,
        ...(0, yargs_parser_1.default)(args.replace(/(^"|"$)/g, ''), {
            configuration: { 'camel-case-expansion': true },
        }),
        ...unparsedCommandArgs,
    };
}
/**
 * This function filters out the prop keys from the unparsed options
 * @param __unparsed__ e.g. ['--prop1', 'value1', '--prop2=value2', '--args=test']
 * @param unparsedCommandArgs e.g. { prop1: 'value1', prop2: 'value2', args: 'test'}
 * @returns filtered options that are not part of the propKeys array e.g. ['--prop1', 'value1', '--prop2=value2']
 */
function filterPropKeysFromUnParsedOptions(__unparsed__, parseArgs = {}) {
    const parsedOptions = [];
    for (let index = 0; index < __unparsed__.length; index++) {
        const element = __unparsed__[index];
        if (element.startsWith('--')) {
            const key = element.replace('--', '');
            if (element.includes('=')) {
                // key can be in the format of --key=value or --key.subkey=value (e.g. env.foo=bar)
                if (!propKeys.includes(key.split('=')[0].split('.')[0])) {
                    // check if the key is part of the propKeys array
                    parsedOptions.push(element);
                }
            }
            else {
                // check if the next element is a value for the key
                if (propKeys.includes(key)) {
                    if (index + 1 < __unparsed__.length &&
                        parseArgs[key] &&
                        __unparsed__[index + 1].toString() === parseArgs[key].toString()) {
                        index++; // skip the next element
                    }
                }
                else {
                    parsedOptions.push(element);
                }
            }
        }
        else {
            parsedOptions.push(element);
        }
    }
    return parsedOptions;
}
function wrapArgIntoQuotesIfNeeded(arg) {
    if (arg.includes('=')) {
        // Split only on first '=' to handle values containing '='
        const eqIndex = arg.indexOf('=');
        const key = arg.substring(0, eqIndex);
        const value = arg.substring(eqIndex + 1);
        if (key.startsWith('--') &&
            (0, shell_quoting_1.needsShellQuoting)(value) &&
            !(0, shell_quoting_1.isAlreadyQuoted)(value)) {
            // Escape any existing double quotes in the value before wrapping
            const escaped = value.replace(/"/g, '\\"');
            return `${key}="${escaped}"`;
        }
        return arg;
    }
    else if ((0, shell_quoting_1.needsShellQuoting)(arg) && !(0, shell_quoting_1.isAlreadyQuoted)(arg)) {
        // Escape any existing double quotes in the value before wrapping
        const escaped = arg.replace(/"/g, '\\"');
        return `"${escaped}"`;
    }
    else {
        return arg;
    }
}
