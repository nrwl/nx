"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getColor = getColor;
exports.formatPrefixedLines = formatPrefixedLines;
exports.writePrefixedLines = writePrefixedLines;
exports.addPrefixTransformer = addPrefixTransformer;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const os_1 = require("os");
const stream_1 = require("stream");
const colors = [
    pc.green,
    pc.greenBright,
    pc.blue,
    pc.blueBright,
    pc.cyan,
    pc.cyanBright,
    pc.yellow,
    pc.yellowBright,
    pc.magenta,
    pc.magentaBright,
];
function getColor(projectName) {
    let code = 0;
    for (let i = 0; i < projectName.length; ++i) {
        code += projectName.charCodeAt(i);
    }
    const colorIndex = code % colors.length;
    return colors[colorIndex];
}
/**
 * Formats a chunk by splitting it into lines and optionally prepending a prefix.
 * Returns an array of formatted line strings (including EOL).
 */
function formatPrefixedLines(chunk, prefix) {
    const lines = chunk.toString().split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/g);
    const result = [];
    for (const line of lines) {
        if (line) {
            result.push(prefix ? prefix + ' ' + line + os_1.EOL : line + os_1.EOL);
        }
    }
    return result;
}
/**
 * Splits a chunk into lines, optionally prepends a prefix, and writes each
 * non-empty line to the given writable (defaults to `process.stdout`).
 */
function writePrefixedLines(chunk, prefix, writable = process.stdout) {
    for (const line of formatPrefixedLines(chunk, prefix)) {
        writable.write(line);
    }
}
function addPrefixTransformer(prefix) {
    return new stream_1.Transform({
        transform(chunk, _encoding, callback) {
            for (const line of formatPrefixedLines(chunk, prefix)) {
                this.push(line);
            }
            callback();
        },
    });
}
