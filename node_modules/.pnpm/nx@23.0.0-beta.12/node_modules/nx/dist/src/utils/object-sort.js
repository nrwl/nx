"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortObjectByKeys = sortObjectByKeys;
function sortObjectByKeys(originalObject) {
    const keys = Object.keys(originalObject).sort();
    const sortedObject = {};
    keys.forEach((key) => (sortedObject[key] = originalObject[key]));
    return sortedObject;
}
