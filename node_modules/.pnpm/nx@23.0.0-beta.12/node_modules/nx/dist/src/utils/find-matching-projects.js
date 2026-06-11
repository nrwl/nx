"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchingStringsWithCache = void 0;
exports.findMatchingProjects = findMatchingProjects;
const minimatch_1 = require("minimatch");
const globs_1 = require("./globs");
const validPatternTypes = [
    'name', // Pattern is based on the project's name
    'tag', // Pattern is based on the project's tags
    'directory', // Pattern is based on the project's root directory
    'unlabeled', // Pattern was passed without specifying a type
];
/**
 * Find matching project names given a list of potential project names or globs.
 *
 * @param patterns A list of project names or globs to match against.
 * @param projects A map of {@link ProjectGraphProjectNode} by project name.
 * @returns
 */
function findMatchingProjects(patterns = [], projects) {
    if (!patterns.length || patterns.filter((p) => p.length).length === 0) {
        return []; // Short circuit if called with no patterns
    }
    const projectNames = Object.keys(projects);
    const matchedProjects = new Set();
    // If the first pattern is an exclude pattern,
    // we add a wildcard pattern at the first to select
    // all projects, except the ones that match the exclude pattern.
    // e.g. ['!tag:someTag', 'project2'] will match all projects except
    // the ones with the tag 'someTag', and also match the project 'project2',
    // regardless of its tags.
    if (isExcludePattern(patterns[0])) {
        patterns.unshift('*');
    }
    for (const stringPattern of patterns) {
        // Do not waste time attempting to look up cross-workspace references which will never match
        if (!stringPattern.length || stringPattern.startsWith('nx-cloud:')) {
            continue;
        }
        const pattern = parseStringPattern(stringPattern, projects);
        // Handle wildcard with short-circuit, as its a common case with potentially
        // large project sets and we can avoid the more expensive glob matching.
        if (pattern.value === '*') {
            for (const projectName of projectNames) {
                if (pattern.exclude) {
                    matchedProjects.delete(projectName);
                }
                else {
                    matchedProjects.add(projectName);
                }
            }
            continue;
        }
        switch (pattern.type) {
            case 'tag': {
                addMatchingProjectsByTag(projectNames, projects, pattern, matchedProjects);
                continue;
            }
            case 'name': {
                addMatchingProjectsByName(projectNames, projects, pattern, matchedProjects);
                continue;
            }
            case 'directory': {
                addMatchingProjectsByDirectory(projectNames, projects, pattern, matchedProjects);
                continue;
            }
            // Same thing as `type:unlabeled`. If no specific type is set,
            // we can waterfall through the different types until we find a match
            default: {
                // The size of the selected and excluded projects set, before we
                // start updating it with this pattern. If the size changes, we
                // know we found a match and can skip the other types.
                const originalSize = matchedProjects.size;
                addMatchingProjectsByName(projectNames, projects, pattern, matchedProjects);
                if (matchedProjects.size !== originalSize) {
                    // There was some match by name, don't check other types
                    continue;
                }
                addMatchingProjectsByDirectory(projectNames, projects, pattern, matchedProjects);
                if (matchedProjects.size !== originalSize) {
                    // There was some match by directory, don't check other types
                    // Note - this doesn't do anything currently, but preps for future
                    // types
                    continue;
                }
            }
        }
    }
    return Array.from(matchedProjects);
}
function addMatchingProjectsByDirectory(projectNames, projects, pattern, matchedProjects) {
    for (const projectName of projectNames) {
        const root = projects[projectName].data.root;
        if ((0, exports.getMatchingStringsWithCache)(pattern.value, [root]).length > 0) {
            if (pattern.exclude) {
                matchedProjects.delete(projectName);
            }
            else {
                matchedProjects.add(projectName);
            }
        }
    }
}
function addMatchingProjectsByName(projectNames, projects, pattern, matchedProjects) {
    if (projects[pattern.value]) {
        if (pattern.exclude) {
            matchedProjects.delete(pattern.value);
        }
        else {
            matchedProjects.add(pattern.value);
        }
        return;
    }
    if (!(0, globs_1.isGlobPattern)(pattern.value)) {
        // Custom regex that is basically \b but includes hyphens (-) and excludes underscores (_), so "foo" pattern matches "foo_bar" but not "foo-e2e".
        const regex = new RegExp(`(?<![@a-zA-Z0-9-])${pattern.value}(?![@a-zA-Z0-9-])`, 'i');
        const matchingProjects = Object.keys(projects).filter((name) => regex.test(name));
        for (const projectName of matchingProjects) {
            if (pattern.exclude) {
                matchedProjects.delete(projectName);
            }
            else {
                matchedProjects.add(projectName);
            }
        }
        return;
    }
    const matchedProjectNames = (0, exports.getMatchingStringsWithCache)(pattern.value, projectNames);
    for (const projectName of matchedProjectNames) {
        if (pattern.exclude) {
            matchedProjects.delete(projectName);
        }
        else {
            matchedProjects.add(projectName);
        }
    }
}
function addMatchingProjectsByTag(projectNames, projects, pattern, matchedProjects) {
    for (const projectName of projectNames) {
        const tags = projects[projectName].data.tags || [];
        if (tags.includes(pattern.value)) {
            if (pattern.exclude) {
                matchedProjects.delete(projectName);
            }
            else {
                matchedProjects.add(projectName);
            }
            continue;
        }
        if (!(0, globs_1.isGlobPattern)(pattern.value)) {
            continue;
        }
        if ((0, exports.getMatchingStringsWithCache)(pattern.value, tags).length) {
            if (pattern.exclude) {
                matchedProjects.delete(projectName);
            }
            else {
                matchedProjects.add(projectName);
            }
        }
    }
}
function isExcludePattern(pattern) {
    return pattern.startsWith('!');
}
function parseStringPattern(pattern, projects) {
    const isExclude = isExcludePattern(pattern);
    // Support for things like: `!{type}:value`
    if (isExclude) {
        pattern = pattern.substring(1);
    }
    const indexOfFirstPotentialSeparator = pattern.indexOf(':');
    // There is a project that matches directly
    if (projects[pattern]) {
        return { type: 'name', value: pattern, exclude: isExclude };
        // The pattern does not contain a label
    }
    else if (indexOfFirstPotentialSeparator === -1) {
        return { type: 'unlabeled', value: pattern, exclude: isExclude };
        // The pattern may contain a label
    }
    else {
        const potentialType = pattern.substring(0, indexOfFirstPotentialSeparator);
        return {
            type: isValidPatternType(potentialType) ? potentialType : 'unlabeled',
            value: pattern.substring(indexOfFirstPotentialSeparator + 1),
            exclude: isExclude,
        };
    }
}
function isValidPatternType(type) {
    return validPatternTypes.includes(type);
}
exports.getMatchingStringsWithCache = (() => {
    // Map< Pattern, Map< Item, Result >>
    const minimatchCache = new Map();
    const regexCache = new Map();
    return (pattern, items) => {
        if (!minimatchCache.has(pattern)) {
            minimatchCache.set(pattern, new Map());
        }
        const patternCache = minimatchCache.get(pattern);
        if (!regexCache.has(pattern)) {
            const regex = minimatch_1.minimatch.makeRe(pattern, { dot: true });
            if (regex) {
                regexCache.set(pattern, regex);
            }
            else {
                throw new Error('Invalid glob pattern ' + pattern);
            }
        }
        const matcher = regexCache.get(pattern);
        return items.filter((item) => {
            let entry = patternCache.get(item);
            if (entry === undefined || entry === null) {
                entry = item === pattern ? true : matcher.test(item);
                patternCache.set(item, entry);
            }
            return entry;
        });
    };
})();
