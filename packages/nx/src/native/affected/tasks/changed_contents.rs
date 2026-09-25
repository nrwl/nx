//! What changed inside the files the hasher reads by content rather than by
//! bytes: field-filtered JSON inputs and the root tsconfig. Without it such a
//! file counts as changed whenever it is in the diff.

use std::collections::{HashMap, HashSet};

use crate::native::project_graph::types::ProjectGraph;
use crate::native::project_graph::utils::create_project_root_mappings;
use crate::native::tasks::hashers::remove_other_project_paths;
use crate::native::tasks::types::JsonFileSetInput;
use crate::native::utils::path::normalize_js_path;

#[napi(object)]
pub struct JsonFileChange {
    pub file: String,
    /// The changed field paths, one key per segment. Unset when the file as a
    /// whole counts as changed: added, deleted, unparseable or not an object.
    pub paths: Option<Vec<Vec<String>>>,
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
    json: HashMap<String, Option<&'a [Vec<String>]>>,
    ts_config: TsConfigTouch,
}

enum TsConfigTouch {
    /// No comparison was made: any root tsconfig in the diff touches everything.
    Unknown,
    All,
    Projects(HashSet<String>),
}

impl Default for ChangedContents<'_> {
    fn default() -> Self {
        Self {
            json: HashMap::new(),
            ts_config: TsConfigTouch::Unknown,
        }
    }
}

impl<'a> ChangedContents<'a> {
    pub(crate) fn new(
        graph: &ProjectGraph,
        json: Option<&'a [JsonFileChange]>,
        ts_config: Option<&TsConfigChange>,
    ) -> Self {
        Self {
            json: json
                .into_iter()
                .flatten()
                .map(|change| (normalize_js_path(&change.file), change.paths.as_deref()))
                .collect(),
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
        match self.json.get(file) {
            Some(Some(paths)) => paths.iter().any(|path| {
                field_change_reaches_hash(
                    path,
                    json.fields.as_deref(),
                    json.exclude_fields.as_deref(),
                )
            }),
            // Not compared, or changed as a whole.
            _ => true,
        }
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

/// The projects whose paths entries, as `hash_tsconfig_selectively` filters
/// them, differ between the two versions.
fn projects_with_changed_paths(graph: &ProjectGraph, change: &TsConfigChange) -> HashSet<String> {
    if change.paths_before == change.paths_after {
        return HashSet::new();
    }
    // The hasher's own mapping, so the filter agrees with the hash.
    let mappings = create_project_root_mappings(&graph.nodes);
    graph
        .nodes
        .keys()
        .filter(|project| {
            remove_other_project_paths(project, &mappings, &change.paths_before)
                != remove_other_project_paths(project, &mappings, &change.paths_after)
        })
        .cloned()
        .collect()
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

    #[test]
    fn a_file_compared_as_a_whole_or_not_at_all_counts_as_changed() {
        let json = JsonFileSetInput {
            project_name: None,
            json_path: "package.json".into(),
            fields: Some(strings(&["version"])),
            exclude_fields: None,
        };
        let changes = [JsonFileChange {
            file: "package.json".into(),
            paths: None,
        }];
        let contents = ChangedContents::new(&graph_of_roots(&[]), Some(&changes), None);
        assert!(contents.json_file_changed("package.json", &json));
        assert!(contents.json_file_changed("other/package.json", &json));
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
        let contents = ChangedContents::new(&g, None, Some(&ts_config(false, true)));
        assert!(contents.ts_config_changed("a"));
        assert!(!contents.ts_config_changed("b"));
    }

    /// Without selective hashing no task hashes the paths at all.
    #[test]
    fn a_paths_change_touches_nothing_when_paths_are_not_hashed() {
        let g = graph_of_roots(&[("a", "libs/a"), ("b", "libs/b")]);
        let contents = ChangedContents::new(&g, None, Some(&ts_config(false, false)));
        assert!(!contents.ts_config_changed("a"));
        assert!(!contents.ts_config_changed("b"));
    }

    #[test]
    fn any_other_change_touches_every_project_either_way() {
        let g = graph_of_roots(&[("a", "libs/a"), ("b", "libs/b")]);
        for selective in [true, false] {
            let contents = ChangedContents::new(&g, None, Some(&ts_config(true, selective)));
            assert!(contents.ts_config_changed("a") && contents.ts_config_changed("b"));
        }
        assert!(ChangedContents::default().ts_config_changed("b"));
    }
}
