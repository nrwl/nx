//! The touched-project locators behind `nx affected`.
//!
//! Graph pruning stays in TypeScript: the native `ProjectGraph` models
//! `dependencies` as `HashMap<String, Vec<String>>`, with no edge `type` or
//! `source`, so it cannot rebuild what `filterAffected` returns.

use napi::bindgen_prelude::*;
use napi::threadsafe_function::ThreadsafeFunction;
use std::borrow::Cow;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;
use tracing::warn;

use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::{Project, ProjectGraph, Target};
use crate::native::project_graph::utils::{find_project_for_path, normalize_project_root};
use crate::native::types::{JsInputs, NxJson};

/// A locator implemented in JavaScript, called once per run with the changed paths.
///
/// `CalleeHandled = false` (the fifth generic) is load-bearing: the `true` default
/// calls back Node-style as `(err, value)`, which the hand-written `ts_arg_type`
/// below would not reflect. Never hold one of these on a `#[napi]` struct — it
/// keeps an event-loop reference and the host never exits.
pub type JsLocator =
    ThreadsafeFunction<Vec<String>, Promise<Vec<String>>, Vec<String>, Status, false>;

#[napi(object)]
pub struct AffectedOptions {
    /// `createNodes` globs of every loaded plugin. Resolved in TypeScript because
    /// `getPlugins` is async and spawns plugin workers.
    pub project_glob_patterns: Vec<String>,
    pub project_deletion_affects_all_projects: bool,
    pub workspace_root: String,
}

/// Runs every locator and returns the touched project names, in locator order,
/// unsorted overall and with duplicates. Callers dedupe by walking the graph.
///
/// Every branch is deterministic, and must stay so: this order reaches
/// `result.nodes` insertion order and so `nx show projects --affected`.
#[napi]
pub async fn locate_touched_projects(
    project_graph: &External<Arc<ProjectGraph>>,
    nx_json: NxJson,
    touched_files: Vec<String>,
    options: AffectedOptions,
    #[napi(ts_arg_type = "Array<(files: string[]) => Promise<string[]>>")] js_locators: Vec<
        JsLocator,
    >,
) -> Result<Vec<String>> {
    let graph = Arc::clone(&*project_graph);
    let mut touched: Vec<String> = Vec::new();

    touched.extend(touched_projects(&graph, &touched_files));
    touched.extend(implicitly_touched_projects(
        &graph,
        &nx_json,
        &touched_files,
    )?);
    touched.extend(projects_from_project_glob_changes(
        &graph,
        &touched_files,
        &options,
    )?);

    for locator in js_locators {
        let promise = locator.call_async(touched_files.clone()).await?;
        touched.extend(promise.await?);
    }

    Ok(touched)
}

/// Maps each changed file to the project that owns it.
///
/// The mapping is built here rather than with `create_project_root_mappings`,
/// which normalizes the project *name* into the value instead of the root into
/// the key and so cannot match a project whose root is `""`.
fn touched_projects(graph: &ProjectGraph, touched_files: &[String]) -> Vec<String> {
    let root_map: HashMap<String, String> = graph
        .nodes
        .iter()
        .map(|(name, project)| (normalize_project_root(&project.root), name.clone()))
        .collect();

    touched_files
        .iter()
        .filter_map(|file| find_project_for_path(normalize_path(file), &root_map).map(String::from))
        .collect()
}

/// Mirrors `normalizePath` in `packages/nx/src/utils/path.ts`: strip a Windows
/// drive letter, then swap separators. Root keys are unix-style, and `--files`
/// reaches us exactly as the user typed it, so a Windows path matches nothing
/// without this.
fn normalize_path(path: &str) -> String {
    let without_drive = match path.as_bytes() {
        [drive, b':', ..] if drive.is_ascii_alphabetic() => &path[2..],
        _ => path,
    };
    without_drive.replace('\\', "/")
}

/// What a matched implicit pattern marks affected.
enum Implicit<'a> {
    AllProjects,
    Projects(Vec<&'a str>),
}

