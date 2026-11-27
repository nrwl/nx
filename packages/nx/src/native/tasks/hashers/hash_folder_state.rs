//! A folder's state: which kinds of files each folder under it holds.
//!
//! A task hashed from its Ultracache configuration only sees the files its
//! recorded globs match. A new file those globs miss can still change what the
//! task does, for example an `eslint.config.mjs` added next to a project that
//! never had one. The folder state catches that: it changes when a folder
//! gains or loses a kind of file, and stays the same when files are edited or
//! more files of a kind the folder already holds are added.
//!
//! Scope: the files of the file map under one folder (the task's project root
//! today), minus those of projects nested below it. Folders above it are not
//! included. The file map holds every file that `.gitignore` and `.nxignore`
//! do not exclude, untracked ones included, so a build output that is not
//! ignored counts too and can cause extra cache misses.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::convert::Infallible;
use std::sync::Arc;

use xxhash_rust::xxh3::Xxh3;

use super::once_cache::OnceCache;
use crate::native::project_graph::utils::{ProjectRootMappings, find_project_for_path};
use crate::native::types::FileData;

/// Hashed ahead of every folder state. Changing how kinds or folders are
/// derived must change this tag, so every task re-runs once on purpose.
const FOLDER_STATE_VERSION: &[u8] = b"folder-state:v1";

/// Persisted folder-state digests, keyed by folder. The file map they are
/// computed from is fixed for the hasher's lifetime.
pub(crate) type FolderStateCache = OnceCache<String>;

/// The kind of a file, from its name: everything after the first dot, so
/// `a.component.spec.ts` is `component.spec.ts` and `eslint.config.mjs` is
/// `config.mjs`. A name without a dot, or one that starts with a dot
/// (`.nvmrc`, `.eslintrc.json`, `.env.production`), is its own kind: for a
/// dotfile the name is what says what the file is.
pub fn file_kind(name: &str) -> &str {
    if name.starts_with('.') {
        return name;
    }
    match name.split_once('.') {
        Some((_, kind)) => kind,
        None => name,
    }
}

/// Each folder that directly holds at least one of `files`, mapped to the
/// sorted, deduplicated kinds of those files. Paths are workspace-relative
/// with `/` separators; a file at the workspace root is in folder `""`.
pub fn folder_kinds<'a>(
    files: impl IntoIterator<Item = &'a str>,
) -> BTreeMap<&'a str, BTreeSet<&'a str>> {
    let mut folders: BTreeMap<&str, BTreeSet<&str>> = BTreeMap::new();
    for path in files {
        let (folder, name) = path.rsplit_once('/').unwrap_or(("", path));
        folders.entry(folder).or_default().insert(file_kind(name));
    }
    folders
}

/// A stable digest of the folder state of `files`, tagged with the
/// algorithm's version.
pub fn hash_folder_state<'a>(files: impl IntoIterator<Item = &'a str>) -> String {
    let mut hasher = Xxh3::new();
    hasher.update(FOLDER_STATE_VERSION);
    // NUL ends a folder and each kind; 0xFF, which never occurs in UTF-8,
    // ends a folder's entry. No path or name contains either.
    for (folder, kinds) in folder_kinds(files) {
        hasher.update(folder.as_bytes());
        hasher.update(&[0]);
        for kind in kinds {
            hasher.update(kind.as_bytes());
            hasher.update(&[0]);
        }
        hasher.update(&[0xFF]);
    }
    hasher.digest().to_string()
}

/// The folder state of the files under `root`, a normalized workspace-relative
/// folder (`.` for the workspace root), minus those of projects nested below
/// it: the files of the project owning `root` that sit under it. A folder no
/// project owns has an empty state; finding its files would mean a project
/// lookup for every workspace file.
pub(crate) fn hash_folder_state_at(
    root: &str,
    project_root_mappings: &ProjectRootMappings,
    project_file_map: &HashMap<String, Vec<FileData>>,
) -> String {
    let prefix = match root {
        "." => String::new(),
        root => format!("{root}/"),
    };
    hash_folder_state(
        find_project_for_path(root, project_root_mappings)
            .and_then(|owner| project_file_map.get(owner))
            .into_iter()
            .flatten()
            .map(|file| file.file.as_str())
            .filter(|file| file.starts_with(&prefix)),
    )
}

