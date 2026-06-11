"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripJsonComments = void 0;
exports.parseJson = parseJson;
exports.serializeJson = serializeJson;
const jsonc_parser_1 = require("jsonc-parser");
Object.defineProperty(exports, "stripJsonComments", { enumerable: true, get: function () { return jsonc_parser_1.stripComments; } });
const lines_and_columns_1 = require("lines-and-columns");
const code_frames_1 = require("./code-frames");
/**
 * Parses the given JSON string and returns the object the JSON content represents.
 * By default javascript-style comments and trailing commas are allowed.
 *
 * @param input JSON content as string
 * @param options JSON parse options
 * @returns Object the JSON content represents
 */
function parseJson(input, options) {
    try {
        if (options?.expectComments !== true) {
            return JSON.parse(input);
        }
    }
    catch { }
    options = { allowTrailingComma: true, ...options };
    const errors = [];
    const result = (0, jsonc_parser_1.parse)(input, errors, options);
    if (errors.length > 0) {
        throw new Error(formatParseError(input, errors[0]));
    }
    return result;
}
/**
 * Nicely formats a JSON error with context
 *
 * @param input JSON content as string
 * @param parseError jsonc ParseError
 * @returns
 */
function formatParseError(input, parseError) {
    const { error, offset, length } = parseError;
    let { line, column } = new lines_and_columns_1.LinesAndColumns(input).locationForIndex(offset);
    line++;
    column++;
    return (`${(0, jsonc_parser_1.printParseErrorCode)(error)} in JSON at ${line}:${column}\n` +
        (0, code_frames_1.codeFrameColumns)(input, {
            start: { line, column },
            end: { line, column: column + length },
        }) +
        '\n');
}
/**
 * Serializes the given data to a JSON string.
 * By default the JSON string is formatted with a 2 space indentation to be easy readable.
 *
 * @param input Object which should be serialized to JSON
 * @param options JSON serialize options
 * @returns the formatted JSON representation of the object
 */
function serializeJson(input, options) {
    return JSON.stringify(input, null, options?.spaces ?? 2);
}
