"use strict";
/**
 * Inlined from @yarnpkg/parsers v3.0.2 to eliminate transitive dependency
 * conflicts (js-yaml -> argparse@1.x) for supply chain hardening.
 *
 * Source: https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-parsers/sources/syml.ts
 * Grammar: https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-parsers/sources/grammars/syml.pegjs
 *
 * Changes from upstream:
 * - Replaced js-yaml with @zkochan/js-yaml (already an nx dependency)
 * - Converted to TypeScript
 *
 * To update: compare against the upstream source files linked above and apply
 * any changes. The syml-grammar.js file is PEG.js-generated from syml.pegjs
 * and can be copied from the published @yarnpkg/parsers package directly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreserveOrdering = void 0;
exports.stringifySyml = stringifySyml;
exports.parseSyml = parseSyml;
const { load, FAILSAFE_SCHEMA } = require('@zkochan/js-yaml');
const { parse: parsePeg } = require('./syml-grammar');
const simpleStringPattern = /^(?![-?:,\][{}#&*!|>'"%@` \t\r\n]).([ \t]*(?![,\][{}:# \t\r\n]).)*$/;
const specialObjectKeys = [
    `__metadata`,
    `version`,
    `resolution`,
    `dependencies`,
    `peerDependencies`,
    `dependenciesMeta`,
    `peerDependenciesMeta`,
    `binaries`,
];
class PreserveOrdering {
    constructor(data) {
        this.data = data;
    }
}
exports.PreserveOrdering = PreserveOrdering;
function stringifyString(value) {
    if (value.match(simpleStringPattern)) {
        return value;
    }
    else {
        return JSON.stringify(value);
    }
}
function isRemovableField(value) {
    if (typeof value === `undefined`)
        return true;
    if (typeof value === `object` && value !== null && !Array.isArray(value))
        return Object.keys(value).every((key) => isRemovableField(value[key]));
    return false;
}
function stringifyValue(value, indentLevel, newLineIfObject) {
    if (value === null)
        return `null\n`;
    if (typeof value === `number` || typeof value === `boolean`)
        return `${value.toString()}\n`;
    if (typeof value === `string`)
        return `${stringifyString(value)}\n`;
    if (Array.isArray(value)) {
        if (value.length === 0)
            return `[]\n`;
        const indent = `  `.repeat(indentLevel);
        const serialized = value
            .map((sub) => {
            return `${indent}- ${stringifyValue(sub, indentLevel + 1, false)}`;
        })
            .join(``);
        return `\n${serialized}`;
    }
    if (typeof value === `object` && value) {
        const [data, sort] = value instanceof PreserveOrdering ? [value.data, false] : [value, true];
        const indent = `  `.repeat(indentLevel);
        const keys = Object.keys(data);
        if (sort) {
            keys.sort((a, b) => {
                const aIndex = specialObjectKeys.indexOf(a);
                const bIndex = specialObjectKeys.indexOf(b);
                if (aIndex === -1 && bIndex === -1)
                    return a < b ? -1 : a > b ? +1 : 0;
                if (aIndex !== -1 && bIndex === -1)
                    return -1;
                if (aIndex === -1 && bIndex !== -1)
                    return +1;
                return aIndex - bIndex;
            });
        }
        const fields = keys
            .filter((key) => {
            return !isRemovableField(data[key]);
        })
            .map((key, index) => {
            const value = data[key];
            const stringifiedKey = stringifyString(key);
            const stringifiedValue = stringifyValue(value, indentLevel + 1, true);
            const recordIndentation = index > 0 || newLineIfObject ? indent : ``;
            const keyPart = stringifiedKey.length > 1024
                ? `? ${stringifiedKey}\n${recordIndentation}:`
                : `${stringifiedKey}:`;
            const valuePart = stringifiedValue.startsWith(`\n`)
                ? stringifiedValue
                : ` ${stringifiedValue}`;
            return `${recordIndentation}${keyPart}${valuePart}`;
        })
            .join(indentLevel === 0 ? `\n` : ``) || `\n`;
        if (!newLineIfObject) {
            return `${fields}`;
        }
        else {
            return `\n${fields}`;
        }
    }
    throw new Error(`Unsupported value type (${value})`);
}
function stringifySyml(value) {
    try {
        const stringified = stringifyValue(value, 0, false);
        return stringified !== `\n` ? stringified : ``;
    }
    catch (error) {
        if (error.location)
            error.message = error.message.replace(/(\.)?$/, ` (line ${error.location.start.line}, column ${error.location.start.column})$1`);
        throw error;
    }
}
function parseViaPeg(source) {
    if (!source.endsWith(`\n`))
        source += `\n`;
    return parsePeg(source);
}
const LEGACY_REGEXP = /^(#.*(\r?\n))*?#\s+yarn\s+lockfile\s+v1\r?\n/i;
function parseViaJsYaml(source) {
    if (LEGACY_REGEXP.test(source))
        return parseViaPeg(source);
    const value = load(source, {
        schema: FAILSAFE_SCHEMA,
        json: true,
    });
    if (value === undefined || value === null)
        return {};
    if (typeof value !== `object`)
        throw new Error(`Expected an indexed object, got a ${typeof value} instead. Does your file follow Yaml's rules?`);
    if (Array.isArray(value))
        throw new Error(`Expected an indexed object, got an array instead. Does your file follow Yaml's rules?`);
    return value;
}
function parseSyml(source) {
    return parseViaJsYaml(source);
}
