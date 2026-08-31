use napi::bindgen_prelude::*;
use std::borrow::Cow;
use std::collections::{BTreeMap, HashMap, HashSet};
use tracing::warn;

use super::{
    KIND_IMPLICIT_DEPENDENCY, KIND_WORKSPACE_CONFIGURATION, TouchedProject, all_projects_touched_by,
};
use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::{Project, ProjectGraph, Target};
use crate::native::types::{JsInputs, NxJson};

/// What a matched implicit pattern marks affected.
enum Implicit<'a> {
    AllProjects,
    Projects(Vec<&'a str>),
}

/// Matches changed files against `nx.json` and against every `{workspaceRoot}/…`
/// fileset declared by a target input.
pub(super) fn implicitly_touched_projects(
    graph: &ProjectGraph,
    nx_json: &NxJson,
    touched_files: &[String],
) -> Result<Vec<TouchedProject>> {
    // BTreeMap so the pattern scan is reproducible. Order does not change the
    // result either way: an `AllProjects` hit returns every project whenever it
    // is reached, and the rest accumulate into a set.
    let mut implicits: std::collections::BTreeMap<&str, Implicit> = Default::default();
    implicits.insert("nx.json", Implicit::AllProjects);

    let base_named_inputs = nx_json_named_inputs(nx_json);
    let mut visiting: HashSet<&str> = HashSet::new();
    let mut filesets: Vec<&str> = Vec::new();

    for (name, project) in &graph.nodes {
        let named_inputs = merged_named_inputs(&base_named_inputs, project);
        filesets.clear();
        visiting.clear();
        workspace_root_filesets(
            &project.targets,
            &named_inputs,
            &mut visiting,
            &mut filesets,
        );
        for pattern in filesets.drain(..) {
            let entry = implicits
                .entry(pattern)
                .or_insert_with(|| Implicit::Projects(Vec::new()));
            // `nx.json` stays AllProjects even if a target declares it as an input.
            if let Implicit::Projects(projects) = entry {
                projects.push(name.as_str());
            }
        }
    }

    // Keyed by project so a project matched by several filesets reports each,
    // rather than the first one to fire.
    let mut touched: BTreeMap<&str, Vec<(&str, &String)>> = BTreeMap::new();
    for (pattern, implicit) in &implicits {
        // An unparseable fileset matches nothing. Minimatch read it as literal
        // text, so at base `{workspaceRoot}/config/[dev.json` marked its project
        // affected by that exact file; the hasher rejects the same glob, so no
        // task hashing it ever ran. Aborting the whole command over one
        // malformed pattern would be a new failure mode.
        let Ok(glob) = build_glob_set(&[*pattern]) else {
            warn!("ignoring unparseable input fileset: {{workspaceRoot}}/{pattern}");
            continue;
        };
        let Some(matched) = touched_files.iter().find(|file| glob.is_match(file)) else {
            continue;
        };
        match implicit {
            Implicit::AllProjects => {
                return Ok(all_projects_touched_by(
                    graph,
                    KIND_WORKSPACE_CONFIGURATION,
                    Some(matched),
                    Some(pattern),
                ));
            }
            Implicit::Projects(projects) => {
                for project in projects {
                    touched.entry(project).or_default().push((pattern, matched));
                }
            }
        }
    }

    Ok(touched
        .into_iter()
        .flat_map(|(project, matches)| {
            matches
                .into_iter()
                .map(move |(pattern, file)| TouchedProject {
                    project: project.to_string(),
                    kind: KIND_IMPLICIT_DEPENDENCY.to_string(),
                    file: Some(file.clone()),
                    pattern: Some(pattern.to_string()),
                })
        })
        .collect())
}

type NamedInputs<'a> = HashMap<&'a str, &'a Vec<JsInputs>>;

fn nx_json_named_inputs(nx_json: &NxJson) -> NamedInputs<'_> {
    nx_json
        .named_inputs
        .iter()
        .flat_map(|named| named.iter().map(|(k, v)| (k.as_str(), v)))
        .collect()
}

/// Borrows the workspace-level map unless the project overrides something, so
/// only projects that declare their own `namedInputs` pay for a map. Most do
/// not, and this runs once per project on every `nx affected`.
fn merged_named_inputs<'a>(
    base: &'a NamedInputs<'a>,
    project: &'a Project,
) -> Cow<'a, NamedInputs<'a>> {
    match &project.named_inputs {
        Some(own) if !own.is_empty() => {
            let mut merged = base.clone();
            merged.extend(own.iter().map(|(k, v)| (k.as_str(), v)));
            Cow::Owned(merged)
        }
        _ => Cow::Borrowed(base),
    }
}

