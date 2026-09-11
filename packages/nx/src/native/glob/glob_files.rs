use rayon::prelude::*;
use std::borrow::Cow;
use std::path::PathBuf;

use crate::native::glob::build_glob_set;
use crate::native::types::FileData;
use crate::native::utils::path::normalized_path;

/// Get workspace config files based on provided globs
pub fn glob_files(
    files: &[FileData],
    globs: Vec<String>,
    exclude: Option<Vec<String>>,
) -> napi::Result<impl ParallelIterator<Item = &FileData>> {
    let matches = file_matcher(globs, exclude)?;
    Ok(files.par_iter().filter(move |file| matches(&file.file)))
}

/// Query a workspace snapshot without cloning every filename and hash first.
/// Collection retains input order, including the original PathBuf sort order.
pub(crate) fn glob_paths(
    files: &[(PathBuf, String)],
    globs: Vec<String>,
    exclude: Option<Vec<String>>,
) -> napi::Result<impl ParallelIterator<Item = (Cow<'_, str>, &str)>> {
    let matches = file_matcher(globs, exclude)?;
    Ok(files.par_iter().filter_map(move |(path, hash)| {
        let path = normalized_path(path);
        matches(&path).then_some((path, hash.as_str()))
    }))
}

fn file_matcher(
    globs: Vec<String>,
    exclude: Option<Vec<String>>,
) -> napi::Result<impl Fn(&str) -> bool + Send + Sync> {
    let globs = build_glob_set(&globs)?;
    let exclude = match exclude {
        Some(exclude) if !exclude.is_empty() => Some(build_glob_set(&exclude)?),
        _ => None,
    };
    Ok(move |path: &str| {
        globs.is_match(path)
            && exclude
                .as_ref()
                .is_none_or(|exclude| !exclude.is_match(path))
    })
}

#[cfg(test)]
mod test {
    use super::*;

    fn fd(file: &str) -> FileData {
        FileData {
            file: file.to_string(),
            hash: "h".to_string(),
        }
    }

    #[test]
    fn borrowed_queries_preserve_normalization_selection_and_input_order() {
        let mut files: Vec<(PathBuf, String)> = [
            "z.ts",
            "src/a.ts",
            "src/a.spec.ts",
            "src/nested/b.ts",
            "package.json",
            ".config",
            "東京/é.ts",
            "dir with spaces/a.ts",
            "a\\b.ts",
        ]
        .into_iter()
        .enumerate()
        .map(|(i, name)| (PathBuf::from(name), i.to_string()))
        .collect();
        for reverse in [false, true] {
            if reverse {
                files.reverse();
            }
            let original: Vec<FileData> = files
                .iter()
                .map(|(path, hash)| FileData {
                    file: if cfg!(windows) {
                        path.display().to_string().replace('\\', "/")
                    } else {
                        path.display().to_string()
                    },
                    hash: hash.clone(),
                })
                .collect();
            for globs in [
                vec![],
                vec!["**/*"],
                vec!["**/*.ts"],
                vec!["!**/*.spec.ts"],
                vec!["src/**/*", "package.json"],
                vec!["{src,東京}/**/*"],
                vec!["missing/**/*"],
            ] {
                for exclude in [None, Some(vec![]), Some(vec!["**/*.spec.ts".to_string()])] {
                    let globs: Vec<String> = globs.iter().map(|s| s.to_string()).collect();
                    let expected: Vec<_> = glob_files(&original, globs.clone(), exclude.clone())
                        .unwrap()
                        .map(|file| (file.file.clone(), file.hash.clone()))
                        .collect();
                    let actual: Vec<_> = glob_paths(&files, globs, exclude)
                        .unwrap()
                        .map(|(path, hash)| (path.into_owned(), hash.to_owned()))
                        .collect();
                    assert_eq!(actual, expected);
                }
            }
        }
    }

    /// `glob_files` is documented to return matches in input order: the JS
    /// pipeline (`createNodesFromFiles`, atomized target name insertion) and
    /// every plugin's `for...of configFiles` loop relies on it. Internally
    /// this is a `par_iter().filter().collect()` over an already-sorted
    /// slice, which Rayon documents as order-preserving — locking in that
    /// contract here so a future swap (e.g. `par_collect_into`) cannot
    /// silently reorder results.
    #[test]
    fn should_preserve_input_order() {
        let files = vec![
            fd("a.ts"),
            fd("b.ts"),
            fd("c.ts"),
            fd("d.ts"),
            fd("e.ts"),
            fd("f.ts"),
            fd("g.ts"),
            fd("h.ts"),
        ];

        let matched: Vec<&str> = glob_files(&files, vec!["**/*".into()], None)
            .unwrap()
            .map(|f| f.file.as_str())
            .collect();

        assert_eq!(
            matched,
            vec![
                "a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts", "g.ts", "h.ts"
            ]
        );
    }

    /// Filtering must not reorder remaining matches.
    #[test]
    fn should_preserve_input_order_with_exclude() {
        let files = vec![
            fd("a.ts"),
            fd("b.spec.ts"),
            fd("c.ts"),
            fd("d.spec.ts"),
            fd("e.ts"),
        ];

        let matched: Vec<&str> = glob_files(
            &files,
            vec!["**/*.ts".into()],
            Some(vec!["**/*.spec.ts".into()]),
        )
        .unwrap()
        .map(|f| f.file.as_str())
        .collect();

        assert_eq!(matched, vec!["a.ts", "c.ts", "e.ts"]);
    }
}
