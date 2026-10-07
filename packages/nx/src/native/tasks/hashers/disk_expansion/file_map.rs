//! Expanding a regular fileset against a file map instead of the disk, and
//! the one order every regular fileset folds its files in.

use anyhow::Result;

use super::entries::FileSet;
use super::expansion::{Source, expand_entries};
use crate::native::types::FileData;

/// Positions into a file map in path order, so an exact path or a directory's
/// contents are found by binary search rather than by scanning every file.
/// The file map's own order is not relied on.
pub(crate) struct PathIndex(Vec<u32>);

impl PathIndex {
    pub(crate) fn new(files: &[FileData]) -> Self {
        let mut order: Vec<u32> = (0..files.len() as u32).collect();
        order.sort_unstable_by(|&a, &b| files[a as usize].file.cmp(&files[b as usize].file));
        Self(order)
    }

    /// The position of `path` in `files`.
    pub(crate) fn find(&self, files: &[FileData], path: &str) -> Option<u32> {
        self.0
            .binary_search_by(|&i| files[i as usize].file.as_str().cmp(path))
            .ok()
            .map(|at| self.0[at])
    }

    /// The positions of every file under `dir`, in path order; every file
    /// when `dir` is empty.
    pub(crate) fn under<'s>(
        &'s self,
        files: &'s [FileData],
        dir: &str,
    ) -> impl Iterator<Item = u32> + 's {
        let prefix = if dir.is_empty() {
            String::new()
        } else {
            format!("{dir}/")
        };
        // Everything that starts with `prefix` sorts in one run after it.
        let start = self
            .0
            .partition_point(|&i| files[i as usize].file.as_str() < prefix.as_str());
        self.0[start..]
            .iter()
            .copied()
            .take_while(move |&i| files[i as usize].file.starts_with(&prefix))
    }
}

/// The positions in `files` a regular fileset matches, in path order.
pub(crate) fn match_file_map(
    globs: &[String],
    files: &[FileData],
    index: &PathIndex,
) -> Result<Vec<u32>> {
    let fileset = FileSet::parse(globs)?;
    let expansion = expand_entries(
        &fileset.positives,
        &fileset.negations,
        &Source::file_map(files, index),
    )?;
    Ok(expansion
        .files
        .iter()
        .filter_map(|path| index.find(files, path))
        .collect())
}