/// Matches changed files against `nx.json` and against every `{workspaceRoot}/…`
/// fileset declared by a target input.
fn implicitly_touched_projects(
    graph: &ProjectGraph,
    nx_json: &NxJson,
    touched_files: &[String],
) -> Result<Vec<String>> {
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

    let mut touched: BTreeSet<&str> = BTreeSet::new();
    for (pattern, implicit) in &implicits {
        // An unparseable fileset matches nothing, as it did under minimatch.
        // Aborting the whole command over one malformed pattern would be a new
        // failure mode on a path that never reaches the hasher.
        let Ok(glob) = build_glob_set(&[*pattern]) else {
            warn!("ignoring unparseable input fileset: {{workspaceRoot}}/{pattern}");
            continue;
        };
        if !touched_files.iter().any(|file| glob.is_match(file)) {
            continue;
        }
        match implicit {
            Implicit::AllProjects => return Ok(all_project_names(graph)),
            Implicit::Projects(projects) => touched.extend(projects.iter().copied()),
        }
    }

    Ok(touched.into_iter().map(String::from).collect())
}

/// Sorted, because `ProjectGraph.nodes` is a `HashMap` and callers surface this
/// list directly — `nx show projects --affected --json` would otherwise emit the
/// same set in a different order on every run.
fn all_project_names(graph: &ProjectGraph) -> Vec<String> {
    let mut names: Vec<String> = graph.nodes.keys().cloned().collect();
    names.sort();
    names
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
            Either10::B(value) => {
                if let Some(referenced) = named_inputs.get(value.as_str()) {
                    if visiting.insert(value.as_str()) {
                        collect_filesets(referenced, named_inputs, visiting, out);
                        visiting.remove(value.as_str());
                    }
                } else if let Some(rest) = value.strip_prefix(WORKSPACE_ROOT) {
                    out.push(rest);
                }
            }
            Either10::C(file_set) => {
                if let Some(rest) = file_set.fileset.strip_prefix(WORKSPACE_ROOT) {
                    out.push(rest);
                }
            }
            _ => {}
        }
    }
}

