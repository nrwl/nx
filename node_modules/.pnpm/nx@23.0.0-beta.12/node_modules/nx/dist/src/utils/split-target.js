"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitTargetFromNodes = splitTargetFromNodes;
exports.splitTargetFromConfigurations = splitTargetFromConfigurations;
exports.splitTarget = splitTarget;
exports.splitByColons = splitByColons;
const output_1 = require("../utils/output");
function nodeLookup(nodes) {
    return {
        has: (name) => !!nodes[name],
        getTargets: (name) => nodes[name]?.data?.targets,
    };
}
function configLookup(configs) {
    return {
        has: (name) => !!configs[name],
        getTargets: (name) => configs[name]?.targets,
    };
}
/**
 * Collects all valid [project, target?, config?] interpretations of a
 * colon-delimited string by iterating over the *segments* of the string
 * (O(k²) where k = number of segments) rather than over every project in the
 * graph.
 *
 * When `currentProject` is provided, bare-target interpretations (the string
 * is `target` or `target:config` on that project) are also collected.
 */
function findAllMatchingSegments(segments, lookup, currentProject) {
    const matches = [];
    // --- Bare-target matches (currentProject context) ---
    if (currentProject && lookup.has(currentProject)) {
        const targets = lookup.getTargets(currentProject) || {};
        for (let j = 1; j <= segments.length; j++) {
            const candidateTarget = segments.slice(0, j).join(':');
            if (!(candidateTarget in targets)) {
                continue;
            }
            const configSegments = segments.slice(j);
            if (configSegments.length === 0) {
                matches.push([currentProject, candidateTarget]);
            }
            else {
                const candidateConfig = configSegments.join(':');
                const configurations = targets[candidateTarget]?.configurations;
                if (configurations && candidateConfig in configurations) {
                    matches.push([currentProject, candidateTarget, candidateConfig]);
                }
            }
        }
    }
    // --- Project-based matches ---
    for (let i = 1; i <= segments.length; i++) {
        const candidateProject = segments.slice(0, i).join(':');
        if (!lookup.has(candidateProject)) {
            continue;
        }
        const remaining = segments.slice(i);
        if (remaining.length === 0) {
            matches.push([candidateProject]);
            continue;
        }
        const targets = lookup.getTargets(candidateProject) || {};
        for (let j = 1; j <= remaining.length; j++) {
            const candidateTarget = remaining.slice(0, j).join(':');
            if (!(candidateTarget in targets)) {
                continue;
            }
            const configSegments = remaining.slice(j);
            if (configSegments.length === 0) {
                matches.push([candidateProject, candidateTarget]);
            }
            else {
                const candidateConfig = configSegments.join(':');
                const configurations = targets[candidateTarget]?.configurations;
                if (configurations && candidateConfig in configurations) {
                    matches.push([candidateProject, candidateTarget, candidateConfig]);
                }
            }
        }
    }
    return matches;
}
/**
 * Returns whether `a` should be preferred over `b` using deterministic
 * precedence rules:
 *
 * 1. Bare-target matches (currentProject) rank highest.
 * 2. Longest (most-specific) project name.
 * 3. Longest target name.
 * 4. Longest configuration name.
 */
function isHigherPrecedence(a, b, currentProject) {
    const aIsBare = currentProject && a[0] === currentProject ? 1 : 0;
    const bIsBare = currentProject && b[0] === currentProject ? 1 : 0;
    if (aIsBare !== bIsBare)
        return aIsBare > bIsBare;
    if (a[0].length !== b[0].length)
        return a[0].length > b[0].length;
    const aTarget = (a[1] ?? '').length;
    const bTarget = (b[1] ?? '').length;
    if (aTarget !== bTarget)
        return aTarget > bTarget;
    return (a[2] ?? '').length > (b[2] ?? '').length;
}
/**
 * Single-pass selection of the highest-precedence match.
 */
function bestMatch(matches, currentProject) {
    let best = matches[0];
    for (let i = 1; i < matches.length; i++) {
        if (isHigherPrecedence(matches[i], best, currentProject)) {
            best = matches[i];
        }
    }
    return best;
}
function formatMatch(match) {
    return match.filter(Boolean).join(':');
}
/**
 * Internal implementation shared by splitTargetFromNodes and
 * splitTargetFromConfigurations.
 */
