"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = void 0;
exports.orange = orange;
const tslib_1 = require("tslib");
const os_1 = require("os");
const pc = tslib_1.__importStar(require("picocolors"));
const readline = tslib_1.__importStar(require("readline"));
const GH_GROUP_PREFIX = '::group::';
const GH_GROUP_SUFFIX = '::endgroup::';
/**
 * Custom orange color using ANSI 256-color code 214.
 * picocolors does not support keyword-based colors like chalk,
 * so orange is implemented manually.
 */
function orange(text) {
    return pc.isColorSupported ? `\x1b[38;5;214m${text}\x1b[39m` : String(text);
}
/**
 * Map of color names to picocolors functions, used for dynamic color access.
 */
const pcColors = {
    cyan: pc.cyan,
    red: pc.red,
    yellow: pc.yellow,
    green: pc.green,
    gray: pc.gray,
    white: pc.white,
    blue: pc.blue,
    magenta: pc.magenta,
    orange,
};
class CLIOutput {
    constructor() {
        this.cliName = 'NX';
        this.formatCommand = (taskId) => `${pc.dim('nx run')} ${taskId}`;
        /**
         * Expose some color and other utility functions so that other parts of the codebase that need
         * more fine-grained control of message bodies are still using a centralized
         * implementation.
         */
        this.colors = {
            gray: pc.gray,
            green: pc.green,
            red: pc.red,
            cyan: pc.cyan,
            white: pc.white,
            orange,
        };
        this.bold = pc.bold;
        this.underline = pc.underline;
        this.dim = pc.dim;
    }
    /**
     * Longer dash character which forms more of a continuous line when place side to side
     * with itself, unlike the standard dash character
     */
    get VERTICAL_SEPARATOR() {
        let divider = '';
        for (let i = 0; i < process.stdout.columns - 1; i++) {
            divider += '\u2014';
        }
        return divider;
    }
    writeToStream(str, stream = process.stdout) {
        stream.write(str);
    }
    overwriteLine(lineText = '') {
        // Ensure we always start writing from column 0.
        readline.cursorTo(process.stdout, 0);
        // this replaces the existing text up to the new line length
        process.stdout.write(lineText);
        // clear whatever text might be left to the right of the cursor (happens
        // when existing text was longer than new one)
        readline.clearLine(process.stdout, 1);
        // Move to the next line and re-anchor to column 0 without relying on
        // terminal newline translation behavior.
        process.stdout.write('\n');
        readline.cursorTo(process.stdout, 0);
    }
    writeOutputTitle({ color, title, }, stream = process.stdout) {
        this.writeToStream(`${this.applyNxPrefix(color, title)}${os_1.EOL}`, stream);
    }
    writeOptionalOutputBody(bodyLines, stream = process.stdout) {
        if (!bodyLines) {
            return;
        }
        this.addNewline(stream);
        bodyLines.forEach((bodyLine) => this.writeToStream(`${bodyLine}${os_1.EOL}`, stream));
    }
    applyNxPrefix(color = 'cyan', text) {
        const colorFn = pcColors[color] || ((t) => t);
        const nxPrefix = pc.inverse(pc.bold(colorFn(` ${this.cliName} `)));
        return `${nxPrefix}  ${text}`;
    }
    addNewline(stream = process.stdout) {
        this.writeToStream(os_1.EOL, stream);
    }
    addVerticalSeparator(color = 'gray') {
        this.addNewline();
        this.addVerticalSeparatorWithoutNewLines(color);
        this.addNewline();
    }
    addVerticalSeparatorWithoutNewLines(color = 'gray') {
        this.writeToStream(`${this.getVerticalSeparator(color)}${os_1.EOL}`);
    }
    getVerticalSeparatorLines(color = 'gray') {
        return ['', this.getVerticalSeparator(color), ''];
    }
    getVerticalSeparator(color) {
        const colorFn = pcColors[color] || ((t) => t);
        return pc.dim(colorFn(this.VERTICAL_SEPARATOR));
    }
    error({ title, slug, bodyLines }) {
        const stream = process.stderr;
        this.addNewline(stream);
        this.writeOutputTitle({
            color: 'red',
            title: pc.red(title),
        }, stream);
        this.writeOptionalOutputBody(bodyLines, stream);
        /**
         * Optional slug to be used in an Nx error message redirect URL
         */
        if (slug && typeof slug === 'string') {
            this.addNewline(stream);
            this.writeToStream(`${pc.gray('  Learn more about this error: ')}https://errors.nx.dev/${slug}${os_1.EOL}`, stream);
        }
        this.addNewline(stream);
    }
    warn({ title, slug, bodyLines }) {
        this.addNewline(process.stderr);
        this.writeOutputTitle({
            color: 'yellow',
            title: pc.yellow(title),
        }, process.stderr);
        this.writeOptionalOutputBody(bodyLines, process.stderr);
        /**
         * Optional slug to be used in an Nx warning message redirect URL
         */
        if (slug && typeof slug === 'string') {
            this.addNewline(process.stderr);
            this.writeToStream(`${pc.gray('  Learn more about this warning: ')}https://errors.nx.dev/${slug}${os_1.EOL}`, process.stderr);
        }
        this.addNewline(process.stderr);
    }
    note({ title, bodyLines }) {
        this.addNewline();
        this.writeOutputTitle({
            color: 'orange',
            title: orange(title),
        });
        this.writeOptionalOutputBody(bodyLines);
        this.addNewline();
    }
    success({ title, bodyLines }) {
        this.addNewline();
        this.writeOutputTitle({
            color: 'green',
            title: pc.green(title),
        });
        this.writeOptionalOutputBody(bodyLines);
        this.addNewline();
    }
    logSingleLine(message) {
        this.addNewline();
        this.writeOutputTitle({
            color: 'gray',
            title: message,
        });
        this.addNewline();
    }
    logRawLine(message) {
        this.writeToStream(`${message}${os_1.EOL}`);
        this.addNewline();
    }
    logCommand(message, taskStatus) {
        this.addNewline();
        this.writeToStream(this.getCommandWithStatus(message, taskStatus));
        this.addNewline();
        this.addNewline();
    }
    logCommandOutput(message, taskStatus, output) {
        let commandOutputWithStatus = this.getCommandWithStatus(message, taskStatus);
        if (process.env.NX_SKIP_LOG_GROUPING !== 'true' &&
            process.env.GITHUB_ACTIONS) {
            const icon = this.getStatusIcon(taskStatus);
            commandOutputWithStatus = `${GH_GROUP_PREFIX}${icon} ${commandOutputWithStatus}`;
        }
        this.addNewline();
        this.writeToStream(commandOutputWithStatus);
        this.addNewline();
        this.addNewline();
        this.writeToStream(output);
        if (process.env.NX_SKIP_LOG_GROUPING !== 'true' &&
            process.env.GITHUB_ACTIONS) {
            this.writeToStream(GH_GROUP_SUFFIX);
        }
    }
    getCommandWithStatus(message, taskStatus) {
        const commandOutput = pc.dim('> ') + this.formatCommand(this.normalizeMessage(message));
        return this.addTaskStatus(taskStatus, commandOutput);
    }
    getStatusIcon(taskStatus) {
        switch (taskStatus) {
            case 'success':
                return '✅';
            case 'failure':
                return '❌';
            case 'skipped':
            case 'local-cache-kept-existing':
                return '⏩';
            case 'local-cache':
            case 'remote-cache':
                return '🔁';
        }
    }
    normalizeMessage(message) {
        if (message.startsWith('nx run ')) {
            return message.substring('nx run '.length);
        }
        else if (message.startsWith('run ')) {
            return message.substring('run '.length);
        }
        else {
            return message;
        }
    }
    addTaskStatus(taskStatus, commandOutput) {
        if (taskStatus === 'local-cache') {
            return `${commandOutput}  ${pc.dim('[local cache]')}`;
        }
        else if (taskStatus === 'remote-cache') {
            return `${commandOutput}  ${pc.dim('[remote cache]')}`;
        }
        else if (taskStatus === 'local-cache-kept-existing') {
            return `${commandOutput}  ${pc.dim('[existing outputs match the cache, left as is]')}`;
        }
        else {
            return commandOutput;
        }
    }
    log({ title, bodyLines, color }) {
        this.addNewline();
        const colorFn = color ? pcColors[color] : undefined;
        this.writeOutputTitle({
            color: 'cyan',
            title: colorFn ? colorFn(title) : title,
        });
        this.writeOptionalOutputBody(bodyLines);
        this.addNewline();
    }
    drain() {
        return new Promise((resolve) => {
            if (process.stdout.writableNeedDrain) {
                process.stdout.once('drain', resolve);
            }
            else {
                resolve();
            }
        });
    }
}
exports.output = new CLIOutput();
