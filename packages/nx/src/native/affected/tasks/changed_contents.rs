//! What changed inside the files the hasher reads by content rather than by
//! bytes: field-filtered JSON inputs and the root tsconfig. Without it such a
//! file counts as changed whenever it is in the diff.

use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::convert::Infallible;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;

use crate::native::project_graph::types::ProjectGraph;
use crate::native::project_graph::utils::{create_project_root_mappings, find_project_for_path};
use crate::native::tasks::hashers::{OnceCache, parse_json_or_jsonc};
use crate::native::tasks::types::JsonFileSetInput;
use crate::native::utils::command::create_command;

/// Where a changed file's two versions are read: `base` from git, `head` from
/// git or, unset, the working tree.
#[napi(object)]
pub struct FileRevisions {
    pub base: String,
    pub head: Option<String>,
}

/// The root tsconfig as `TsConfiguration` hashes it: `compilerOptions.paths`
/// apart from the rest.
#[napi(object)]
pub struct TsConfigChange {
    /// Everything but `compilerOptions.paths` changed, or the file could not be
    /// compared at all.
    pub rest_changed: bool,
    /// `selectivelyHashTsConfig`: a task hashes only its own project's paths.
    /// Otherwise it hashes no paths at all.
    pub selective: bool,
    pub paths_before: HashMap<String, Vec<String>>,
    pub paths_after: HashMap<String, Vec<String>>,
}

pub(crate) struct ChangedContents<'a> {
    json: JsonFieldDiffs<'a>,
    ts_config: TsConfigTouch,
}

enum TsConfigTouch {
    /// No comparison was made: any root tsconfig in the diff touches everything.
    Unknown,
    All,
    Projects(HashSet<String>),
}

/// The field paths that changed in each JSON file, read and diffed on first use
/// so only files some field-filtered input reads are ever opened. `None` is a
/// file that counts as changed whole.
struct JsonFieldDiffs<'a> {
    workspace_root: &'a Path,
    revisions: Option<&'a FileRevisions>,
    diffs: OnceCache<Option<Vec<Vec<String>>>>,
}

impl Default for ChangedContents<'_> {
    fn default() -> Self {
        Self {
            json: JsonFieldDiffs {
                workspace_root: Path::new(""),
                revisions: None,
                diffs: OnceCache::new(),
            },
            ts_config: TsConfigTouch::Unknown,
        }
    }
}

impl<'a> ChangedContents<'a> {
    pub(crate) fn new(
        graph: &ProjectGraph,
        workspace_root: &'a str,
        revisions: Option<&'a FileRevisions>,
        ts_config: Option<&TsConfigChange>,
    ) -> Self {
        Self {
            json: JsonFieldDiffs {
                workspace_root: Path::new(workspace_root),
                revisions,
                diffs: OnceCache::new(),
            },
            ts_config: match ts_config {
                None => TsConfigTouch::Unknown,
                Some(change) if change.rest_changed => TsConfigTouch::All,
                Some(change) if !change.selective => TsConfigTouch::Projects(HashSet::new()),
                Some(change) => TsConfigTouch::Projects(projects_with_changed_paths(graph, change)),
            },
        }
    }

    /// Whether `file`, read through `json`'s field filters, can hash differently.
    pub(crate) fn json_file_changed(&self, file: &str, json: &JsonFileSetInput) -> bool {
        match self.json.changed_fields(file).as_ref() {
            Some(paths) => paths.iter().any(|path| {
                field_change_reaches_hash(
                    path,
                    json.fields.as_deref(),
                    json.exclude_fields.as_deref(),
                )
            }),
            None => true,
        }
    }

    #[cfg(test)]
    pub(crate) fn with_json_diff(self, file: &str, paths: Option<Vec<Vec<String>>>) -> Self {
        let _ = self
            .json
            .diffs
            .get_or_try_init(file.to_string(), || Ok::<_, Infallible>(paths));
        self
    }

    /// Whether `project`'s `TsConfiguration` can hash differently, given that a
    /// root tsconfig is in the diff.
    pub(crate) fn ts_config_changed(&self, project: &str) -> bool {
        match &self.ts_config {
            TsConfigTouch::Unknown | TsConfigTouch::All => true,
            TsConfigTouch::Projects(projects) => projects.contains(project),
        }
    }
}

