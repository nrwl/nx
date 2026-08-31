//! Which tasks read an upstream task's build artifacts.
//!
//! Two instructions express that, and neither can be matched against the
//! filesystem: the artifact does not exist when affected runs (it is the thing
//! the run would produce) and it is gitignored, so it is in neither the file map
//! nor the diff.
//!
//!   `TaskOutput(glob, outputs)` comes from an explicit
//!   `dependentTasksOutputFiles` input.
//!
//!   `Files(globs)` comes from an `includeIgnored` fileset. I/O tracing turns an
//!   observed read of a generated artifact into one of these, which can preclude
//!   the explicit input entirely, so a plan can read a dependency's output with
//!   no `TaskOutput` anywhere in it.
//!
//! Only *whether* a task reads upstream artifacts is reported, not whose. The
//! caller propagates over the dependency closure, so a reader is treated as
//! reading everything it depends on. Matching each read pattern to the producer
//! whose declared outputs it overlaps distinguished 2 tasks out of 335 on this
//! repo and never selected fewer, which did not pay for the machinery it took.
//! Over-reporting costs a task that was going to be a cache hit; under-reporting
//! skips a task that needed to run.

use napi::bindgen_prelude::*;
use rayon::prelude::*;

use crate::native::tasks::types::{HashInstruction, HashPlans};

#[napi]
pub fn tasks_reading_dependent_outputs(
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
) -> Vec<String> {
    compute_tasks_reading_dependent_outputs(hash_plans)
}

pub(crate) fn compute_tasks_reading_dependent_outputs(hash_plans: &HashPlans) -> Vec<String> {
    // Resolved once per distinct instruction rather than once per task: one glob
    // set shared by a thousand tasks is interned to a single id.
    let mut ids: Vec<u32> = hash_plans.plans.values().flatten().copied().collect();
    ids.par_sort_unstable();
    ids.dedup();

    let reading: std::collections::HashSet<u32> = ids
        .into_par_iter()
        .filter(|&id| {
            matches!(
                hash_plans.pool.get(id).value(),
                HashInstruction::Files(_) | HashInstruction::TaskOutput(_, _)
            )
        })
        .collect();

    let mut tasks: Vec<String> = hash_plans
        .plans
        .par_iter()
        .filter(|(_, plan)| plan.iter().any(|id| reading.contains(id)))
        .map(|(task_id, _)| task_id.clone())
        .collect();
    // `plans` is a HashMap, so sort for a reproducible answer.
    tasks.par_sort_unstable();
    tasks
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::InstructionPool;
    use std::collections::HashMap;
    use std::sync::Arc;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
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
                        .collect::<Vec<_>>();
                    (task.to_string(), ids)
                })
                .collect::<HashMap<_, _>>(),
            pool,
        }
    }

    #[test]
    fn reports_an_explicit_dependent_tasks_output_files_input() {
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::TaskOutput(
                "dist/libs/ui/**/*".into(),
                strings(&["dist/libs/ui"]),
            )],
        )]);
        assert_eq!(
            compute_tasks_reading_dependent_outputs(&p),
            strings(&["app:build"])
        );
    }

    /// An observed read of a generated artifact arrives as an includeIgnored
    /// fileset, with no TaskOutput anywhere in the plan.
    #[test]
    fn reports_an_include_ignored_fileset() {
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::Files(strings(&["dist/libs/ui/**/*.js"]))],
        )]);
        assert_eq!(
            compute_tasks_reading_dependent_outputs(&p),
            strings(&["app:build"])
        );
    }

    #[test]
    fn ignores_a_plan_that_reads_only_its_own_sources() {
        let p = plans(&[(
            "app:build",
            vec![HashInstruction::ProjectFileSet(
                "app".into(),
                strings(&["apps/app/**/*"]),
            )],
        )]);
        assert!(compute_tasks_reading_dependent_outputs(&p).is_empty());
    }

    #[test]
    fn the_answer_is_sorted() {
        let read = HashInstruction::Files(strings(&["dist/**/*"]));
        let p = plans(&[
            ("z:build", vec![read.clone()]),
            ("a:build", vec![read.clone()]),
            ("m:build", vec![read]),
        ]);
        assert_eq!(
            compute_tasks_reading_dependent_outputs(&p),
            strings(&["a:build", "m:build", "z:build"])
        );
    }
}
