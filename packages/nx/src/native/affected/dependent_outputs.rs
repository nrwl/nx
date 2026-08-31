//! Which tasks read an upstream task's build artifacts, and whose.
//!
//! Neither read can be matched against the filesystem: the artifact does not
//! exist when affected runs (it is the thing the run would produce) and it is
//! gitignored, so it is in neither the file map nor the diff. Both are answered
//! from declared configuration instead.
//!
//! `TaskOutput(glob, outputs)` comes from an explicit `dependentTasksOutputFiles`
//! input, and `process_tasks_outputs` builds one per dependent task from
//! `task.outputs.clone()`. So the embedded vector *is* some producer's declared
//! outputs, and equality against `task.outputs` names that producer exactly. No
//! path or glob analysis is involved, and no dependency walk: the instruction
//! exists only because the producer was already a dependency.
//!
//! `Files(globs)` comes from an `includeIgnored` fileset. I/O tracing turns an
//! observed read of a generated artifact into one of these, which can preclude
//! the explicit input entirely, so a plan can read a dependency's output with no
//! `TaskOutput` anywhere in it. Nothing in it names a producer, so these are
//! reported as a bare flag and the caller falls back to the dependency closure.

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};

use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

#[napi(object)]
pub struct DependentOutputReads {
    /// Consumer -> the upstream tasks whose declared outputs it reads.
    pub producers: HashMap<String, Vec<String>>,
    /// Consumers carrying an `includeIgnored` read, which names no producer.
    pub reads_ignored_outputs: Vec<String>,
}

#[napi]
pub fn dependent_output_reads(
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
    task_graph: TaskGraph,
) -> DependentOutputReads {
    compute_dependent_output_reads(hash_plans, &task_graph)
}

