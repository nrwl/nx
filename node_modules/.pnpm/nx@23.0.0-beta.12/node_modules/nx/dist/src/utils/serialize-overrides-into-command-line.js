"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeOverridesIntoCommandLine = serializeOverridesIntoCommandLine;
const flat_1 = require("flat");
const shell_quoting_1 = require("./shell-quoting");
function serializeOverridesIntoCommandLine(options) {
    const unparsed = options._ ? [...options._] : [];
    for (const key of Object.keys(options)) {
        const value = options[key];
        if (key !== '_') {
            serializeOption(key, value, unparsed);
        }
    }
    return unparsed;
}
function serializeOption(key, value, unparsed) {
    if (value === true) {
        unparsed.push(`--${key}`);
    }
    else if (value === false) {
        unparsed.push(`--no-${key}`);
    }
    else if (Array.isArray(value)) {
        value.forEach((item) => serializeOption(key, item, unparsed));
    }
    else if (Object.prototype.toString.call(value) === '[object Object]') {
        const flattened = (0, flat_1.flatten)(value, { safe: true });
        for (const flattenedKey in flattened) {
            serializeOption(`${key}.${flattenedKey}`, flattened[flattenedKey], unparsed);
        }
    }
    else if (typeof value === 'string' &&
        (0, shell_quoting_1.needsShellQuoting)(value) &&
        !(0, shell_quoting_1.isAlreadyQuoted)(value)) {
        const sanitized = value.replace(/"/g, String.raw `\"`);
        unparsed.push(`--${key}="${sanitized}"`);
    }
    else if (value != null) {
        unparsed.push(`--${key}=${value}`);
    }
}
