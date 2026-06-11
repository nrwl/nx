"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyType = void 0;
exports.fileDataDepTarget = fileDataDepTarget;
exports.fileDataDepType = fileDataDepType;
exports.isProjectGraphProjectNode = isProjectGraphProjectNode;
exports.isProjectGraphExternalNode = isProjectGraphExternalNode;
function fileDataDepTarget(dep) {
    return typeof dep === 'string'
        ? dep
        : Array.isArray(dep) && dep.length === 2
            ? dep[0]
            : dep[1];
}
function fileDataDepType(dep) {
    return typeof dep === 'string'
        ? 'static'
        : Array.isArray(dep) && dep.length === 2
            ? dep[1]
            : dep[2];
}
/**
 * Type of dependency between projects
 */
var DependencyType;
(function (DependencyType) {
    /**
     * Static dependencies are tied to the loading of the module
     */
    DependencyType["static"] = "static";
    /**
     * Dynamic dependencies are brought in by the module at run time
     */
    DependencyType["dynamic"] = "dynamic";
    /**
     * Implicit dependencies are inferred
     */
    DependencyType["implicit"] = "implicit";
})(DependencyType || (exports.DependencyType = DependencyType = {}));
function isProjectGraphProjectNode(node) {
    return node.type === 'app' || node.type === 'e2e' || node.type === 'lib';
}
function isProjectGraphExternalNode(node) {
    return isProjectGraphProjectNode(node) === false;
}