function splitTargetImpl(s, lookup, options) {
    const silent = options?.silent ?? false;
    const currentProject = options?.currentProject;
    const segments = splitByColons(s);
    const matches = findAllMatchingSegments(segments, lookup, currentProject);
    if (matches.length > 0) {
        const best = bestMatch(matches, currentProject);
        if (matches.length > 1 && !silent) {
            output_1.output.warn({
                title: `Ambiguous target specifier "${s}"`,
                bodyLines: [
                    `This string can be interpreted in multiple ways:`,
                    ...matches.map((m) => `  ${m === best ? '→' : ' '} ${formatMatch(m)}${m === best ? ' (selected)' : ''}`),
                    ``,
                    `The most specific match was selected. To avoid ambiguity, use a unique target specifier.`,
                ],
            });
        }
        return best;
    }
    // --- Fallback: no exact match found in the graph ---
    let colonIndex = s.indexOf(':');
    if (colonIndex === 0) {
        // first colon can't be at the beginning of the string, try to find the next one
        colonIndex = s.indexOf(':', 1);
    }
    if (colonIndex > 0) {
        let [project, ...remainingSegments] = segments;
        // splitByColons splits on every ':', so a leading colon (e.g. ":pkg:build")
        // produces an empty first element. Greedily absorb segments to reconstruct
        // the longest known colon-prefixed project name (e.g. ":utils:common").
        if (project === '' && remainingSegments.length > 0) {
            let absorbed = 1; // absorb at least one segment
            for (let k = remainingSegments.length - 1; k >= 1; k--) {
                const candidate = ':' + remainingSegments.slice(0, k).join(':');
                if (lookup.has(candidate)) {
                    absorbed = k;
                    break;
                }
            }
            project = ':' + remainingSegments.slice(0, absorbed).join(':');
            remainingSegments = remainingSegments.slice(absorbed);
        }
        // if only configuration cannot be matched, try to match project and target
        const configuration = remainingSegments[remainingSegments.length - 1];
        const rest = s.slice(0, -(configuration.length + 1));
        const restSegments = splitByColons(rest);
        const restMatches = findAllMatchingSegments(restSegments, lookup, currentProject);
        if (restMatches.length > 0) {
            const best = bestMatch(restMatches, currentProject);
            if (best.length === 2) {
                return [...best, configuration];
            }
        }
        // no project-target pair found, do the naive matching
        const validTargets = lookup.getTargets(project);
        const validTargetNames = new Set(Object.keys(validTargets ?? {}));
        return [
            project,
            ...groupJointSegments(remainingSegments, validTargetNames),
        ];
    }
    // we don't know what to do with the string, return as is
    return [s];
}
function splitTargetFromNodes(s, nodes, options) {
    return splitTargetImpl(s, nodeLookup(nodes), options);
}
/**
 * Splits a colon-delimited target specifier using a name-keyed
 * `Record<string, ProjectConfiguration>` — the format used during
 * the merge phase before the full project graph is available.
 */
function splitTargetFromConfigurations(s, configs, options) {
    return splitTargetImpl(s, configLookup(configs), options);
}
function splitTarget(s, projectGraph, options) {
    return splitTargetFromNodes(s, projectGraph.nodes, options);
}
function groupJointSegments(segments, validTargetNames) {
    for (let endingSegmentIdx = segments.length; endingSegmentIdx > 0; endingSegmentIdx--) {
        const potentialTargetName = segments.slice(0, endingSegmentIdx).join(':');
        if (validTargetNames.has(potentialTargetName)) {
            const configurationName = endingSegmentIdx < segments.length
                ? segments.slice(endingSegmentIdx).join(':')
                : null;
            return configurationName
                ? [potentialTargetName, configurationName]
                : [potentialTargetName];
        }
    }
    // If we can't find a segment match, keep older behaviour
    return segments;
}
function splitByColons(s) {
    const parts = [];
    let currentPart = '';
    for (let i = 0; i < s.length; ++i) {
        if (s[i] === ':') {
            parts.push(currentPart);
            currentPart = '';
        }
        else if (s[i] === '"') {
            i++;
            for (; i < s.length && s[i] != '"'; ++i) {
                currentPart += s[i];
            }
        }
        else {
            currentPart += s[i];
        }
    }
    parts.push(currentPart);
    return parts;
}