pub(crate) fn compute_dependent_output_reads(
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
) -> DependentOutputReads {
    // Producers indexed by the exact output vector a TaskOutput would embed.
    // Two tasks declaring identical outputs both match, which is a workspace
    // that writes one directory from two tasks; over-reporting there costs a
    // cache hit, where guessing between them could skip a task that had to run.
    let mut producers_by_outputs: HashMap<&[String], Vec<&str>> = HashMap::new();
    for (id, task) in &task_graph.tasks {
        if !task.outputs.is_empty() {
            producers_by_outputs
                .entry(task.outputs.as_slice())
                .or_default()
                .push(id.as_str());
        }
    }

    // Resolved once per distinct instruction rather than once per task: one
    // instruction shared by a thousand plans is interned to a single id.
    let mut ids: Vec<u32> = hash_plans.plans.values().flatten().copied().collect();
    ids.par_sort_unstable();
    ids.dedup();

    // Cloned rather than borrowed: the pool hands out a guard that cannot
    // outlive the lookup. Distinct instructions are few, so this is bounded by
    // the number of unique dependentTasksOutputFiles inputs, not by task count.
    let mut read_outputs: HashMap<u32, Vec<String>> = HashMap::new();
    let mut ignored_reads: HashSet<u32> = HashSet::new();
    for id in ids {
        match hash_plans.pool.get(id).value() {
            HashInstruction::TaskOutput(_, outputs) => {
                read_outputs.insert(id, outputs.clone());
            }
            HashInstruction::Files(_) => {
                ignored_reads.insert(id);
            }
            _ => {}
        }
    }

    let producers: HashMap<String, Vec<String>> = hash_plans
        .plans
        .par_iter()
        .filter_map(|(consumer, plan)| {
            let mut found: Vec<String> = plan
                .iter()
                .filter_map(|id| read_outputs.get(id))
                .filter_map(|outputs| producers_by_outputs.get(outputs.as_slice()))
                .flatten()
                .map(|id| id.to_string())
                .collect();
            if found.is_empty() {
                return None;
            }
            found.sort_unstable();
            found.dedup();
            Some((consumer.clone(), found))
        })
        .collect();

    let mut reads_ignored_outputs: Vec<String> = hash_plans
        .plans
        .par_iter()
        .filter(|(_, plan)| plan.iter().any(|id| ignored_reads.contains(id)))
        .map(|(consumer, _)| consumer.clone())
        .collect();
    // `plans` is a HashMap, so sort for a reproducible answer.
    reads_ignored_outputs.par_sort_unstable();

    DependentOutputReads {
        producers,
        reads_ignored_outputs,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::{InstructionPool, Task};
    use std::sync::Arc;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    fn task_graph(tasks: &[(&str, &[&str])], deps: &[(&str, &[&str])]) -> TaskGraph {
        TaskGraph {
            tasks: tasks
                .iter()
                .map(|(id, outputs)| {
                    (
                        id.to_string(),
                        Task {
                            id: id.to_string(),
                            outputs: strings(outputs),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies: deps
                .iter()
                .map(|(id, d)| (id.to_string(), strings(d)))
                .collect(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        }
    }

    fn plans(entries: &[(&str, Vec<HashInstruction>)]) -> HashPlans {
        let pool = Arc::new(InstructionPool::new());
        HashPlans {
            plans: entries
                .iter()
                .map(|(task, instructions)| {
                    let ids = instructions
                        .iter()
                        .map(|i| pool.intern(i.clone()))
                        .collect();
                    (task.to_string(), ids)
                })
                .collect(),
            pool,
        }
    }

    /// The embedded vector is the producer's own `outputs`, so equality names it.
    #[test]
    fn resolves_the_producer_a_task_output_embeds() {
        let g = task_graph(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build"])],
        );
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::TaskOutput(
                "**/*.js".into(),
                strings(&["dist/libs/ui"]),
            )],
        )]);
        let reads = compute_dependent_output_reads(&p, &g);
        assert_eq!(reads.producers["app:build"], strings(&["ui:build"]));
        assert!(reads.reads_ignored_outputs.is_empty());
    }

    /// A dependency whose outputs the consumer does not name is not a producer.
    /// This is the case coarse propagation over-selects.
    #[test]
    fn ignores_a_dependency_it_does_not_read() {
        let g = task_graph(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("docs:build", &["dist/docs"]),
                ("app:build", &["dist/app"]),
            ],
            &[("app:build", &["ui:build", "docs:build"])],
        );
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::TaskOutput(
                "**/*.js".into(),
                strings(&["dist/libs/ui"]),
            )],
        )]);
        let reads = compute_dependent_output_reads(&p, &g);
        assert_eq!(reads.producers["app:build"], strings(&["ui:build"]));
    }

    /// An includeIgnored read names no producer, so it is reported as a flag.
    #[test]
    fn reports_an_include_ignored_read_without_a_producer() {
        let g = task_graph(&[("app:build", &["dist/app"])], &[]);
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
        )]);
        let reads = compute_dependent_output_reads(&p, &g);
        assert!(reads.producers.is_empty());
        assert_eq!(reads.reads_ignored_outputs, strings(&["app:build"]));
    }

    #[test]
    fn a_plan_reading_only_its_own_sources_reports_neither() {
        let g = task_graph(&[("app:build", &["dist/app"])], &[]);
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::ProjectFileSet(
                "app".into(),
                strings(&["apps/app/**/*"]),
            )],
        )]);
        let reads = compute_dependent_output_reads(&p, &g);
        assert!(reads.producers.is_empty());
        assert!(reads.reads_ignored_outputs.is_empty());
    }

    #[test]
    fn a_producer_with_no_declared_outputs_is_never_matched() {
        let g = task_graph(&[("ui:build", &[]), ("app:build", &["dist/app"])], &[]);
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::TaskOutput("**/*.js".into(), vec![])],
        )]);
        assert!(compute_dependent_output_reads(&p, &g).producers.is_empty());
    }
}
