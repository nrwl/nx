use super::context::Files;
use crate::native::types::FileData;
use crate::native::utils::Normalize;
use std::ops::Bound;
use std::path::{Path, is_separator};

pub(super) fn may_have_literal_prefix(globs: &[String]) -> bool {
    let mut included = false;
    for glob in globs {
        if glob.starts_with('!') {
            continue;
        }
        included = true;
        let end = glob
            .find(|c| matches!(c, '*' | '?' | '[' | '{' | '(') || (c == '\\' && !is_separator(c)))
            .unwrap_or(glob.len());
        if !glob[..end].contains(is_separator) {
            return false;
        }
    }
    included
}

pub(super) fn files_under_prefix(files: &Files, prefix: &Path) -> Vec<FileData> {
    files
        .range::<Path, _>((Bound::Included(prefix), Bound::Unbounded))
        .take_while(|(path, _)| path.starts_with(prefix))
        .map(|(path, hash)| FileData {
            file: path.to_normalized_string(),
            hash: hash.clone(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::glob::{build_glob_set, glob_files::glob_files};
    use rayon::prelude::*;
    use std::path::PathBuf;

    fn scan(
        files: &Files,
        globs: &[String],
        exclude: Option<Vec<String>>,
    ) -> napi::Result<Vec<String>> {
        let snapshot: Vec<FileData> = files
            .iter()
            .map(|(path, hash)| FileData {
                file: path.to_normalized_string(),
                hash: hash.clone(),
            })
            .collect();
        Ok(glob_files(&snapshot, globs.to_vec(), exclude)?
            .map(|file| file.file.clone())
            .collect())
    }

    #[test]
    fn converted_prefixes_preserve_full_scan_results() {
        let files: Files = [
            "e2e/react/x.spec.ts",
            "e2e/react/nested/y.test.tsx",
            "e2e/react/.hidden.spec.ts",
            "e2e/react-other/z.spec.ts",
            "e2e/vue/x.test.js",
            "root.json",
            "libs/a/x.ts",
            "libs/a/nested/x.spec.ts",
            "libs/a+b/x.ts",
            "libs/@scope/x.ts",
            "libs/prefixsuffix/x.ts",
            "libs/suffix/x.ts",
            "libs/paren(/x.ts",
            "libs/雪/x.ts",
            "libs",
            "other/x.ts",
        ]
        .into_iter()
        .map(|path| (PathBuf::from(path), "h".to_string()))
        .collect();
        let patterns = [
            "e2e/react/**/+(*.)+(spec|test).+(ts|js)?(x)",
            "e2e/react/**/!(*.test).ts",
            "libs/prefix*(suffix)/**",
            "libs/prefix?(suffix)/**",
            "libs/a/**",
            "libs/a/",
            "libs/a/x.ts",
            "libs/a+b/**",
            "libs/@scope/**",
            "libs/paren(/**",
            "libs/雪/**",
            "libs/a/{nested,}/**",
            "{libs/a/**,e2e/vue/**}",
            "{libs/a/**,!other/**}",
            "libs/a/[",
            "libs/a/\\*.ts",
            "./libs/a/**",
            "libs//a/**",
            "libs/a/../other/**",
            "!libs/a/**",
            "**",
            "",
        ];
        for pattern in patterns {
            for globs in [
                vec![pattern.into()],
                vec![
                    pattern.into(),
                    "libs/a/**".into(),
                    "libs/a/nested/**".into(),
                    "libs/a/**".into(),
                ],
            ] {
                for exclude in [
                    None,
                    Some(vec!["!libs/a/**".into()]),
                    Some(vec!["**/*.json".into()]),
                ] {
                    let expected =
                        scan(&files, &globs, exclude.clone()).map_err(|error| error.to_string());
                    let actual = build_glob_set(&globs)
                        .map_err(|error| napi::Error::from(error).to_string())
                        .and_then(|include| {
                            if let Some(prefix) = include.literal_prefix() {
                                let candidates = files_under_prefix(&files, prefix);
                                glob_files(&candidates, globs.clone(), exclude.clone())
                                    .map(|matches| matches.map(|file| file.file.clone()).collect())
                                    .map_err(|error| error.to_string())
                            } else {
                                scan(&files, &globs, exclude.clone())
                                    .map_err(|error| error.to_string())
                            }
                        });
                    assert_eq!(actual, expected, "{globs:?}, {exclude:?}");
                }
            }
        }
    }

    #[test]
    fn jest_extglobs_narrow_to_a_shared_ancestor() {
        let globs = [
            "e2e/react/**/+(*.)+(spec|test).+(ts|js)?(x)",
            "e2e/react/nested/**",
        ];
        let matcher = build_glob_set(&globs).unwrap();
        assert_eq!(matcher.literal_prefix().unwrap(), Path::new("e2e/react"));
        assert!(
            build_glob_set(&["!e2e/react/**"])
                .unwrap()
                .literal_prefix()
                .is_none()
        );
        assert!(
            build_glob_set::<String>(&[])
                .unwrap()
                .literal_prefix()
                .is_none()
        );
    }

    #[test]
    fn backslash_prefixes_follow_platform_separators() {
        for pattern in [
            r"e2e\react\**\+(*.)+(spec|test).+(ts|js)?(x)",
            r"e2e\react/**/*.spec.ts",
            r"e2e\react\*.spec.ts",
        ] {
            let globs = [pattern.to_string()];
            assert_eq!(may_have_literal_prefix(&globs), cfg!(windows));
            let matcher = build_glob_set(&globs).unwrap();
            assert_eq!(
                matcher.literal_prefix(),
                cfg!(windows).then_some(Path::new("e2e/react")),
                "{pattern}"
            );
        }
    }

    #[test]
    #[cfg(windows)]
    fn windows_jest_globs_preserve_ordered_matches() {
        let files: Files = [
            "e2e/react/z.spec.ts",
            "e2e/react/a.test.tsx",
            "e2e/react/nested/b.spec.js",
            "e2e/react/source.ts",
            "e2e/react-other/c.spec.ts",
            "e2e/vue/d.spec.ts",
        ]
        .into_iter()
        .map(|path| (PathBuf::from(path), "h".to_string()))
        .collect();
        let globs = [r"e2e\react\**\+(*.)+(spec|test).+(ts|js)?(x)".to_string()];
        assert!(may_have_literal_prefix(&globs));
        let matcher = build_glob_set(&globs).unwrap();
        let prefix = matcher.literal_prefix().unwrap();
        assert_eq!(prefix, Path::new("e2e/react"));
        let candidates = files_under_prefix(&files, prefix);
        assert_eq!(candidates.len(), 4);
        let actual: Vec<String> = glob_files(&candidates, globs.to_vec(), None)
            .unwrap()
            .map(|file| file.file.clone())
            .collect();
        assert_eq!(actual, scan(&files, &globs, None).unwrap());
        assert_eq!(
            actual,
            [
                "e2e/react/a.test.tsx",
                "e2e/react/nested/b.spec.js",
                "e2e/react/z.spec.ts",
            ]
        );
    }

    #[test]
    #[cfg(not(windows))]
    fn escaped_patterns_keep_full_scan_semantics() {
        let files: Files = ["e2e/react/*.spec.ts", "e2e/react/a.spec.ts"]
            .into_iter()
            .map(|path| (PathBuf::from(path), "h".to_string()))
            .collect();
        let globs = [r"e2e/react/\*.spec.ts".to_string()];
        assert!(may_have_literal_prefix(&globs));
        assert!(build_glob_set(&globs).unwrap().literal_prefix().is_none());
        assert_eq!(scan(&files, &globs, None).unwrap(), ["e2e/react/*.spec.ts"]);
        assert!(!may_have_literal_prefix(&[r"e2e\*/react/**".to_string()]));
    }

    #[test]
    fn deep_unicode_paths_share_only_complete_components() {
        let ancestor = "深/".repeat(1_024);
        let matcher = build_glob_set(&[
            format!("{ancestor}左/leaf/**"),
            format!("{ancestor}右/leaf/**"),
        ])
        .unwrap();
        assert_eq!(
            matcher.literal_prefix().unwrap(),
            Path::new(ancestor.trim_end_matches('/'))
        );
    }

    #[test]
    #[cfg(unix)]
    fn lossy_paths_do_not_narrow() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;
        let files = [
            (
                PathBuf::from(OsString::from_vec(b"libs/\xff/x.ts".to_vec())),
                "h".into(),
            ),
            (PathBuf::from("libs/\u{fffd}/x.ts"), "h".into()),
        ]
        .into_iter()
        .collect();
        let globs = ["libs/\u{fffd}/*.ts".to_string()];
        assert!(build_glob_set(&globs).unwrap().literal_prefix().is_none());
        assert_eq!(scan(&files, &globs, None).unwrap().len(), 2);
    }
}
