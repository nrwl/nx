"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTree = createTree;
const tree_1 = require("../tree");
/**
 * Creates a host for testing.
 */
function createTree() {
    const tree = new tree_1.FsTree('/virtual', false);
    // Allow prettier formatting to be applied to the tree for backwards compatibility within v20
    // TODO: Decouple formatFiles and other formatting utilities from prettier to avoid this
    tree.write('.prettierrc', '{}');
    return tree;
}
