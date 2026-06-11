"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepMergeJson = deepMergeJson;
function isObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
}
function deepMergeJson(target, source) {
    try {
        // Ensure both objects are valid JSON before attempting to merge values
        JSON.parse(JSON.stringify(source));
        JSON.parse(JSON.stringify(target));
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) {
                    Object.assign(target, { [key]: {} });
                }
                deepMergeJson(target[key], source[key]);
            }
            else {
                Object.assign(target, { [key]: source[key] });
            }
        }
        return target;
    }
    catch {
        throw new Error('Invalid JSON was provided');
    }
}
