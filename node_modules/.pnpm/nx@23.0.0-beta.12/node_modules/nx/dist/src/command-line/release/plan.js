"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releasePlanCLIHandler = void 0;
exports.createAPI = createAPI;
const enquirer_1 = require("enquirer");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const semver_1 = require("semver");
const tmp_1 = require("tmp");
const nx_json_1 = require("../../config/nx-json");
const file_map_utils_1 = require("../../project-graph/file-map-utils");
const project_graph_1 = require("../../project-graph/project-graph");
const all_file_data_1 = require("../../utils/all-file-data");
const command_line_utils_1 = require("../../utils/command-line-utils");
const handle_errors_1 = require("../../utils/handle-errors");
const output_1 = require("../../utils/output");
const config_1 = require("./config/config");
const deep_merge_json_1 = require("./config/deep-merge-json");
const filter_release_groups_1 = require("./config/filter-release-groups");
const version_plans_1 = require("./config/version-plans");
const generate_version_plan_content_1 = require("./utils/generate-version-plan-content");
const get_touched_projects_for_group_1 = require("./utils/get-touched-projects-for-group");
const launch_editor_1 = require("./utils/launch-editor");
const print_changes_1 = require("./utils/print-changes");
const print_config_1 = require("./utils/print-config");
const releasePlanCLIHandler = (args) => (0, handle_errors_1.handleErrors)(args.verbose, () => createAPI({})(args));
exports.releasePlanCLIHandler = releasePlanCLIHandler;
function createAPI(overrideReleaseConfig) {
    return async function releasePlan(args) {
        const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
        const nxJson = (0, nx_json_1.readNxJson)();
        const userProvidedReleaseConfig = (0, deep_merge_json_1.deepMergeJson)(nxJson.release ?? {}, overrideReleaseConfig ?? {});
        // Apply default configuration to any optional user configuration
        const { error: configError, nxReleaseConfig } = await (0, config_1.createNxReleaseConfig)(projectGraph, await (0, file_map_utils_1.createProjectFileMapUsingProjectGraph)(projectGraph), userProvidedReleaseConfig);
        if (configError) {
            return await (0, config_1.handleNxReleaseConfigError)(configError);
        }
        // --print-config exits directly as it is not designed to be combined with any other programmatic operations
        if (args.printConfig) {
            return (0, print_config_1.printConfigAndExit)({
                userProvidedReleaseConfig,
                nxReleaseConfig,
                isDebug: args.printConfig === 'debug',
            });
        }
        const { error: filterError, releaseGroups, releaseGroupToFilteredProjects, } = (0, filter_release_groups_1.filterReleaseGroups)(projectGraph, nxReleaseConfig, args.projects, args.groups);
        if (filterError) {
            output_1.output.error(filterError);
            process.exit(1);
        }
        // If no release groups have version plans enabled, it doesn't make sense to use the plan command only to set yourself up for an error at release time
        if (!releaseGroups.some((group) => !!group.versionPlans)) {
            if (releaseGroups.length === 1) {
                output_1.output.warn({
                    title: `Version plans are not enabled in your release configuration`,
                    bodyLines: [
                        'To enable version plans, set `"versionPlans": true` at the top level of your `"release"` configuration',
                    ],
                });
                return 0;
            }
            output_1.output.warn({
                title: 'No release groups have version plans enabled',
                bodyLines: [
                    'To enable version plans, set `"versionPlans": true` at the top level of your `"release"` configuration to apply it to all groups, otherwise set it at the release group level',
                ],
            });
            return 0;
        }
        // Resolve the final values for base, head etc to use when resolving the changes to consider
        const { nxArgs } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)(args, 'affected', {
            printWarnings: args.verbose,
        }, nxJson);
        const versionPlanBumps = {};
        const setBumpIfNotNone = (projectOrGroup, version) => {
            if (version !== 'none') {
                versionPlanBumps[projectOrGroup] = version;
            }
        };
        // Changed files are only relevant if considering touched projects
        let changedFiles = [];
        let getProjectsToVersionForGroup;
        if (args.onlyTouched) {
            changedFiles = (0, command_line_utils_1.parseFiles)(nxArgs).files;
            if (nxArgs.verbose) {
                if (changedFiles.length) {
                    output_1.output.log({
                        title: `Changed files based on resolved "base" (${nxArgs.base}) and "head" (${nxArgs.head ?? 'HEAD'})`,
                        bodyLines: changedFiles.map((file) => `  - ${file}`),
                    });
                }
                else {
                    output_1.output.warn({
                        title: 'No changed files found based on resolved "base" and "head"',
                    });
                }
            }
            const resolvedAllFileData = await (0, all_file_data_1.allFileData)();
            getProjectsToVersionForGroup = (0, get_touched_projects_for_group_1.createGetTouchedProjectsForGroup)(nxArgs, projectGraph, changedFiles, resolvedAllFileData);
        }
        if (args.projects?.length) {
            /**
             * Run plan for all remaining release groups and filtered projects within them
             */
            for (const releaseGroup of releaseGroups) {
                const releaseGroupName = releaseGroup.name;
                const releaseGroupProjectNames = Array.from(releaseGroupToFilteredProjects.get(releaseGroup));
                let applicableProjects = releaseGroupProjectNames;
                if (args.onlyTouched &&
                    typeof getProjectsToVersionForGroup === 'function') {
                    applicableProjects = await getProjectsToVersionForGroup(releaseGroup, releaseGroupProjectNames, true);
                }
                if (!applicableProjects.length) {
                    continue;
                }
                if (releaseGroup.projectsRelationship === 'independent') {
                    for (const project of applicableProjects) {
                        setBumpIfNotNone(project, args.bump ||
                            (await promptForVersion(`How do you want to bump the version of the project "${project}"${releaseGroupName === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                                ? ''
                                : ` within group "${releaseGroupName}"`}?`)));
                    }
                }
                else {
                    setBumpIfNotNone(releaseGroupName, args.bump ||
                        (await promptForVersion(`How do you want to bump the versions of ${releaseGroupName === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                            ? 'all projects'
                            : `the projects in the group "${releaseGroupName}"`}?`)));
                }
            }
            // Create a version plan file if applicable
            await createVersionPlanFileForBumps(args, versionPlanBumps);
            return 0;
        }
        /**
         * Run plan for all remaining release groups
         */
        for (const releaseGroup of releaseGroups) {
            const releaseGroupName = releaseGroup.name;
            let applicableProjects = releaseGroup.projects;
            if (args.onlyTouched &&
                typeof getProjectsToVersionForGroup === 'function') {
                applicableProjects = await getProjectsToVersionForGroup(releaseGroup, releaseGroup.projects, false);
            }
            if (!applicableProjects.length) {
                continue;
            }
            if (releaseGroup.projectsRelationship === 'independent') {
                for (const project of applicableProjects) {
                    setBumpIfNotNone(project, args.bump ||
                        (await promptForVersion(`How do you want to bump the version of the project "${project}"${releaseGroupName === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                            ? ''
                            : ` within group "${releaseGroupName}"`}?`)));
                }
            }
            else {
                setBumpIfNotNone(releaseGroupName, args.bump ||
                    (await promptForVersion(`How do you want to bump the versions of ${releaseGroupName === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                        ? 'all projects'
                        : `the projects in the group "${releaseGroupName}"`}?`)));
            }
        }
        // Create a version plan file if applicable
        await createVersionPlanFileForBumps(args, versionPlanBumps);
        return 0;
    };
}
async function createVersionPlanFileForBumps(args, versionPlanBumps) {
    if (!Object.keys(versionPlanBumps).length) {
        let bodyLines = [];
        if (args.onlyTouched) {
            bodyLines = [
                'This might be because no projects have been changed, or projects you expected to release have not been touched',
                'To include all projects, not just those that have been changed, pass --only-touched=false',
                'Alternatively, you can specify alternate --base and --head refs to include only changes from certain commits',
            ];
        }
        output_1.output.warn({
            title: 'No version bumps were selected so no version plan file was created.',
            bodyLines,
        });
        return 0;
    }
    const versionPlanName = `version-plan-${new Date().getTime()}`;
    const versionPlanMessage = args.message || (await promptForMessage(versionPlanName));
    const versionPlanFileContent = (0, generate_version_plan_content_1.generateVersionPlanContent)(versionPlanBumps, versionPlanMessage);
    const versionPlanFileName = `${versionPlanName}.md`;
    if (args.dryRun) {
        output_1.output.logSingleLine(`Would create version plan file "${versionPlanFileName}", but --dry-run was set.`);
        (0, print_changes_1.printDiff)('', versionPlanFileContent, 1);
    }
    else {
        output_1.output.logSingleLine(`Creating version plan file "${versionPlanFileName}"`);
        (0, print_changes_1.printDiff)('', versionPlanFileContent, 1);
        const versionPlansAbsolutePath = (0, version_plans_1.getVersionPlansAbsolutePath)();
        await (0, promises_1.mkdir)(versionPlansAbsolutePath, { recursive: true });
        await (0, promises_1.writeFile)((0, node_path_1.join)(versionPlansAbsolutePath, versionPlanFileName), versionPlanFileContent);
    }
}
async function promptForVersion(message) {
    try {
        const reply = await (0, enquirer_1.prompt)([
            {
                name: 'version',
                message,
                type: 'select',
                choices: [...semver_1.RELEASE_TYPES, 'none'],
            },
        ]);
        return reply.version;
    }
    catch {
        output_1.output.log({
            title: 'Cancelled version plan creation.',
        });
        // Ensure the cursor is always restored before exiting
        process.stdout.write('\u001b[?25h');
        process.exit(0);
    }
}
async function promptForMessage(versionPlanName) {
    let message;
    do {
        message = await _promptForMessage(versionPlanName);
    } while (!message);
    return message;
}
async function _promptForMessage(versionPlanName) {
    try {
        const reply = await (0, enquirer_1.prompt)([
            {
                name: 'message',
                message: 'What changelog message would you like associated with this change? (Leave blank to open an external editor for multi-line messages/easier editing)',
                type: 'input',
            },
        ]);
        let message = reply.message.trim();
        if (!message.length) {
            const tmpDir = (0, tmp_1.dirSync)().name;
            const messageFilePath = (0, node_path_1.join)(tmpDir, `DRAFT_MESSAGE__${versionPlanName}.md`);
            (0, node_fs_1.writeFileSync)(messageFilePath, '');
            await (0, launch_editor_1.launchEditor)(messageFilePath);
            message = (0, node_fs_1.readFileSync)(messageFilePath, 'utf-8');
        }
        message = message.trim();
        if (!message) {
            output_1.output.warn({
                title: 'A changelog message is required in order to create the version plan file',
                bodyLines: [],
            });
        }
        return message;
    }
    catch (e) {
        output_1.output.log({
            title: 'Cancelled version plan creation.',
        });
        process.exit(0);
    }
}
