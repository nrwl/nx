//! A project's folder state: which kinds of files each of its folders holds.
//!
//! A task hashed from its Ultracache configuration only sees the files its
//! recorded globs match. A new file those globs miss can still change what the
//! task does, for example an `eslint.config.mjs` added next to a project that
//! never had one. The folder state catches that: it changes when a folder
//! gains or loses a kind of file, and stays the same when files are edited or
//! more files of a kind the folder already holds are added.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::convert::Infallible;
use std::sync::Arc;

use xxhash_rust::xxh3::Xxh3;

use super::once_cache::OnceCache;
use crate::native::types::FileData;

/// Hashed ahead of every folder state. Changing how kinds or folders are
/// derived must change this tag, so every task re-runs once on purpose.
const FOLDER_STATE_VERSION: &[u8] = b"folder-state:v1";

/// Persisted folder-state digests, keyed by project name. The file map they
/// are computed from is fixed for the hasher's lifetime.
pub(crate) type ProjectFolderStateCache = OnceCache<String>;

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

/// The folder state of `project`'s files in the file map: the files it owns
/// and no project nested inside it does. A project with no files hashes as
/// an empty state.
pub fn hash_project_folder_state(
    project: &str,
    project_file_map: &HashMap<String, Vec<FileData>>,
) -> String {
    hash_folder_state(
        project_file_map
            .get(project)
            .into_iter()
            .flatten()
            .map(|file| file.file.as_str()),
    )
}

pub(crate) fn hash_project_folder_state_cached(
    project: &str,
    project_file_map: &HashMap<String, Vec<FileData>>,
    cache: &ProjectFolderStateCache,
) -> Arc<String> {
    let Ok(digest) = cache.get_or_try_init(project.to_string(), || {
        Ok::<_, Infallible>(hash_project_folder_state(project, project_file_map))
    });
    digest
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_map(projects: &[(&str, &[&str])]) -> HashMap<String, Vec<FileData>> {
        projects
            .iter()
            .map(|(project, files)| {
                (
                    project.to_string(),
                    files
                        .iter()
                        .map(|file| FileData {
                            file: file.to_string(),
                            hash: "h".into(),
                        })
                        .collect(),
                )
            })
            .collect()
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
        let before = file_map(&[("a", &["libs/a/src/index.ts", "libs/a/project.json"])]);
        let edited = HashMap::from([(
            "a".to_string(),
            vec![
                FileData {
                    file: "libs/a/src/index.ts".into(),
                    hash: "changed".into(),
                },
                FileData {
                    file: "libs/a/project.json".into(),
                    hash: "changed".into(),
                },
            ],
        )]);
        let more = file_map(&[(
            "a",
            &[
                "libs/a/project.json",
                "libs/a/src/other.ts",
                "libs/a/src/index.ts",
            ],
        )]);
        let digest = hash_project_folder_state("a", &before);
        assert_eq!(hash_project_folder_state("a", &edited), digest);
        assert_eq!(hash_project_folder_state("a", &more), digest);
    }

    #[test]
    fn a_new_kind_or_a_new_folder_changes_the_state() {
        let before = hash_project_folder_state(
            "a",
            &file_map(&[("a", &["libs/a/project.json", "libs/a/src/index.ts"])]),
        );
        let new_kind = hash_project_folder_state(
            "a",
            &file_map(&[(
                "a",
                &[
                    "libs/a/project.json",
                    "libs/a/eslint.config.mjs",
                    "libs/a/src/index.ts",
                ],
            )]),
        );
        let new_folder = hash_project_folder_state(
            "a",
            &file_map(&[(
                "a",
                &[
                    "libs/a/project.json",
                    "libs/a/src/index.ts",
                    "libs/a/src/lib/index.ts",
                ],
            )]),
        );
        assert_ne!(new_kind, before);
        assert_ne!(new_folder, before);
        assert_ne!(new_kind, new_folder);
    }

    #[test]
    fn a_nested_project_and_the_root_project_keep_to_their_own_files() {
        // The file map gives every file to its innermost project, and files
        // no other project owns to the root project.
        let map = file_map(&[
            ("root", &["package.json", "tools/x.ts"]),
            ("a", &["libs/a/project.json"]),
            ("nested", &["libs/a/nested/project.json"]),
        ]);
        let a = hash_project_folder_state("a", &map);
        let root = hash_project_folder_state("root", &map);

        let mut grown = map.clone();
        grown.get_mut("nested").unwrap().push(FileData {
            file: "libs/a/nested/eslint.config.mjs".into(),
            hash: "h".into(),
        });
        assert_eq!(hash_project_folder_state("a", &grown), a);
        assert_eq!(hash_project_folder_state("root", &grown), root);
        assert_ne!(
            hash_project_folder_state("nested", &grown),
            hash_project_folder_state("nested", &map)
        );

        grown.get_mut("root").unwrap().push(FileData {
            file: "tools/x.mjs".into(),
            hash: "h".into(),
        });
        assert_ne!(hash_project_folder_state("root", &grown), root);
        assert_eq!(hash_project_folder_state("a", &grown), a);
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
        assert_eq!(
            hash_project_folder_state("missing", &HashMap::new()),
            hash_folder_state([])
        );
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
    fn the_cache_computes_once_per_project() {
        let map = file_map(&[("a", &["libs/a/project.json"])]);
        let cache = ProjectFolderStateCache::new();
        let first = hash_project_folder_state_cached("a", &map, &cache);
        let changed = file_map(&[("a", &["libs/a/project.json", "libs/a/x.ts"])]);
        assert_eq!(
            hash_project_folder_state_cached("a", &changed, &cache),
            first
        );
    }
}