impl JsonFieldDiffs<'_> {
    fn changed_fields(&self, file: &str) -> Arc<Option<Vec<Vec<String>>>> {
        let Ok(diff) = self
            .diffs
            .get_or_try_init(file.to_string(), || Ok::<_, Infallible>(self.diff(file)));
        diff
    }

    /// Parsed as the hasher parses it, so both agree on what a field is. Whole
    /// when a version is missing, unparseable or not an object.
    fn diff(&self, file: &str) -> Option<Vec<Vec<String>>> {
        let revisions = self.revisions?;
        let before = json_object(&self.read(file, Some(&revisions.base))?)?;
        let after = json_object(&self.read(file, revisions.head.as_deref())?)?;
        Some(changed_field_paths(&before, &after))
    }

    /// Relative to the workspace root, whichever directory the command ran in.
    fn read(&self, file: &str, revision: Option<&str>) -> Option<Vec<u8>> {
        let Some(revision) = revision else {
            return std::fs::read(self.workspace_root.join(file)).ok();
        };
        // Never an option to git.
        if revision.starts_with('-') {
            return None;
        }
        let output = create_command("git")
            .arg("show")
            .arg(format!("{revision}:./{file}"))
            .current_dir(self.workspace_root)
            .stderr(Stdio::null())
            .output()
            .ok()?;
        output.status.success().then_some(output.stdout)
    }
}

fn json_object(bytes: &[u8]) -> Option<Value> {
    parse_json_or_jsonc(bytes).filter(Value::is_object)
}

/// The field paths whose values differ, one key per segment. Objects are
/// compared key by key; anything else, arrays included, as a whole.
fn changed_field_paths(before: &Value, after: &Value) -> Vec<Vec<String>> {
    let mut changed = Vec::new();
    collect_changed(before, after, &mut Vec::new(), &mut changed);
    changed
}

fn collect_changed(
    before: &Value,
    after: &Value,
    path: &mut Vec<String>,
    changed: &mut Vec<Vec<String>>,
) {
    match (before, after) {
        (Value::Object(before), Value::Object(after)) => {
            let added = after.keys().filter(|key| !before.contains_key(*key));
            for key in before.keys().chain(added) {
                path.push(key.clone());
                match (before.get(key), after.get(key)) {
                    (Some(before), Some(after)) => collect_changed(before, after, path, changed),
                    _ => changed.push(path.clone()),
                }
                path.pop();
            }
        }
        _ if before != after => changed.push(path.clone()),
        _ => {}
    }
}

/// The projects whose paths entries, as `hash_tsconfig_selectively` filters
/// them, differ between the two versions: per changed key, the owners whose
/// own targets changed. Only changed keys are walked, not every project.
fn projects_with_changed_paths(graph: &ProjectGraph, change: &TsConfigChange) -> HashSet<String> {
    // The hasher's own mapping, so ownership agrees with the hash.
    let mappings = create_project_root_mappings(&graph.nodes);
    let keys: HashSet<&String> = change
        .paths_before
        .keys()
        .chain(change.paths_after.keys())
        .collect();
    let mut projects = HashSet::new();
    for key in keys {
        let (before, after) = (
            targets(&change.paths_before, key),
            targets(&change.paths_after, key),
        );
        if before == after {
            continue;
        }
        let (before, after) = (by_owner(before, &mappings), by_owner(after, &mappings));
        for owner in before.keys().chain(after.keys()) {
            if before.get(owner) != after.get(owner) {
                projects.insert(owner.to_string());
            }
        }
    }
    projects
}

fn targets<'a>(paths: &'a HashMap<String, Vec<String>>, key: &str) -> &'a [String] {
    paths.get(key).map_or(&[], Vec::as_slice)
}

/// `targets` grouped by owning project, in their order.
fn by_owner<'a>(
    targets: &'a [String],
    mappings: &'a HashMap<String, String>,
) -> HashMap<&'a str, Vec<&'a str>> {
    let mut owned: HashMap<&str, Vec<&str>> = HashMap::new();
    for target in targets {
        if let Some(owner) = find_project_for_path(target, mappings) {
            owned.entry(owner).or_default().push(target);
        }
    }
    owned
}

