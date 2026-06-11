"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._recordOutputsHash = _recordOutputsHash;
exports._outputsHashesMatch = _outputsHashesMatch;
exports.processFileChangesInOutputs = processFileChangesInOutputs;
exports.outputsHashesMatchBatch = outputsHashesMatchBatch;
exports.recordOutputsHashBatch = recordOutputsHashBatch;
exports.disableOutputsTracking = disableOutputsTracking;
const path_1 = require("path");
const native_1 = require("../../native");
const collapse_expanded_outputs_1 = require("../../utils/collapse-expanded-outputs");
const workspace_root_1 = require("../../utils/workspace-root");
let disabled = false;
const dirsContainingOutputs = {};
const recordedHashes = {};
const timestamps = {};
const numberOfExpandedOutputs = {};
function _recordOutputsHash(outputs, hash) {
    numberOfExpandedOutputs[hash] = outputs.length;
    for (const output of outputs) {
        recordedHashes[output] = hash;
        timestamps[output] = new Date().getTime();
        let current = output;
        while (current != (0, path_1.dirname)(current)) {
            if (!dirsContainingOutputs[current]) {
                dirsContainingOutputs[current] = new Set();
            }
            dirsContainingOutputs[current].add(output);
            current = (0, path_1.dirname)(current);
        }
    }
}
function _outputsHashesMatch(outputs, hash) {
    if (outputs.length !== numberOfExpandedOutputs[hash]) {
        return false;
    }
    else {
        for (const output of outputs) {
            if (recordedHashes[output] !== hash) {
                return false;
            }
        }
    }
    return true;
}
function processFileChangesInOutputs(changeEvents, now = undefined) {
    if (!now) {
        now = new Date().getTime();
    }
    for (let e of changeEvents) {
        let current = e.path;
        // the path is either an output itself or a parent
        if (dirsContainingOutputs[current]) {
            dirsContainingOutputs[current].forEach((output) => {
                if (now - timestamps[output] > 2000) {
                    recordedHashes[output] = undefined;
                }
            });
            continue;
        }
        // the path is a child of some output or unrelated
        while (current != (0, path_1.dirname)(current)) {
            if (recordedHashes[current] && now - timestamps[current] > 2000) {
                recordedHashes[current] = undefined;
                break;
            }
            current = (0, path_1.dirname)(current);
        }
    }
}
/**
 * Check whether the on-disk outputs of each entry still match the hash
 * the daemon recorded for them. Uses Rayon-parallel filesystem scanning
 * for uncached entries.
 */
function outputsHashesMatchBatch(entries) {
    if (disabled)
        return entries.map(() => false);
    // Fast path: skip filesystem scan for entries with no recorded hash.
    // _outputsHashesMatch will return false immediately if the hash isn't
    // in numberOfExpandedOutputs, so scanning the filesystem is wasted work.
    const needsScan = [];
    const results = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
        if (numberOfExpandedOutputs[entries[i].hash] === undefined) {
            results[i] = false;
        }
        else {
            needsScan.push(i);
        }
    }
    if (needsScan.length > 0) {
        // Only scan outputs for entries that have recorded hashes
        const outputsBatch = needsScan.map((i) => entries[i].outputs);
        const expandedBatch = (0, native_1.getFilesForOutputsBatch)(workspace_root_1.workspaceRoot, outputsBatch);
        for (let j = 0; j < needsScan.length; j++) {
            const expanded = (0, collapse_expanded_outputs_1.collapseExpandedOutputs)(expandedBatch[j]);
            results[needsScan[j]] = _outputsHashesMatch(expanded, entries[needsScan[j]].hash);
        }
    }
    return results;
}
/**
 * Record the hash of each entry's on-disk outputs so future
 * outputsHashesMatchBatch calls can skip redundant cache copies.
 * Uses Rayon-parallel filesystem scanning.
 */
function recordOutputsHashBatch(entries) {
    if (disabled)
        return;
    const outputsBatch = entries.map((e) => e.outputs);
    const expandedBatch = (0, native_1.getFilesForOutputsBatch)(workspace_root_1.workspaceRoot, outputsBatch);
    for (let i = 0; i < entries.length; i++) {
        const expanded = (0, collapse_expanded_outputs_1.collapseExpandedOutputs)(expandedBatch[i]);
        _recordOutputsHash(expanded, entries[i].hash);
    }
}
function disableOutputsTracking() {
    disabled = true;
}
