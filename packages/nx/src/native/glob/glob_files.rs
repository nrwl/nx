use rayon::prelude::*;

use crate::native::glob::build_glob_set;
use crate::native::types::FileData;

/// Get workspace config files based on provided globs
pub fn glob_files(
    files: &[FileData],
    globs: Vec<String>,
    exclude: Option<Vec<String>>,
) -> napi::Result<impl ParallelIterator<Item = &FileData>> {
    let globs = build_glob_set(&globs)?;

    let exclude_glob_set = match exclude {
        Some(exclude) => {
            if exclude.is_empty() {
                None
            } else {
                Some(build_glob_set(&exclude)?)
            }
        }
        None => None,
    };

    Ok(files.par_iter().filter(move |file_data| {
        let path = &file_data.file;
        let is_match = globs.is_match(path);

        if !is_match {
            return is_match;
        }

        exclude_glob_set
            .as_ref()
            .map(|exclude_glob_set| !exclude_glob_set.is_match(path))
            .unwrap_or(is_match)
    }))
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
