//! Decides which tasks a change touches, by testing the changed paths against
//! each hash-plan instruction's globs.
//!
//! Matching globs rather than resolving instructions to file lists is what makes
//! this both correct and affordable. A deleted file has no entry in the workspace
//! file map, so a resolved list can never contain it, and every rename would be
//! missed. It also inverts the cost: `O(unique instructions x changed files)`
//! instead of `O(unique instructions x files per instruction)`, and changed files
//! number in the tens where instruction filesets reach thousands.
//!
//! Instructions are interned, so the same glob set shared by a thousand tasks is
//! compiled and tested once.

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::native::affected::project_paths::{ProjectRoots, normalize_path};
use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::hash_planner::ROOT_TSCONFIG_FILES;
use crate::native::tasks::hashers::globs_from_workspace_globs;
use crate::native::tasks::types::{HashInstruction, HashPlans};

/// A changed file that reached a task, and the input pattern it reached it by.
#[napi(object)]
#[derive(Clone, Debug)]
pub struct InputMatch {
    pub file: String,
    /// The fileset that matched. Absent for an instruction with no pattern to
    /// name, such as the root tsconfig.
    pub pattern: Option<String>,
}

/// Task ids with at least one changed file among their plan's file inputs.
///
/// `changed_project_configs` is the subset of `changed_files` that is project
/// configuration, decided in TypeScript because it needs the plugins'
/// createNodes globs.
#[napi]
pub fn affected_tasks(
    project_graph: &External<Arc<ProjectGraph>>,
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
    changed_files: Vec<String>,
    changed_project_configs: Vec<String>,
) -> Result<Vec<String>> {
    Ok(compute_affected_tasks(
        project_graph,
        hash_plans,
        &changed_files,
        &changed_project_configs,
    )?)
}

/// The same selection, plus which file reached each task and how.
///
/// Separate from `affected_tasks` because the explanation costs a string per
/// match and only `--explain` reads it; the selection path stays a membership
/// test over interned instruction ids.
#[napi(ts_return_type = "Record<string, Array<InputMatch>>")]
pub fn affected_task_input_matches(
    project_graph: &External<Arc<ProjectGraph>>,
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
    changed_files: Vec<String>,
) -> Result<HashMap<String, Vec<InputMatch>>> {
    Ok(compute_input_matches(
        project_graph,
        hash_plans,
        &changed_files,
    )?)
}

pub(crate) fn compute_input_matches(
    graph: &ProjectGraph,
    hash_plans: &HashPlans,
    changed_files: &[String],
) -> anyhow::Result<HashMap<String, Vec<InputMatch>>> {
    let files: Vec<String> = changed_files.iter().map(|f| normalize_path(f)).collect();
    let roots = ProjectRoots::new(graph);
    let owners: Vec<Option<&str>> = files.iter().map(|file| roots.owner_of(file)).collect();

    let mut ids: Vec<u32> = hash_plans.plans.values().flatten().copied().collect();
    ids.par_sort_unstable();
    ids.dedup();

    // Per instruction, every file it matched and the pattern that did it. Only
    // instructions that matched something are kept.
    let matched: HashMap<u32, Vec<InputMatch>> = ids
        .par_iter()
        .map(|&id| {
            let hits = instruction_matches_detail(
                hash_plans.pool.get(id).value(),
                &files,
                &owners,
                changed_files,
            )?;
            Ok::<_, anyhow::Error>((id, hits))
        })
        .filter(|entry| entry.as_ref().map_or(true, |(_, hits)| !hits.is_empty()))
        .collect::<anyhow::Result<HashMap<_, _>>>()?;

    Ok(hash_plans
        .plans
        .par_iter()
        .filter_map(|(task_id, plan)| {
            let mut hits: Vec<InputMatch> = plan
                .iter()
                .filter_map(|id| matched.get(id))
                .flatten()
                .cloned()
                .collect();
            if hits.is_empty() {
                return None;
            }
            hits.sort_by(|a, b| a.file.cmp(&b.file).then(a.pattern.cmp(&b.pattern)));
            hits.dedup_by(|a, b| a.file == b.file && a.pattern == b.pattern);
            Some((task_id.clone(), hits))
        })
        .collect())
}

