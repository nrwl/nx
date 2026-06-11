"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOB_CHARACTERS = void 0;
exports.combineGlobPatterns = combineGlobPatterns;
exports.isGlobPattern = isGlobPattern;
function combineGlobPatterns(...patterns) {
    const p = patterns.flat();
    return p.length > 1 ? '{' + p.join(',') + '}' : p.length === 1 ? p[0] : '';
}
exports.GLOB_CHARACTERS = new Set(['*', '|', '{', '}', '(', ')', '[']);
function isGlobPattern(pattern) {
    for (const c of pattern) {
        if (exports.GLOB_CHARACTERS.has(c)) {
            return true;
        }
    }
    return false;
}
