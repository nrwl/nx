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
use std::collections::HashMap;
use std::sync::Arc;

use crate::native::affected::normalize_path;
use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::ProjectGraph;
use crate::native::project_graph::utils::{find_project_for_path, normalize_project_root};
use crate::native::tasks::hashers::globs_from_workspace_globs;
use crate::native::tasks::types::{HashInstruction, HashPlans};

#[napi(object)]
pub struct AffectedTasks {
    /// Task ids with at least one changed file among their plan's file inputs.
    pub affected: Vec<String>,
    /// taskId -> the changed files that matched. Only when `collectMatches`.
    pub matches: Option<HashMap<String, Vec<String>>>,
}

/// The root tsconfig names `TsConfiguration` hashes, in the hasher's own
/// preference order (`hash_tsconfig`).
const ROOT_TSCONFIGS: [&str; 2] = ["tsconfig.base.json", "tsconfig.json"];

#[napi]
pub fn affected_tasks(
    project_graph: &External<Arc<ProjectGraph>>,
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
    changed_files: Vec<String>,
    collect_matches: Option<bool>,
) -> Result<AffectedTasks> {
    Ok(compute_affected_tasks(
        project_graph,
        hash_plans,
        &changed_files,
        collect_matches.unwrap_or(false),
    )?)
}

pub(crate) fn compute_affected_tasks(
    graph: &ProjectGraph,
    hash_plans: &HashPlans,
    changed_files: &[String],
    collect_matches: bool,
) -> anyhow::Result<AffectedTasks> {
    let files: Vec<String> = changed_files.iter().map(|f| normalize_path(f)).collect();
    // Resolved once per changed file rather than once per (file, instruction):
    // ProjectFileSet is the only kind that needs it, and many tasks share one.
    let owners: Vec<Option<String>> = {
        let root_map: HashMap<String, String> = graph
            .nodes
            .iter()
            .map(|(name, project)| (normalize_project_root(&project.root), name.clone()))
            .collect();
        files
            .iter()
            .map(|file| find_project_for_path(file, &root_map).map(String::from))
            .collect()
    };

    // One entry per interned instruction actually referenced by some plan.
    let mut ids: Vec<u32> = hash_plans.plans.values().flatten().copied().collect();
    ids.par_sort_unstable();
    ids.dedup();

    let matched_by_id: HashMap<u32, Vec<usize>> = ids
        .par_iter()
        .map(|&id| {
            let instruction = hash_plans.pool.get(id);
            let hits = match_instruction(instruction.value(), &files, &owners)?;
            Ok::<_, anyhow::Error>((id, hits))
        })
        .filter(|entry| entry.as_ref().map(|(_, h)| !h.is_empty()).unwrap_or(true))
        .collect::<anyhow::Result<HashMap<_, _>>>()?;

    let mut affected: Vec<String> = Vec::new();
    let mut matches: HashMap<String, Vec<String>> = HashMap::new();
    for (task_id, plan) in &hash_plans.plans {
        let hits: Vec<usize> = plan
            .iter()
            .filter_map(|id| matched_by_id.get(id))
            .flatten()
            .copied()
            .collect();
        if hits.is_empty() {
            continue;
        }
        affected.push(task_id.clone());
        if collect_matches {
            let mut paths: Vec<String> =
                hits.into_iter().map(|i| changed_files[i].clone()).collect();
            paths.sort();
            paths.dedup();
            matches.insert(task_id.clone(), paths);
        }
    }
    // `plans` is a HashMap, so sort for a reproducible answer.
    affected.sort();

    Ok(AffectedTasks {
        affected,
        matches: collect_matches.then_some(matches),
    })
}

/// Indices of the changed files this instruction would hash.
///
/// `TaskOutput` is deliberately absent: it resolves to a dependent task's build
/// artifacts, which are gitignored and do not exist yet when affected runs, so
/// intersecting it is always empty and misleadingly so. Dependency changes reach
/// a consumer through task-edge propagation instead.
fn match_instruction(
    instruction: &HashInstruction,
    files: &[String],
    owners: &[Option<String>],
) -> anyhow::Result<Vec<usize>> {
    match instruction {
        HashInstruction::WorkspaceFileSet(file_sets) => {
            let globs = globs_from_workspace_globs(file_sets);
            if globs.is_empty() {
                return Ok(vec![]);
            }
            let glob = build_glob_set(&globs)?;
            Ok(matching(files, |f| glob.is_match(f)))
        }
        HashInstruction::ProjectFileSet(project, file_sets) => {
            let glob = build_glob_set(file_sets)?;
            // Membership stands in for "is in project_file_map[project]", which
            // is how the hasher scopes the same globs.
            Ok(files
                .iter()
                .enumerate()
                .filter(|(i, f)| {
                    owners[*i].as_deref() == Some(project.as_str()) && glob.is_match(f)
                })
                .map(|(i, _)| i)
                .collect())
        }
        // Disk-expanded globs. A changed file is tracked by definition, so a
        // match here is the tracked case; untracked paths a `files` input covers
        // never appear in a diff and are handled by propagation.
        HashInstruction::Files(globs) => {
            let glob = build_glob_set(globs)?;
            Ok(matching(files, |f| glob.is_match(f)))
        }
        HashInstruction::JsonFileSet(json) => {
            if let Some(project) = json.project_name.as_deref() {
                let glob = build_glob_set(&[json.json_path.clone()])?;
                Ok(files
                    .iter()
                    .enumerate()
                    .filter(|(i, f)| owners[*i].as_deref() == Some(project) && glob.is_match(f))
                    .map(|(i, _)| i)
                    .collect())
            } else {
                let globs = globs_from_workspace_globs(&[json.json_path.clone()]);
                if globs.is_empty() {
                    return Ok(vec![]);
                }
                let glob = build_glob_set(&globs)?;
                Ok(matching(files, |f| glob.is_match(f)))
            }
        }
        HashInstruction::TsConfiguration(_) => {
            Ok(matching(files, |f| ROOT_TSCONFIGS.contains(&f.as_str())))
        }
        // Not judgeable from a diff: runtime output, env, external deps, the
        // project config object, cwd, and the snapshot marker. Blanket locators
        // cover the ones that can still invalidate a task.
        _ => Ok(vec![]),
    }
}

fn matching(files: &[String], predicate: impl Fn(&String) -> bool) -> Vec<usize> {
    files
        .iter()
        .enumerate()
        .filter(|(_, f)| predicate(f))
        .map(|(i, _)| i)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::Project;
    use crate::native::tasks::types::InstructionPool;

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
        compute_affected_tasks(g, &p, &strings(changed), false)
            .unwrap()
            .affected
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
    fn a_deleted_file_still_matches() {
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
        for file in ROOT_TSCONFIGS {
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

    #[test]
    fn reports_which_files_matched_when_asked() {
        let g = graph(&[("a", "libs/a")]);
        let p = plans(
            "a:build",
            vec![HashInstruction::ProjectFileSet(
                "a".into(),
                strings(&["libs/a/**/*.ts"]),
            )],
        );
        let result = compute_affected_tasks(
            &g,
            &p,
            &strings(&["libs/a/x.ts", "libs/a/y.ts", "README.md"]),
            true,
        )
        .unwrap();
        assert_eq!(
            result.matches.unwrap().get("a:build").unwrap(),
            &strings(&["libs/a/x.ts", "libs/a/y.ts"])
        );
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
        let result = compute_affected_tasks(&g, &p, &strings(&["x.txt"]), false).unwrap();
        assert_eq!(result.affected, strings(&["a:build", "m:build", "z:build"]));
    }
}