/// Folds matched files path first, then content hash, in the order given.
/// An `includeIgnored` fileset folds the same way.
pub(crate) fn fold_files<'f>(files: impl Iterator<Item = &'f FileData>) -> String {
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    for file in files {
        hasher.update(file.file.as_bytes());
        hasher.update(file.hash.as_bytes());
    }
    hasher.digest().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::glob::{build_glob_set, fileset_patterns, partition_glob};

    fn files(paths: &[&str]) -> Vec<FileData> {
        paths
            .iter()
            .map(|path| FileData {
                file: (*path).to_string(),
                hash: String::new(),
            })
            .collect()
    }

    fn paths(files: &[FileData], positions: impl Iterator<Item = u32>) -> Vec<&str> {
        positions.map(|i| files[i as usize].file.as_str()).collect()
    }

    #[test]
    fn a_directory_lists_only_what_is_under_it_whatever_the_input_order() {
        // `libs/a-other` sorts between `libs/a` and `libs/a/x.ts` bytewise.
        let files = files(&[
            "libs/b.ts",
            "libs/a/y.ts",
            "libs/a-other/z.ts",
            "libs/a/x.ts",
        ]);
        let index = PathIndex::new(&files);
        assert_eq!(
            paths(&files, index.under(&files, "libs/a")),
            vec!["libs/a/x.ts", "libs/a/y.ts"]
        );
        assert_eq!(index.under(&files, "").count(), 4);
        assert_eq!(index.under(&files, "libs/c").count(), 0);
        assert_eq!(index.find(&files, "libs/a-other/z.ts"), Some(2));
        assert_eq!(index.find(&files, "libs/a"), None);
    }

    #[test]
    fn the_file_map_is_the_whole_answer() {
        // None of these exist on disk, and a directory is never stat'ed.
        let files = files(&["virtual/a.ts", "virtual/b.spec.ts", "virtual/c/d.ts"]);
        let index = PathIndex::new(&files);
        let globs = |list: &[&str]| list.iter().map(|g| g.to_string()).collect::<Vec<_>>();
        let matched = |list: &[&str]| {
            paths(
                &files,
                match_file_map(&globs(list), &files, &index)
                    .unwrap()
                    .into_iter(),
            )
        };
        assert_eq!(
            matched(&["virtual", "!virtual/**/*.spec.ts"]),
            vec!["virtual/a.ts", "virtual/c/d.ts"]
        );
        assert_eq!(matched(&["virtual/a.ts"]), vec!["virtual/a.ts"]);
        assert_eq!(matched(&["virtual/a.ts/**"]), Vec::<&str>::new());
        assert_eq!(matched(&["!virtual/c/**"]).len(), 2);
        assert_eq!(matched(&[""]), Vec::<&str>::new());
    }

    /// Paths a corpus glob could plausibly name: its literal prefix, and a
    /// handful of shapes under it.
    fn candidates_for(glob: &str) -> Vec<String> {
        let (root, _) = partition_glob(glob.trim_start_matches('!'));
        let mut paths = vec![root.clone()];
        for tail in [
            "x.ts",
            "a.ts",
            "a.module.ts",
            "ignored.ts",
            "x.spec.ts",
            "x.spec.tsx.snap",
            "x.test.js",
            "README.md",
            "a/x",
            "b/x",
            "a/b/x.ts",
            "src/index.ts",
            "cache/a.js",
            "main.js",
            "page.tsx",
            "__tests__/a/x.mjs",
        ] {
            paths.push(if root.is_empty() {
                tail.to_string()
            } else {
                format!("{root}/{tail}")
            });
        }
        paths
    }

    // The legacy matcher is one glob set over the whole fileset. A fileset
    // read as entries must name exactly what it named, for every glob the
    // corpus records, alone and with its neighbour negated beside it.
    #[test]
    fn entries_name_what_one_glob_set_over_the_fileset_named() {
        let corpus: Vec<&str> = include_str!("../../../glob/fixtures/glob_corpus.txt")
            .lines()
            .collect();
        let mut filesets: Vec<Vec<String>> = Vec::new();
        for (i, glob) in corpus.iter().enumerate() {
            filesets.push(vec![glob.to_string()]);
            if let Some(next) = corpus.get(i + 1) {
                let next = next.trim_start_matches('!');
                filesets.push(vec![glob.to_string(), format!("!{next}")]);
                filesets.push(vec![format!("!{glob}"), next.to_string()]);
            }
        }
        for fileset in [
            &["libs/x/src/lib/!(*.module).ts", "libs/x/src/lib/*.ts"][..],
            &["libs/{x,y}"],
            &["**/*", "!libs/{x,y}"],
            &["libs/x/", "!libs/x/a/"],
            &["libs/{,a}/x"],
            &[""],
            &["!"],
        ] {
            filesets.push(fileset.iter().map(|g| g.to_string()).collect());
        }
        let mut compared = 0;
        for fileset in filesets {
            let Ok(legacy) = build_glob_set(&fileset_patterns(&fileset)) else {
                continue;
            };
            let entries = FileSet::parse(&fileset).unwrap_or_else(|err| {
                panic!("{fileset:?} builds as one glob set but not as entries: {err}")
            });
            let mut paths: Vec<String> = fileset.iter().flat_map(|g| candidates_for(g)).collect();
            paths.extend(
                [
                    "libs/x",
                    "libs/y",
                    "libs/x/a/b.ts",
                    "libs/a/x",
                    "libs/x/src/lib/a.module.ts",
                ]
                .map(String::from),
            );
            // Only paths a file map can hold: no empty segment, no trailing `/`.
            for path in paths
                .iter()
                .filter(|p| p.split('/').all(|seg| !seg.is_empty()))
            {
                assert_eq!(
                    entries.matches(path),
                    legacy.is_match(path),
                    "{fileset:?} on {path}"
                );
                compared += 1;
            }
        }
        assert!(compared > 1000, "compared only {compared} cases");
    }
}