pub(crate) fn compute_affected_tasks(
    graph: &ProjectGraph,
    hash_plans: &HashPlans,
    changed_files: &[String],
    changed_project_configs: &[String],
) -> anyhow::Result<Vec<String>> {
    let files: Vec<String> = changed_files.iter().map(|f| normalize_path(f)).collect();
    // Resolved once per changed file rather than once per (file, instruction):
    // ProjectFileSet is the only kind that needs it, and many tasks share one.
    let roots = ProjectRoots::new(graph);
    let owners: Vec<Option<&str>> = files.iter().map(|file| roots.owner_of(file)).collect();

    // The projects whose configuration changed. ProjectConfiguration resolves to
    // no files, so nothing else in the plan can see this.
    let reconfigured: HashSet<&str> = changed_project_configs
        .iter()
        .filter_map(|file| roots.owner_of(&normalize_path(file)))
        .collect();

    // One entry per interned instruction actually referenced by some plan.
    let mut ids: Vec<u32> = hash_plans.plans.values().flatten().copied().collect();
    ids.par_sort_unstable();
    ids.dedup();

    // Only whether an instruction matched, never which files: the selection is
    // a membership question, and nothing downstream reads the per-file detail.
    let matched: HashSet<u32> = ids
        .par_iter()
        .map(|&id| {
            let hit = instruction_matches(
                hash_plans.pool.get(id).value(),
                &files,
                &owners,
                &reconfigured,
            )?;
            Ok::<_, anyhow::Error>((id, hit))
        })
        .filter(|entry| entry.as_ref().map_or(true, |&(_, hit)| hit))
        .map(|entry| entry.map(|(id, _)| id))
        .collect::<anyhow::Result<HashSet<_>>>()?;

    let mut affected: Vec<String> = hash_plans
        .plans
        .par_iter()
        .filter(|(_, plan)| plan.iter().any(|id| matched.contains(id)))
        .map(|(task_id, _)| task_id.clone())
        .collect();
    // `plans` is a HashMap, so sort for a reproducible answer.
    affected.par_sort_unstable();
    Ok(affected)
}

/// Whether any changed file is one this instruction would hash.
///
/// `TaskOutput` is deliberately absent: it resolves to a dependent task's build
/// artifacts, which are gitignored and do not exist yet when affected runs, so
/// intersecting it is always empty and misleadingly so. Dependency changes reach
/// a consumer through task-edge propagation instead.
/// The files an instruction matched, and which pattern reached each.
///
/// Mirrors `instruction_matches`, but reports rather than short-circuits. The
/// whole glob set decides the match, so negations still exclude; the individual
/// positives are then tested only to name the one responsible.
fn instruction_matches_detail(
    instruction: &HashInstruction,
    files: &[String],
    owners: &[Option<&str>],
    raw_files: &[String],
) -> anyhow::Result<Vec<InputMatch>> {
    let collect = |globs: &[String], project: Option<&str>| -> anyhow::Result<Vec<InputMatch>> {
        if globs.is_empty() {
            return Ok(vec![]);
        }
        let full = build_glob_set(globs)?;
        let positives: Vec<(&String, _)> = globs
            .iter()
            .filter(|glob| !glob.starts_with('!'))
            .map(|glob| build_glob_set(std::slice::from_ref(glob)).map(|set| (glob, set)))
            .collect::<anyhow::Result<Vec<_>>>()?;

        let mut matches = Vec::new();
        for (i, file) in files.iter().enumerate() {
            if project.is_some_and(|project| owners[i] != Some(project)) {
                continue;
            }
            if !full.is_match(file) {
                continue;
            }
            matches.push(InputMatch {
                // The path as it was given, not the normalized form, so it reads
                // back the same as the diff the user is looking at.
                file: raw_files[i].clone(),
                pattern: positives
                    .iter()
                    .find(|(_, set)| set.is_match(file))
                    .map(|(glob, _)| (*glob).clone()),
            });
        }
        Ok(matches)
    };

    match instruction {
        HashInstruction::WorkspaceFileSet(file_sets) => {
            collect(&globs_from_workspace_globs(file_sets), None)
        }
        HashInstruction::ProjectFileSet(project, file_sets) => collect(file_sets, Some(project)),
        HashInstruction::Files(globs) => collect(globs, None),
        HashInstruction::JsonFileSet(json) => match json.project_name.as_deref() {
            Some(project) => collect(std::slice::from_ref(&json.json_path), Some(project)),
            None => collect(
                &globs_from_workspace_globs(std::slice::from_ref(&json.json_path)),
                None,
            ),
        },
        HashInstruction::TsConfiguration(_) => Ok(files
            .iter()
            .enumerate()
            .filter(|(_, file)| ROOT_TSCONFIGS.contains(&file.as_str()))
            .map(|(i, _)| InputMatch {
                file: raw_files[i].clone(),
                pattern: None,
            })
            .collect()),
        _ => Ok(vec![]),
    }
}

