"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonDiffType = void 0;
exports.isJsonChange = isJsonChange;
exports.jsonDiff = jsonDiff;
exports.walkJsonTree = walkJsonTree;
exports.deepEquals = deepEquals;
var JsonDiffType;
(function (JsonDiffType) {
    JsonDiffType["Deleted"] = "JsonPropertyDeleted";
    JsonDiffType["Added"] = "JsonPropertyAdded";
    JsonDiffType["Modified"] = "JsonPropertyModified";
})(JsonDiffType || (exports.JsonDiffType = JsonDiffType = {}));
function isJsonChange(change) {
    return (change.type === JsonDiffType.Added ||
        change.type === JsonDiffType.Deleted ||
        change.type === JsonDiffType.Modified);
}
function jsonDiff(lhs, rhs) {
    const result = [];
    const seenInLhs = new Set();
    walkJsonTree(lhs, [], (path, lhsValue) => {
        seenInLhs.add(hashArray(path));
        const rhsValue = getJsonValue(path, rhs);
        if (rhsValue === undefined) {
            result.push({
                type: JsonDiffType.Deleted,
                path,
                value: {
                    lhs: lhsValue,
                    rhs: undefined,
                },
            });
        }
        else if (!deepEquals(lhsValue, rhsValue)) {
            result.push({
                type: JsonDiffType.Modified,
                path,
                value: {
                    lhs: lhsValue,
                    rhs: rhsValue,
                },
            });
        }
        return typeof lhsValue === 'object' || Array.isArray(lhsValue);
    });
    walkJsonTree(rhs, [], (path, rhsValue) => {
        const addedInRhs = !seenInLhs.has(hashArray(path));
        if (addedInRhs) {
            result.push({
                type: JsonDiffType.Added,
                path,
                value: {
                    lhs: undefined,
                    rhs: rhsValue,
                },
            });
        }
        return typeof rhsValue === 'object' || Array.isArray(rhsValue);
    });
    return result;
}
// Depth-first walk down JSON tree.
function walkJsonTree(json, currPath, visitor) {
    if (!json || typeof json !== 'object') {
        return;
    }
    Object.keys(json).forEach((key) => {
        const path = currPath.concat([key]);
        const shouldContinue = visitor(path, json[key]);
        if (shouldContinue) {
            walkJsonTree(json[key], path, visitor);
        }
    });
}
function hashArray(ary) {
    return JSON.stringify(ary);
}
function getJsonValue(path, json) {
    let curr = json;
    for (const k of path) {
        curr = curr[k];
        if (curr === undefined) {
            break;
        }
    }
    return curr;
}
function deepEquals(a, b) {
    if (a === b) {
        return true;
    }
    // Values do not need to be checked for deep equality and the above is false
    if (
    // Values are different types
    typeof a !== typeof b ||
        // Values are the same type but not an object or array
        (typeof a !== 'object' && !Array.isArray(a)) ||
        // Objects are the same type, objects or arrays, but do not have the same number of keys
        Object.keys(a).length !== Object.keys(b).length) {
        return false;
    }
    // Values need to be checked for deep equality
    return Object.entries(a).reduce((equal, [key, aValue]) => {
        // Skip other keys if it is already not equal.
        if (!equal) {
            return equal;
        }
        // Traverse the object
        return deepEquals(aValue, b[key]);
    }, true);
}
