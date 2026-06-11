"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releasePlanCheckCLIHandler = void 0;
exports.createAPI = createAPI;
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
const get_touched_projects_for_group_1 = require("./utils/get-touched-projects-for-group");
const print_config_1 = require("./utils/print-config");
const releasePlanCheckCLIHandler = (args) => (0, handle_errors_1.handleErrors)(args.verbose, () => createAPI({})(args));
exports.releasePlanCheckCLIHandler = releasePlanCheckCLIHandler;
function createAPI(overrideReleaseConfig) {
    return async function releasePlanCheck(args) {
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
        // No filtering is applied here, as we want to consider all release groups for plan:check
        const { error: filterError, releaseGroups } = (0, filter_release_groups_1.filterReleaseGroups)(projectGraph, nxReleaseConfig);
        if (filterError) {
            output_1.output.error(filterError);
            process.exit(1);
        }
        // If no release groups have version plans enabled, provide an explicit error
        if (!releaseGroups.some((group) => group.versionPlans)) {
            output_1.output.error({
                title: 'Version plans are not enabled',
                bodyLines: [
                    'Please ensure at least one release group has version plans enabled in your Nx release configuration if you want to use this command.',
                    '',
                    'Learn more about version plans here: https://nx.dev/recipes/nx-release/file-based-versioning-version-plans',
                ],
            });
            return 1;
        }
        const rawVersionPlans = await (0, version_plans_1.readRawVersionPlans)();
        await (0, version_plans_1.setResolvedVersionPlansOnGroups)(rawVersionPlans, releaseGroups, Object.keys(projectGraph.nodes), args.verbose);
        // Resolve the final values for base, head etc to use when resolving the changes to consider
        const { nxArgs } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)(args, 'affected', {
            printWarnings: args.verbose,
        }, nxJson);
        const changedFiles = (0, command_line_utils_1.parseFiles)(nxArgs).files;
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
        const getTouchedProjectsForGroup = (0, get_touched_projects_for_group_1.createGetTouchedProjectsForGroup)(nxArgs, projectGraph, changedFiles, resolvedAllFileData);
        const NOTE_ABOUT_VERBOSE_LOGGING = 'Run with --verbose to see the full list of changed files used for the touched projects logic.';
        let hasErrors = false;
        for (const releaseGroup of releaseGroups) {
            // The current release group doesn't leverage version plans
            if (!releaseGroup.versionPlans) {
                continue;
            }
            const resolvedVersionPlans = releaseGroup.resolvedVersionPlans || [];
            // Check upfront if the release group as a whole is featured in any version plan files
            const matchingVersionPlanFiles = resolvedVersionPlans.filter((plan) => 'groupVersionBump' in plan);
            if (matchingVersionPlanFiles.length) {
                output_1.output.log({
                    title: `${releaseGroup.name === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                        ? `There are`
                        : `Release group "${releaseGroup.name}" has`} pending bumps in version plan(s)`,
                    bodyLines: [
                        ...matchingVersionPlanFiles.map((plan) => `  - "${plan.groupVersionBump}" in ${plan.fileName}`),
                    ],
                });
                continue;
            }
            const touchedProjectsUnderReleaseGroup = await getTouchedProjectsForGroup(releaseGroup, 
            // We do not take any --projects or --groups filtering into account for plan:check
            releaseGroup.projects, false);
            const projectsInResolvedVersionPlans = resolvedVersionPlans.reduce((acc, plan) => {
                if ('projectVersionBumps' in plan) {
                    for (const project in plan.projectVersionBumps) {
                        acc[project] = acc[project] || [];
                        acc[project].push({
                            bump: plan.projectVersionBumps[project],
                            fileName: plan.fileName,
                        });
                    }
                }
                return acc;
            }, {});
            // Ensure each touched project under this release group features in at least one version plan file
            let touchedProjectsNotFoundInVersionPlans = [];
            for (const touchedProject of touchedProjectsUnderReleaseGroup) {
                if (!resolvedVersionPlans.length) {
                    touchedProjectsNotFoundInVersionPlans.push(touchedProject);
                    continue;
                }
                const matchingVersionPlanFileEntries = projectsInResolvedVersionPlans[touchedProject];
                if (!matchingVersionPlanFileEntries?.length) {
                    touchedProjectsNotFoundInVersionPlans.push(touchedProject);
                    continue;
                }
            }
            // Log any resolved pending bumps, regardless of whether the projects were directly touched or not
            for (const [projectName, entries] of Object.entries(projectsInResolvedVersionPlans)) {
                output_1.output.log({
                    title: `Project "${projectName}" has pending bumps in version plan(s)`,
                    bodyLines: [
                        ...entries.map(({ bump, fileName }) => `  - "${bump}" in ${fileName}`),
                    ],
                });
            }
            if (touchedProjectsNotFoundInVersionPlans.length) {
                const bodyLines = [
                    `The following touched projects${releaseGroup.name !== config_1.IMPLICIT_DEFAULT_RELEASE_GROUP
                        ? ` under release group "${releaseGroup.name}"`
                        : ''} do not feature in any version plan files:`,
                    ...touchedProjectsNotFoundInVersionPlans.map((project) => `  - ${project}`),
                    '',
                    'Please use `nx release plan` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.',
                ];
                if (!nxArgs.verbose) {
                    bodyLines.push('', NOTE_ABOUT_VERBOSE_LOGGING);
                }
                output_1.output.error({
                    title: 'Touched projects missing version plans',
                    bodyLines,
                });
                // At least one project in one release group has an issue
                hasErrors = true;
            }
        }
        // Do not print success message if any projects are missing version plans
        if (hasErrors) {
            return 1;
        }
        const bodyLines = [];
        if (!nxArgs.verbose) {
            bodyLines.push(NOTE_ABOUT_VERBOSE_LOGGING);
        }
        output_1.output.success({
            title: 'All touched projects have, or do not require, version plans.',
            bodyLines,
        });
        return 0;
    };
}