fn instruction_matches(
    instruction: &HashInstruction,
    files: &[String],
    owners: &[Option<&str>],
    reconfigured: &HashSet<&str>,
) -> anyhow::Result<bool> {
    // Scoped to one project, the way the hasher scopes the same globs with
    // project_file_map, or workspace-wide when there is no owner to match.
    let any_matching = |globs: &[String], project: Option<&str>| -> anyhow::Result<bool> {
        if globs.is_empty() {
            return Ok(false);
        }
        let glob = build_glob_set(globs)?;
        Ok(files.iter().zip(owners).any(|(file, owner)| {
            project.is_none_or(|project| *owner == Some(project)) && glob.is_match(file)
        }))
    };

    match instruction {
        HashInstruction::WorkspaceFileSet(file_sets) => {
            any_matching(&globs_from_workspace_globs(file_sets), None)
        }
        HashInstruction::ProjectFileSet(project, file_sets) => {
            any_matching(file_sets, Some(project))
        }
        // Disk-expanded globs. A changed file is tracked by definition, so a
        // match here is the tracked case; untracked paths a `files` input covers
        // never appear in a diff and are handled by propagation.
        HashInstruction::Files(globs) => any_matching(globs, None),
        HashInstruction::JsonFileSet(json) => match json.project_name.as_deref() {
            Some(project) => any_matching(std::slice::from_ref(&json.json_path), Some(project)),
            None => any_matching(
                &globs_from_workspace_globs(std::slice::from_ref(&json.json_path)),
                None,
            ),
        },
        HashInstruction::TsConfiguration(_) => Ok(files
            .iter()
            .any(|f| ROOT_TSCONFIG_FILES.contains(&f.as_str()))),
        // Hashes the project's config object, which resolves to no files, so it
        // is matched on the config having changed rather than on a fileset. The
        // planner splices one of these per dependency, which is what carries a
        // dependency's config change to its consumers.
        HashInstruction::ProjectConfiguration(project) => {
            Ok(reconfigured.contains(project.as_str()))
        }
        // Not judgeable from a diff: runtime output, env, external deps, the
        // project config object, cwd, and the snapshot marker. Blanket locators
        // cover the ones that can still invalidate a task.
        _ => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::Project;
    use crate::native::tasks::types::InstructionPool;
    use std::collections::HashMap;

    fn graph(roots: &[(&str, &str)]) -> ProjectGraph {
        ProjectGraph {
            nodes: roots
                .iter()
                .map(|(name, root)| {
                    (
                        name.to_string(),
                        Project {
                            root: root.to_string(),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies: HashMap::new(),
            external_nodes: HashMap::new(),
        }
    }

    fn strings(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    /// Builds a one-task plan from the given instructions.
    fn plans(task: &str, instructions: Vec<HashInstruction>) -> HashPlans {
        let pool = Arc::new(InstructionPool::new());
        let ids = instructions.into_iter().map(|i| pool.intern(i)).collect();
        HashPlans {
            pool,
            plans: HashMap::from([(task.to_string(), ids)]),
        }
    }

    fn affected_for(
        g: &ProjectGraph,
        instructions: Vec<HashInstruction>,
        changed: &[&str],
    ) -> Vec<String> {
        let p = plans("a:build", instructions);
        compute_affected_tasks(g, &p, &strings(changed), &[]).unwrap()
    }

    #[test]
    fn workspace_fileset_matches_after_stripping_the_token() {
        let g = graph(&[("a", "libs/a")]);
        assert_eq!(
            affected_for(
                &g,
                vec![HashInstruction::WorkspaceFileSet(strings(&[
                    "{workspaceRoot}/babel.config.json"
                ]))],
                &["babel.config.json"]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn project_fileset_matches_only_inside_its_own_project() {
        let g = graph(&[("a", "libs/a"), ("b", "libs/b")]);
        let instruction = HashInstruction::ProjectFileSet("a".into(), strings(&["libs/**/*.ts"]));
        assert_eq!(
            affected_for(&g, vec![instruction.clone()], &["libs/a/src/x.ts"]),
            vec!["a:build"]
        );
        assert!(affected_for(&g, vec![instruction], &["libs/b/src/x.ts"]).is_empty());
    }

    /// The whole reason for matching globs instead of resolving file lists: a
    /// deleted path is in no file index, so a resolved list could never contain
    /// it and every rename would be missed.
    #[test]
    fn matches_a_path_with_no_file_behind_it() {
        let g = graph(&[("a", "libs/a")]);
        assert_eq!(
            affected_for(
                &g,
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/a/**/*.ts"])
                )],
                &["libs/a/src/deleted.ts"]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn task_output_never_matches() {
        let g = graph(&[("a", "libs/a")]);
        assert!(
            affected_for(
                &g,
                vec![HashInstruction::TaskOutput(
                    "**/*.js".into(),
                    strings(&["dist/libs/b"])
                )],
                &["dist/libs/b/index.js"]
            )
            .is_empty()
        );
    }

    #[test]
    fn runtime_and_environment_never_match() {
        let g = graph(&[("a", "libs/a")]);
        assert!(
            affected_for(
                &g,
                vec![
                    HashInstruction::Runtime("node -v".into()),
                    HashInstruction::Environment("CI".into()),
                    HashInstruction::AllExternalDependencies,
                ],
                &["node -v", "CI"]
            )
            .is_empty()
        );
    }

    #[test]
    fn tsconfiguration_matches_either_root_tsconfig() {
        let g = graph(&[("a", "libs/a")]);
        for file in ROOT_TSCONFIG_FILES {
            assert_eq!(
                affected_for(
                    &g,
                    vec![HashInstruction::TsConfiguration("a".into())],
                    &[file]
                ),
                vec!["a:build"],
                "{file} should mark the task affected"
            );
        }
        assert!(
            affected_for(
                &g,
                vec![HashInstruction::TsConfiguration("a".into())],
                &["libs/a/tsconfig.json"]
            )
            .is_empty(),
            "only the ROOT tsconfig counts"
        );
    }

    #[test]
    fn files_input_matches_a_tracked_path() {
        let g = graph(&[("a", "libs/a")]);
        assert_eq!(
            affected_for(
                &g,
                vec![HashInstruction::Files(strings(&[
                    "libs/a/generated/**/*.ts"
                ]))],
                &["libs/a/generated/api.ts"]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn negations_in_a_workspace_fileset_are_honoured() {
        let g = graph(&[("a", "libs/a")]);
        let instruction = HashInstruction::WorkspaceFileSet(strings(&[
            "{workspaceRoot}/config/**",
            "!{workspaceRoot}/config/local.json",
        ]));
        assert_eq!(
            affected_for(&g, vec![instruction.clone()], &["config/app.json"]),
            vec!["a:build"]
        );
        assert!(affected_for(&g, vec![instruction], &["config/local.json"]).is_empty());
    }

    /// ProjectConfiguration resolves to no files, so only a changed config for
    /// that exact project can match it. This is what carries a dependency's
    /// config change to its consumers, whose plans each carry one.
    #[test]
    fn project_configuration_matches_only_its_own_changed_config() {
        let g = graph(&[("a", "libs/a"), ("b", "libs/b")]);
        let p = plans(
            "consumer:build",
            vec![HashInstruction::ProjectConfiguration("a".into())],
        );
        let config_a = strings(&["libs/a/project.json"]);
        let config_b = strings(&["libs/b/project.json"]);

        let hit = compute_affected_tasks(&g, &p, &config_a, &config_a).unwrap();
        assert_eq!(hit, strings(&["consumer:build"]));

        // Another project's config leaves it alone.
        let miss = compute_affected_tasks(&g, &p, &config_b, &config_b).unwrap();
        assert!(miss.is_empty());

        // A source file in the same project is not a config change, so this
        // does not widen back out to project granularity.
        let source =
            compute_affected_tasks(&g, &p, &strings(&["libs/a/src/index.ts"]), &[]).unwrap();
        assert!(source.is_empty());
    }

    /// `plans` is a HashMap, so the answer has to be sorted or it varies per run.
    #[test]
    fn the_affected_list_is_sorted() {
        let g = graph(&[("a", "libs/a")]);
        let pool = Arc::new(InstructionPool::new());
        let id = pool.intern(HashInstruction::WorkspaceFileSet(strings(&[
            "{workspaceRoot}/x.txt",
        ])));
        let p = HashPlans {
            pool,
            plans: HashMap::from([
                ("z:build".to_string(), vec![id]),
                ("a:build".to_string(), vec![id]),
                ("m:build".to_string(), vec![id]),
            ]),
        };
        let affected = compute_affected_tasks(&g, &p, &strings(&["x.txt"]), &[]).unwrap();
        assert_eq!(affected, strings(&["a:build", "m:build", "z:build"]));
    }
}