/// Mirrors `filter_json_value`: `fields` keep dot paths, `exclude_fields` then
/// drop them. A change reaches the hash unless it sits inside an excluded
/// subtree or outside every kept path.
fn field_change_reaches_hash(
    path: &[String],
    fields: Option<&[String]>,
    exclude_fields: Option<&[String]>,
) -> bool {
    let segments = |field: &str| -> Vec<String> { field.split('.').map(String::from).collect() };
    let starts_with = |long: &[String], short: &[String]| long.starts_with(short);
    if exclude_fields
        .into_iter()
        .flatten()
        .any(|excluded| starts_with(path, &segments(excluded)))
    {
        return false;
    }
    match fields {
        None => true,
        Some(fields) => fields.iter().any(|field| {
            let field = segments(field);
            starts_with(path, &field) || starts_with(&field, path)
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::test_utils::{graph_of_roots, strings};

    fn path(p: &str) -> Vec<String> {
        p.split('.').map(String::from).collect()
    }

    fn reaches(change: &str, fields: Option<&[&str]>, excluded: Option<&[&str]>) -> bool {
        let fields = fields.map(strings);
        let excluded = excluded.map(strings);
        field_change_reaches_hash(&path(change), fields.as_deref(), excluded.as_deref())
    }

    #[test]
    fn a_kept_field_or_anything_inside_it_reaches_the_hash() {
        assert!(reaches("version", Some(&["version"]), None));
        assert!(reaches("scripts.build", Some(&["scripts"]), None));
        assert!(!reaches("description", Some(&["version"]), None));
    }

    /// Replacing `compilerOptions` wholesale can change the kept `compilerOptions.target`.
    #[test]
    fn a_change_above_a_kept_nested_field_reaches_the_hash() {
        assert!(reaches(
            "compilerOptions",
            Some(&["compilerOptions.target"]),
            None
        ));
        assert!(reaches(
            "compilerOptions.target",
            Some(&["compilerOptions.target"]),
            None
        ));
        assert!(!reaches(
            "compilerOptions.lib",
            Some(&["compilerOptions.target"]),
            None
        ));
    }

    #[test]
    fn a_change_inside_an_excluded_subtree_does_not() {
        assert!(!reaches("scripts.build", None, Some(&["scripts"])));
        assert!(reaches("version", None, Some(&["scripts"])));
        // Excluding a child leaves a change to its parent in the hash.
        assert!(reaches("scripts", None, Some(&["scripts.build"])));
        assert!(!reaches(
            "scripts.build",
            Some(&["scripts"]),
            Some(&["scripts.build"])
        ));
    }

    /// Dot notation always splits, as the hasher's lookup does.
    #[test]
    fn a_key_containing_a_dot_is_not_a_nested_field() {
        let change = vec!["a.b".to_string()];
        let fields = strings(&["a.b"]);
        assert!(!field_change_reaches_hash(&change, Some(&fields), None));
    }

    fn version_only() -> JsonFileSetInput {
        JsonFileSetInput {
            project_name: None,
            json_path: "{workspaceRoot}/package.json".into(),
            fields: Some(strings(&["version"])),
            exclude_fields: None,
        }
    }

    #[test]
    fn a_file_compared_as_a_whole_or_not_at_all_counts_as_changed() {
        let contents = ChangedContents::default().with_json_diff("package.json", None);
        assert!(contents.json_file_changed("package.json", &version_only()));
        assert!(contents.json_file_changed("other/package.json", &version_only()));
    }

    #[test]
    fn changed_field_paths_descend_objects_and_compare_the_rest_whole() {
        let before = serde_json::json!({ "a": { "b": 1, "c": 2 }, "list": [1, 2], "gone": 1 });
        let after = serde_json::json!({ "a": { "b": 1, "c": 3 }, "list": [1, 3], "new": 1 });
        let mut changed = changed_field_paths(&before, &after);
        changed.sort();
        assert_eq!(
            changed,
            [vec!["a", "c"], vec!["gone"], vec!["list"], vec!["new"]]
                .map(|path| path.into_iter().map(String::from).collect::<Vec<_>>())
        );
    }

    /// A git repo whose `HEAD` has `committed` as package.json and whose working
    /// tree has `on_disk`.
    fn repo(committed: &str, on_disk: &str) -> assert_fs::TempDir {
        let dir = assert_fs::TempDir::new().unwrap();
        let git = |args: &[&str]| {
            let status = std::process::Command::new("git")
                .args([
                    "-c",
                    "user.name=t",
                    "-c",
                    "user.email=t@t",
                    "-c",
                    "commit.gpgsign=false",
                ])
                .args(args)
                .current_dir(dir.path())
                .stdout(Stdio::null())
                .status()
                .unwrap();
            assert!(status.success());
        };
        git(&["init", "-q"]);
        std::fs::write(dir.path().join("package.json"), committed).unwrap();
        git(&["add", "."]);
        git(&["commit", "-q", "-m", "base"]);
        std::fs::write(dir.path().join("package.json"), on_disk).unwrap();
        dir
    }

    fn changed_against_head(dir: &Path, head: Option<&str>) -> bool {
        let root = dir.to_str().unwrap();
        let revisions = FileRevisions {
            base: "HEAD".into(),
            head: head.map(String::from),
        };
        ChangedContents::new(&graph_of_roots(&[]), root, Some(&revisions), None)
            .json_file_changed("package.json", &version_only())
    }

    #[test]
    fn reads_the_base_from_git_and_the_head_from_the_working_tree() {
        let unrelated = repo(
            r#"{ "version": "1", "description": "a" }"#,
            r#"{ "version": "1", "description": "b" }"#,
        );
        assert!(!changed_against_head(unrelated.path(), None));
        let bumped = repo(r#"{ "version": "1" }"#, r#"{ "version": "2" }"#);
        assert!(changed_against_head(bumped.path(), None));
    }

    /// Parsed as the hasher parses it: comments and trailing commas are fine.
    #[test]
    fn parses_jsonc_like_the_hasher() {
        let dir = repo(
            "{ \"version\": \"1\" }",
            "{\n  // note\n  \"version\": \"1\",\n  \"description\": \"b\",\n}",
        );
        assert!(!changed_against_head(dir.path(), None));
    }

    #[test]
    fn a_version_that_cannot_be_read_counts_the_file_as_changed() {
        let dir = repo(r#"{ "version": "1" }"#, r#"{ "version": "1" }"#);
        // `head` names a commit that does not exist.
        assert!(changed_against_head(dir.path(), Some("does-not-exist")));
        // An option-like revision is never handed to git.
        assert!(changed_against_head(dir.path(), Some("--output=x")));
        std::fs::write(dir.path().join("package.json"), "[1]").unwrap();
        assert!(changed_against_head(dir.path(), None));
    }

    fn ts_config(rest_changed: bool, selective: bool) -> TsConfigChange {
        TsConfigChange {
            rest_changed,
            selective,
            paths_before: HashMap::from([
                ("@ws/a".to_string(), strings(&["libs/a/src/index.ts"])),
                ("@ws/b".to_string(), strings(&["libs/b/src/index.ts"])),
            ]),
            paths_after: HashMap::from([
                ("@ws/a".to_string(), strings(&["libs/a/src/main.ts"])),
                ("@ws/b".to_string(), strings(&["libs/b/src/index.ts"])),
            ]),
        }
    }

    #[test]
    fn a_selectively_hashed_paths_change_touches_only_the_project_it_maps_into() {
        let g = graph_of_roots(&[("a", "libs/a"), ("b", "libs/b")]);
        let contents = ChangedContents::new(&g, "", None, Some(&ts_config(false, true)));
        assert!(contents.ts_config_changed("a"));
        assert!(!contents.ts_config_changed("b"));
    }

    /// A key can point into several projects; only those whose own targets moved changed.
    #[test]
    fn a_shared_key_touches_only_the_project_whose_target_moved() {
        let g = graph_of_roots(&[("a", "libs/a"), ("b", "libs/b")]);
        let change = TsConfigChange {
            rest_changed: false,
            selective: true,
            paths_before: HashMap::from([(
                "@ws/*".to_string(),
                strings(&["libs/a/src/index.ts", "libs/b/src/index.ts"]),
            )]),
            paths_after: HashMap::from([(
                "@ws/*".to_string(),
                strings(&["libs/a/src/main.ts", "libs/b/src/index.ts"]),
            )]),
        };
        let contents = ChangedContents::new(&g, "", None, Some(&change));
        assert!(contents.ts_config_changed("a"));
        assert!(!contents.ts_config_changed("b"));
    }

    /// Without selective hashing no task hashes the paths at all.
    #[test]
    fn a_paths_change_touches_nothing_when_paths_are_not_hashed() {
        let g = graph_of_roots(&[("a", "libs/a"), ("b", "libs/b")]);
        let contents = ChangedContents::new(&g, "", None, Some(&ts_config(false, false)));
        assert!(!contents.ts_config_changed("a"));
        assert!(!contents.ts_config_changed("b"));
    }

    #[test]
    fn any_other_change_touches_every_project_either_way() {
        let g = graph_of_roots(&[("a", "libs/a"), ("b", "libs/b")]);
        for selective in [true, false] {
            let contents = ChangedContents::new(&g, "", None, Some(&ts_config(true, selective)));
            assert!(contents.ts_config_changed("a") && contents.ts_config_changed("b"));
        }
        assert!(ChangedContents::default().ts_config_changed("b"));
    }
}