pub(crate) fn hash_folder_state_cached(
    root: &str,
    project_root_mappings: &ProjectRootMappings,
    project_file_map: &HashMap<String, Vec<FileData>>,
    cache: &FolderStateCache,
) -> Arc<String> {
    let Ok(digest) = cache.get_or_try_init(root.to_string(), || {
        Ok::<_, Infallible>(hash_folder_state_at(
            root,
            project_root_mappings,
            project_file_map,
        ))
    });
    digest
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::Project;
    use crate::native::project_graph::utils::create_project_root_mappings;

    /// Projects as (name, root, files); every file also joins the workspace list.
    struct Workspace {
        mappings: ProjectRootMappings,
        project_files: HashMap<String, Vec<FileData>>,
    }

    fn file(path: &str) -> FileData {
        FileData {
            file: path.into(),
            hash: "h".into(),
        }
    }

    fn workspace(projects: &[(&str, &str, &[&str])]) -> Workspace {
        let nodes = projects
            .iter()
            .map(|(name, root, _)| {
                (
                    name.to_string(),
                    Project {
                        root: root.to_string(),
                        ..Default::default()
                    },
                )
            })
            .collect();
        let project_files: HashMap<String, Vec<FileData>> = projects
            .iter()
            .map(|(name, _, files)| (name.to_string(), files.iter().map(|f| file(f)).collect()))
            .collect();
        Workspace {
            mappings: create_project_root_mappings(&nodes),
            project_files,
        }
    }

    impl Workspace {
        fn state(&self, root: &str) -> String {
            hash_folder_state_at(root, &self.mappings, &self.project_files)
        }

        fn state_cached(&self, root: &str, cache: &FolderStateCache) -> Arc<String> {
            hash_folder_state_cached(root, &self.mappings, &self.project_files, cache)
        }
    }

    fn lib_a(files: &[&str]) -> Workspace {
        workspace(&[("a", "libs/a", files)])
    }

    #[test]
    fn a_kind_is_the_name_after_its_first_dot() {
        assert_eq!(file_kind("a.component.spec.ts"), "component.spec.ts");
        assert_eq!(file_kind("eslint.config.mjs"), "config.mjs");
        assert_eq!(file_kind("a.ts"), "ts");
        assert_eq!(file_kind("Makefile"), "Makefile");
    }

    #[test]
    fn a_dotfile_is_its_own_kind() {
        assert_eq!(file_kind(".nvmrc"), ".nvmrc");
        assert_eq!(file_kind(".eslintrc.json"), ".eslintrc.json");
        assert_eq!(file_kind(".env.production"), ".env.production");
    }

    #[test]
    fn maps_each_folder_to_the_kinds_it_holds_directly() {
        let folders = folder_kinds([
            "libs/a/project.json",
            "libs/a/src/index.ts",
            "libs/a/src/b.ts",
            "libs/a/src/b.spec.ts",
            "README.md",
        ]);
        let expected: BTreeMap<&str, BTreeSet<&str>> = BTreeMap::from([
            ("", BTreeSet::from(["md"])),
            ("libs/a", BTreeSet::from(["json"])),
            ("libs/a/src", BTreeSet::from(["spec.ts", "ts"])),
        ]);
        assert_eq!(folders, expected);
    }

    #[test]
    fn edits_and_more_files_of_a_kind_leave_the_state_alone() {
        let before = lib_a(&["libs/a/src/index.ts", "libs/a/project.json"]);
        let mut edited = lib_a(&["libs/a/src/index.ts", "libs/a/project.json"]);
        for file in edited.project_files.get_mut("a").unwrap() {
            file.hash = "changed".into();
        }
        let more = lib_a(&[
            "libs/a/project.json",
            "libs/a/src/other.ts",
            "libs/a/src/index.ts",
        ]);
        let digest = before.state("libs/a");
        assert_eq!(edited.state("libs/a"), digest);
        assert_eq!(more.state("libs/a"), digest);
    }

    #[test]
    fn a_new_kind_or_a_new_folder_changes_the_state() {
        let before = lib_a(&["libs/a/project.json", "libs/a/src/index.ts"]).state("libs/a");
        let new_kind = lib_a(&[
            "libs/a/project.json",
            "libs/a/eslint.config.mjs",
            "libs/a/src/index.ts",
        ])
        .state("libs/a");
        let new_folder = lib_a(&[
            "libs/a/project.json",
            "libs/a/src/index.ts",
            "libs/a/src/lib/index.ts",
        ])
        .state("libs/a");
        assert_ne!(new_kind, before);
        assert_ne!(new_folder, before);
        assert_ne!(new_kind, new_folder);
    }

    #[test]
    fn a_nested_project_and_the_root_project_keep_to_their_own_files() {
        // The file map gives every file to its innermost project, and files
        // no other project owns to the root project.
        let projects = |nested: &'static [&'static str], root: &'static [&'static str]| {
            workspace(&[
                ("root", ".", root),
                ("a", "libs/a", &["libs/a/project.json"]),
                ("nested", "libs/a/nested", nested),
            ])
        };
        let before = projects(
            &["libs/a/nested/project.json"],
            &["package.json", "tools/x.ts"],
        );
        let grown = projects(
            &[
                "libs/a/nested/project.json",
                "libs/a/nested/eslint.config.mjs",
            ],
            &["package.json", "tools/x.ts"],
        );
        assert_eq!(grown.state("libs/a"), before.state("libs/a"));
        assert_eq!(grown.state("."), before.state("."));
        assert_ne!(grown.state("libs/a/nested"), before.state("libs/a/nested"));

        let root_grown = projects(
            &["libs/a/nested/project.json"],
            &["package.json", "tools/x.ts", "tools/x.mjs"],
        );
        assert_ne!(root_grown.state("."), before.state("."));
        assert_eq!(root_grown.state("libs/a"), before.state("libs/a"));
    }

    #[test]
    fn a_folder_inside_a_project_takes_only_the_files_under_it() {
        let both = |extra: &'static str| {
            workspace(&[
                (
                    "a",
                    "libs/a",
                    &["libs/a/project.json", "libs/a/src/a.ts", extra],
                ),
                ("nested", "libs/a/src/nested", &["libs/a/src/nested/x.mjs"]),
            ])
        };
        let src = both("libs/a/b.ts").state("libs/a/src");
        assert_eq!(src, hash_folder_state(["libs/a/src/a.ts"]));
        // A new kind above the folder is out of its scope.
        assert_eq!(both("libs/a/b.mjs").state("libs/a/src"), src);
        assert_ne!(both("libs/a/src/b.mjs").state("libs/a/src"), src);
    }

    #[test]
    fn a_folder_no_project_owns_has_an_empty_state() {
        let files = workspace(&[("a", "tools/a", &["tools/a/project.json"])]);
        assert_eq!(files.state("tools"), hash_folder_state([]));
    }

    #[test]
    fn the_digest_is_stable_and_order_independent() {
        let files = [
            "libs/a/project.json",
            "libs/a/src/index.ts",
            "libs/a/src/b.spec.ts",
        ];
        let mut reversed = files;
        reversed.reverse();
        assert_eq!(hash_folder_state(files), hash_folder_state(reversed));
        // Pinned: a different value means every Ultracache task with folder
        // state hashing re-runs once. Bump `FOLDER_STATE_VERSION` when that
        // is intended.
        assert_eq!(hash_folder_state(files), "15099054082418110423");
        assert_eq!(lib_a(&files).state("libs/a"), hash_folder_state(files));
        assert_eq!(lib_a(&[]).state("libs/a"), hash_folder_state([]));
    }

    #[test]
    fn folder_and_kind_boundaries_cannot_run_together() {
        assert_ne!(
            hash_folder_state(["x/a.ts"]),
            hash_folder_state(["x/a.t", "x/b.s"])
        );
        assert_ne!(hash_folder_state(["a.ts"]), hash_folder_state(["ts/x"]));
    }

    #[test]
    fn the_cache_computes_once_per_folder() {
        let cache = FolderStateCache::new();
        let before = lib_a(&["libs/a/project.json"]);
        let first = before.state_cached("libs/a", &cache);
        let changed = lib_a(&["libs/a/project.json", "libs/a/x.ts"]);
        assert_eq!(changed.state_cached("libs/a", &cache), first);
    }
}