/// Collects `{workspaceRoot}/…` filesets from every target's inputs, with the
/// `{workspaceRoot}/` prefix stripped. `out` and `visiting` are caller-owned so
/// the per-project loop reuses one allocation instead of 2N.
fn workspace_root_filesets<'a>(
    targets: &'a HashMap<String, Target>,
    named_inputs: &NamedInputs<'a>,
    visiting: &mut HashSet<&'a str>,
    out: &mut Vec<&'a str>,
) {
    for target in targets.values() {
        if let Some(inputs) = &target.inputs {
            collect_filesets(inputs, named_inputs, visiting, out);
        }
    }
}

const WORKSPACE_ROOT: &str = "{workspaceRoot}/";

fn collect_filesets<'a>(
    inputs: &'a [JsInputs],
    named_inputs: &NamedInputs<'a>,
    // Guards a named input that references itself. The TypeScript original
    // recurses unguarded and overflows the stack on such a config.
    visiting: &mut HashSet<&'a str>,
    out: &mut Vec<&'a str>,
) {
    for input in inputs {
        match input {
            Either9::B(value) => {
                if let Some(referenced) = named_inputs.get(value.as_str()) {
                    if visiting.insert(value.as_str()) {
                        collect_filesets(referenced, named_inputs, visiting, out);
                        visiting.remove(value.as_str());
                    }
                } else if let Some(rest) = value.strip_prefix(WORKSPACE_ROOT) {
                    out.push(rest);
                }
            }
            Either9::C(file_set) => {
                if let Some(rest) = file_set.fileset.strip_prefix(WORKSPACE_ROOT) {
                    out.push(rest);
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::{files, graph, names, project};
    use super::*;

    fn implicitly_touched_projects(
        graph: &ProjectGraph,
        nx_json: &NxJson,
        touched_files: &[String],
    ) -> Result<Vec<String>> {
        Ok(names(super::implicitly_touched_projects(
            graph,
            nx_json,
            touched_files,
        )?))
    }

    fn string_inputs(values: &[&str]) -> Vec<JsInputs> {
        values.iter().map(|v| Either9::B(v.to_string())).collect()
    }

    fn fileset_inputs(values: &[(&str, bool)]) -> Vec<JsInputs> {
        use crate::native::types::FileSetInput;
        values
            .iter()
            .map(|(fileset, include_ignored)| {
                Either9::C(FileSetInput {
                    fileset: (*fileset).to_string(),
                    dependencies: None,
                    include_ignored: Some(*include_ignored),
                })
            })
            .collect()
    }

    fn target_with_inputs(inputs: &[&str]) -> Target {
        Target {
            inputs: Some(string_inputs(inputs)),
            ..Default::default()
        }
    }

    fn nx_json_with_files_named_input() -> NxJson {
        NxJson {
            named_inputs: Some(HashMap::from([(
                "files".to_string(),
                string_inputs(&["{workspaceRoot}/a.txt"]),
            )])),
        }
    }

    #[test]
    fn returns_projects_whose_named_input_covers_a_changed_file() {
        let mut a = project("a");
        a.named_inputs = Some(HashMap::from([(
            "projectSpecificFiles".to_string(),
            string_inputs(&["{workspaceRoot}/a.txt"]),
        )]));
        a.targets = HashMap::from([(
            "build".to_string(),
            target_with_inputs(&["projectSpecificFiles"]),
        )]);
        let g = graph(vec![("a", a), ("b", project("b"))]);

        assert_eq!(
            implicitly_touched_projects(&g, &nx_json_with_files_named_input(), &files(&["a.txt"]))
                .unwrap(),
            vec!["a"]
        );
    }

    #[test]
    fn returns_projects_whose_target_input_covers_a_changed_file() {
        let mut a = project("a");
        a.targets = HashMap::from([(
            "build".to_string(),
            target_with_inputs(&["{workspaceRoot}/a.txt"]),
        )]);
        let g = graph(vec![("a", a), ("b", project("b"))]);

        assert_eq!(
            implicitly_touched_projects(&g, &nx_json_with_files_named_input(), &files(&["a.txt"]))
                .unwrap(),
            vec!["a"]
        );
    }

    #[test]
    fn includes_disk_backed_filesets_in_implicit_projects() {
        let mut a = project("a");
        a.targets = HashMap::from([(
            "build".to_string(),
            Target {
                inputs: Some(fileset_inputs(&[("{workspaceRoot}/generated", true)])),
                ..Default::default()
            },
        )]);
        let g = graph(vec![("a", a), ("b", project("b"))]);

        assert_eq!(
            implicitly_touched_projects(
                &g,
                &nx_json_with_files_named_input(),
                &files(&["generated"])
            )
            .unwrap(),
            vec!["a"]
        );
    }

    #[test]
    fn resolves_named_inputs_declared_in_nx_json() {
        let mut a = project("a");
        a.targets = HashMap::from([(
            "build".to_string(),
            target_with_inputs(&["files", "{workspaceRoot}/b.txt"]),
        )]);
        let g = graph(vec![("a", a), ("b", project("b"))]);
        let nx_json = nx_json_with_files_named_input();

        assert_eq!(
            implicitly_touched_projects(&g, &nx_json, &files(&["a.txt"])).unwrap(),
            vec!["a"]
        );
        assert_eq!(
            implicitly_touched_projects(&g, &nx_json, &files(&["b.txt"])).unwrap(),
            vec!["a"]
        );
    }

    #[test]
    fn ignores_named_inputs_no_target_references() {
        let mut a = project("a");
        a.named_inputs = Some(HashMap::from([(
            "files".to_string(),
            string_inputs(&["{workspaceRoot}/a.txt"]),
        )]));
        let g = graph(vec![("a", a), ("b", project("b"))]);

        assert!(
            implicitly_touched_projects(&g, &nx_json_with_files_named_input(), &files(&["a.txt"]))
                .unwrap()
                .is_empty()
        );
    }

    /// Asserted sorted: `nx show projects --affected --json` surfaces this list
    /// directly, and `ProjectGraph.nodes` is a `HashMap`, so without the sort the
    /// same set would come back in a different order every run.
    #[test]
    fn returns_every_project_when_nx_json_is_touched() {
        let g = graph(vec![
            ("zebra", project("zebra")),
            ("alpha", project("alpha")),
            ("mike", project("mike")),
        ]);
        assert_eq!(
            implicitly_touched_projects(
                &g,
                &nx_json_with_files_named_input(),
                &files(&["nx.json"])
            )
            .unwrap(),
            vec!["alpha", "mike", "zebra"]
        );
    }

    /// A malformed fileset is skipped with a warning rather than aborting the
    /// command. Minimatch read it as literal text, so this is the one narrowing
    /// the PR body lists: at base the exact file marked the project affected.
    #[test]
    fn an_unparseable_fileset_is_ignored_rather_than_fatal() {
        let mut a = project("a");
        a.targets = HashMap::from([(
            "build".to_string(),
            target_with_inputs(&["{workspaceRoot}/config/[dev.json"]),
        )]);
        let g = graph(vec![("a", a)]);

        assert!(
            implicitly_touched_projects(
                &g,
                &nx_json_with_files_named_input(),
                &files(&["config/dev.json"])
            )
            .unwrap()
            .is_empty()
        );
    }

    /// A named input that references itself terminates instead of overflowing
    /// the stack, which the TypeScript original did not guard against.
    #[test]
    fn terminates_on_a_self_referencing_named_input() {
        let mut a = project("a");
        a.named_inputs = Some(HashMap::from([(
            "loop".to_string(),
            string_inputs(&["loop", "{workspaceRoot}/a.txt"]),
        )]));
        a.targets = HashMap::from([("build".to_string(), target_with_inputs(&["loop"]))]);
        let g = graph(vec![("a", a)]);

        assert_eq!(
            implicitly_touched_projects(&g, &nx_json_with_files_named_input(), &files(&["a.txt"]))
                .unwrap(),
            vec!["a"]
        );
    }

    /// An implicit hit reports the fileset that matched, since that is the
    /// configuration the reader has to go and look at.
    #[test]
    fn an_implicit_hit_names_the_fileset_and_the_file() {
        let mut a = project("a");
        a.targets = HashMap::from([("build".to_string(), target_with_inputs(&["files"]))]);
        let g = graph(vec![("a", a)]);
        let touched = super::implicitly_touched_projects(
            &g,
            &nx_json_with_files_named_input(),
            &files(&["a.txt"]),
        )
        .unwrap();
        assert!(!touched.is_empty());
        assert_eq!(touched[0].kind, KIND_IMPLICIT_DEPENDENCY);
        assert_eq!(touched[0].file.as_deref(), Some("a.txt"));
        assert!(touched[0].pattern.is_some());
    }

    /// nx.json marks everything, and every entry carries the same reason so
    /// no project is left unexplained.
    #[test]
    fn changing_nx_json_explains_every_project() {
        let g = graph(vec![("a", project("a")), ("b", project("b"))]);
        let touched = super::implicitly_touched_projects(
            &g,
            &NxJson { named_inputs: None },
            &files(&["nx.json"]),
        )
        .unwrap();
        assert_eq!(touched.len(), 2);
        for entry in &touched {
            assert_eq!(entry.kind, KIND_WORKSPACE_CONFIGURATION);
            assert_eq!(entry.file.as_deref(), Some("nx.json"));
        }
    }
}
