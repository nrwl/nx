"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashArray = hashArray;
exports.hashObject = hashObject;
exports.hashFile = hashFile;
function hashArray(content) {
    // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
    const { hashArray } = require('../native');
    return hashArray(content);
}
function hashObject(obj) {
    const { hashArray } = require('../native');
    const parts = [];
    for (const key of Object.keys(obj ?? {}).sort()) {
        parts.push(key);
        parts.push(JSON.stringify(obj[key]));
    }
    return hashArray(parts);
}
function hashFile(filePath) {
    const { hashFile } = require('../native');
    return hashFile(filePath);
}
