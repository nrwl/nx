use std::ops::Range;
use std::path::{Path, PathBuf};

/// Candidate ranges in the workspace's PathBuf-sorted snapshot. Only literal
/// ASCII paths and literal-directory recursive patterns are recognized. The
/// unchanged glob engine still decides which candidates actually match.
/// None means use the complete snapshot, including for negative-only queries.
pub(crate) fn candidate_ranges<T>(
    files: &[(PathBuf, T)],
    globs: &[String],
) -> Option<Vec<Range<usize>>> {
    if globs.is_empty() {
        return None;
    }
    let mut ranges: Vec<Range<usize>> = Vec::new();
    for glob in globs {
        let recursive = glob
            .strip_suffix("/**/*")
            .or_else(|| glob.strip_suffix("/**"));
        let literal = recursive.unwrap_or(glob);
        // Do not guess how conversion, escapes, braces, non-ASCII paths or
        // platform prefixes interact with literal-prefix matching.
        if !literal
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"/_-.".contains(&b))
            || literal
                .split('/')
                .any(|part| part.is_empty() || part == "." || part == "..")
        {
            return None;
        }
        let path = Path::new(literal);
        let start = files.partition_point(|(file, _)| file.as_path() < path);
        let end = start
            + if recursive.is_some() {
                files[start..].partition_point(|(file, _)| file.starts_with(path))
            } else {
                files[start..].partition_point(|(file, _)| file.as_path() == path)
            };
        if start != end {
            ranges.push(start..end);
        }
    }
    ranges.sort_unstable_by_key(|range| range.start);
    let mut merged: Vec<Range<usize>> = Vec::with_capacity(ranges.len());
    for range in ranges {
        if let Some(previous) = merged
            .last_mut()
            .filter(|previous| range.start <= previous.end)
        {
            previous.end = previous.end.max(range.end);
        } else {
            merged.push(range);
        }
    }
    Some(merged)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::glob::glob_files::{glob_files, glob_ranges};
    use crate::native::types::FileData;
    use crate::native::utils::Normalize;
    use rayon::prelude::*;

    fn verify(files: &[(PathBuf, String)], globs: Vec<String>, exclude: Option<Vec<String>>) {
        let original: Vec<_> = files
            .iter()
            .map(|(path, hash)| FileData {
                file: path.to_normalized_string(),
                hash: hash.clone(),
            })
            .collect();
        let expected: Vec<_> = glob_files(&original, globs.clone(), exclude.clone())
            .unwrap()
            .map(|file| (file.file.clone(), file.hash.clone()))
            .collect();
        let ranges = candidate_ranges(files, &globs).unwrap_or_else(|| vec![0..files.len()]);
        let actual: Vec<_> = glob_ranges(files, ranges, globs, exclude, |(path, hash)| {
            (path.into_owned(), hash.to_owned())
        })
        .unwrap();
        assert_eq!(actual, expected);
    }

    #[test]
    fn ranges_preserve_the_full_scan_for_overlaps_and_component_sort_order() {
        let mut files: Vec<_> = [
            "a.ts",
            "./a/file.ts",
            "a/./file.ts",
            "a//file.ts",
            "a/../b/file.ts",
            "/a/file.ts",
            "",
            ".",
            "a-b/file.ts",
            "a/file.ts",
            "a/nested/x.ts",
            "a/nested/x.spec.ts",
            "a.b/file.ts",
            "a",
            "b/file.ts",
            "lockfile.json",
            "a/東京.ts",
            ".hidden/file.ts",
        ]
        .into_iter()
        .enumerate()
        .map(|(i, p)| (PathBuf::from(p), i.to_string()))
        .collect();
        for project in 0..100 {
            for file in 0..80 {
                files.push((
                    PathBuf::from(format!("packages/project-{project}/src/{file}.ts")),
                    format!("hash-{file}"),
                ));
            }
        }
        files.sort();
        for patterns in [
            vec!["a/**/*"],
            vec!["a/**"],
            vec!["a"],
            vec!["missing/**/*"],
            vec![
                "a/**/*",
                "a/nested/**/*",
                "a/file.ts",
                "lockfile.json",
                "a/**/*",
            ],
            vec![
                "packages/project-1/**/*",
                "packages/project-10/**/*",
                "lockfile.json",
            ],
            vec!["packages/**/*"],
            vec![".hidden/**/*"],
            vec!["lockfile.json"],
            vec!["b/**/*", "a/**/*"],
        ] {
            let globs: Vec<_> = patterns.into_iter().map(str::to_owned).collect();
            let ranges = candidate_ranges(&files, &globs).unwrap();
            assert!(ranges.windows(2).all(|r| r[0].end < r[1].start));
            assert!(ranges.iter().map(|r| r.len()).sum::<usize>() < files.len());
            for threads in [1, 2, 8] {
                rayon::ThreadPoolBuilder::new()
                    .num_threads(threads)
                    .build()
                    .unwrap()
                    .install(|| {
                        verify(&files, globs.clone(), None);
                        verify(&files, globs.clone(), Some(vec!["**/*.spec.ts".into()]));
                    });
            }
        }
    }

    #[test]
    fn patterns_outside_the_literal_subset_keep_the_full_scan() {
        let files = vec![(PathBuf::from("a/file.ts"), "hash".into())];
        for patterns in [
            vec![],
            vec!["**/*"],
            vec!["a/*.ts"],
            vec!["a/**/*", "!a/**/*.spec.ts"],
            vec!["!a/**/*"],
            vec!["{a,b}/**/*"],
            vec!["a/**/?(*.)+spec.ts"],
            vec!["a/"],
            vec!["a//**/*"],
            vec!["a/../b/**/*"],
            vec!["./a/**/*"],
            vec!["/a/**/*"],
            vec!["a\\**\\*"],
            vec!["東京/**/*"],
            vec!["a b/**/*"],
            vec!["@scope/pkg/**/*"],
            vec!["a+b/**/*"],
            vec!["a/**/*", "**/lockfile.json"],
            vec!["a/[x].ts"],
            vec![""],
        ] {
            let globs: Vec<_> = patterns.into_iter().map(str::to_owned).collect();
            assert!(candidate_ranges(&files, &globs).is_none(), "{globs:?}");
            verify(&files, globs, None);
        }
    }

    #[cfg(unix)]
    #[test]
    fn narrowing_keeps_lossy_paths_under_ascii_roots() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;
        let mut files = vec![
            (
                PathBuf::from(OsString::from_vec(b"a/\xff.ts".to_vec())),
                "invalid-utf8".into(),
            ),
            (PathBuf::from("a/�.ts"), "valid-utf8".into()),
            (PathBuf::from("a/file.ts"), "ordinary".into()),
            (PathBuf::from("b/file.ts"), "other-root".into()),
        ];
        files.sort();
        verify(&files, vec!["a/**/*".into()], None);
        verify(&files, vec!["a/�.ts".into()], None);
    }
}