/// A deleted project-configuration file invalidates the whole graph unless the
/// caller opts out: the project it described is gone and has no tasks left to
/// reason about. A modified one needs no handling — it lives under its project
/// root, so `touched_projects` already caught it.
fn projects_from_project_glob_changes(
    graph: &ProjectGraph,
    touched_files: &[String],
    options: &AffectedOptions,
) -> Result<Vec<String>> {
    // Load-bearing: with both the included and excluded sets empty, `is_match`
    // returns `!excluded.is_match(..)`, i.e. true for every file.
    if options.project_glob_patterns.is_empty() {
        return Ok(Vec::new());
    }
    let Ok(glob) = build_glob_set(&options.project_glob_patterns) else {
        warn!("ignoring unparseable plugin createNodes globs, no project config change detected");
        return Ok(Vec::new());
    };
    let workspace_root = Path::new(&options.workspace_root);

    // Raw, not normalized: the TypeScript this replaced matched and stat'd the
    // path exactly as given. Normalizing here would make a Windows path absolute
    // after the drive letter is stripped, and `Path::join` drops the base on an
    // absolute component, so the probe would stat outside the workspace.
    for file in touched_files {
        if !glob.is_match(file) {
            continue;
        }
        if workspace_root.join(file).exists() {
            continue;
        }
        if options.project_deletion_affects_all_projects {
            return Ok(all_project_names(graph));
        }
    }

    Ok(Vec::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(root: &str) -> Project {
        Project {
            root: root.into(),
            ..Default::default()
        }
    }

    fn graph(projects: Vec<(&str, Project)>) -> ProjectGraph {
        ProjectGraph {
            nodes: projects
                .into_iter()
                .map(|(name, p)| (name.to_string(), p))
                .collect(),
            dependencies: HashMap::new(),
            external_nodes: HashMap::new(),
        }
    }

    fn files(paths: &[&str]) -> Vec<String> {
        paths.iter().map(|p| p.to_string()).collect()
    }

    fn string_inputs(values: &[&str]) -> Vec<JsInputs> {
        values.iter().map(|v| Either10::B(v.to_string())).collect()
    }

    fn target_with_inputs(inputs: &[&str]) -> Target {
        Target {
            inputs: Some(string_inputs(inputs)),
            ..Default::default()
        }
    }

    // --- touched_projects -----------------------------------------------------

    /// Unsorted: `touched_projects` emits one entry per changed file, in input
    /// order, and downstream dedupes.
    #[test]
    fn maps_each_changed_file_to_its_owning_project() {
        let g = graph(vec![
            ("a", project("libs/a")),
            ("b", project("libs/b")),
            ("c", project("libs/c")),
        ]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/b/index.ts", "libs/a/index.ts"])),
            vec!["b", "a"]
        );
    }

    /// `--files` arrives exactly as typed, so a Windows path has to resolve. The
    /// TS this replaced ran `normalizePath` first.
    #[test]
    fn resolves_windows_style_paths() {
        let g = graph(vec![("a", project("libs/a"))]);
        assert_eq!(
            touched_projects(&g, &files(&["libs\\a\\index.ts"])),
            vec!["a"]
        );
        // Parity, not an improvement: stripping the drive letter still leaves a
        // leading slash, which matches no root key. `normalizePath` did the same.
        assert!(touched_projects(&g, &files(&["C:\\libs\\a\\index.ts"])).is_empty());
    }

    #[test]
    fn matches_a_root_only_on_whole_directory_names() {
        let g = graph(vec![
            ("a", project("libs/a")),
            ("abc", project("libs/a-b-c")),
            ("ab", project("libs/a-b")),
        ]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/a-b/index.ts"])),
            vec!["ab"]
        );
    }

    #[test]
    fn prefers_the_most_qualifying_root() {
        let g = graph(vec![
            ("aaaaa", project("libs/a")),
            ("ab", project("libs/a/b")),
        ]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/a/b/index.ts"])),
            vec!["ab"]
        );
    }

    #[test]
    fn does_not_return_the_parent_when_a_nested_project_is_touched() {
        let g = graph(vec![("a", project("libs/a")), ("b", project("libs/a/b"))]);
        assert_eq!(
            touched_projects(&g, &files(&["libs/a/b/index.ts"])),
            vec!["b"]
        );
    }

    /// The TypeScript original normalized the root into the map key, so a
    /// root-level project is reachable. `create_project_root_mappings` does not,
    /// which is why this module builds its own mapping.
    #[test]
    fn finds_a_project_whose_root_is_empty() {
        let g = graph(vec![("root", project(""))]);
        assert_eq!(touched_projects(&g, &files(&["README.md"])), vec!["root"]);
    }

    // --- implicitly_touched_projects -----------------------------------------

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

    /// Asserted unsorted: `nx show projects --affected --json` surfaces this list
    /// directly, and `ProjectGraph.nodes` is a `HashMap`, so without the sort the
    /// same set comes back in a different order every run.
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

    /// A malformed fileset matched nothing under minimatch; it must not abort the
    /// command now.
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

    // --- projects_from_project_glob_changes -----------------------------------

    fn glob_options(deletion_affects_all: bool) -> AffectedOptions {
        AffectedOptions {
            project_glob_patterns: vec!["**/project.json".to_string()],
            project_deletion_affects_all_projects: deletion_affects_all,
            // Nothing exists under this root, so every matched file reads as deleted.
            workspace_root: "/nx-affected-tests-nonexistent".to_string(),
        }
    }

    /// Asserted unsorted, for the same reason as the `nx.json` case.
    #[test]
    fn a_deleted_project_config_affects_every_project() {
        let g = graph(vec![
            ("zebra", project("libs/zebra")),
            ("alpha", project("libs/alpha")),
            ("mike", project("libs/mike")),
        ]);
        assert_eq!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/zebra/project.json"]),
                &glob_options(true)
            )
            .unwrap(),
            vec!["alpha", "mike", "zebra"]
        );
    }

    #[test]
    fn the_deletion_fallback_can_be_disabled() {
        let g = graph(vec![
            ("proj1", project("libs/proj1")),
            ("proj2", project("libs/proj2")),
        ]);
        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/removed/project.json"]),
                &glob_options(false)
            )
            .unwrap()
            .is_empty()
        );
    }

    /// The deletion probe must not escape the workspace root. Normalizing the
    /// path first would strip `C:` and leave an absolute `/…`, which `Path::join`
    /// resolves *outside* the root — unlike Node's `path.join`, which the TS used.
    #[test]
    fn the_deletion_probe_never_escapes_the_workspace_root() {
        let g = graph(vec![("proj1", project("libs/proj1"))]);
        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["C:\\etc\\project.json"]),
                &glob_options(true)
            )
            .unwrap()
            .is_empty()
        );
    }

    #[test]
    fn a_changed_file_that_is_not_a_project_config_affects_nothing() {
        let g = graph(vec![("proj1", project("libs/proj1"))]);
        assert!(
            projects_from_project_glob_changes(
                &g,
                &files(&["libs/proj1/src/index.ts"]),
                &glob_options(true)
            )
            .unwrap()
            .is_empty()
        );
    }
}
