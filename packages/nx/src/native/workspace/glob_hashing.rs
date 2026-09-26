use std::borrow::Cow;
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use xxhash_rust::xxh3;

use crate::native::glob::{build_glob_set, literal_segment};
use crate::native::utils::{Normalize, path::get_child_files};
use crate::native::workspace::context::Files;

/// Globs that resolve without a scan: `<dir>/**/*` is a contiguous range of
/// the path-ordered table, a plain path is one lookup.
enum Lookup {
    Prefix(String),
    Literal(String),
}

fn classify(glob: &str) -> Option<Lookup> {
    // A leading `!` is a negation, which only a scan can apply.
    if glob.starts_with('!') {
        return None;
    }
    // globset reads `\` as `/` on Windows, where node's `join` produces it.
    let glob: Cow<str> = if cfg!(windows) {
        Cow::Owned(glob.replace('\\', "/"))
    } else {
        Cow::Borrowed(glob)
    };
    // The path a glob names, escapes resolved, when every segment is literal.
    let plain = |s: &str| -> Option<String> {
        let names = s
            .split('/')
            .map(|part| {
                literal_segment(part).filter(|name| !matches!(name.as_str(), "" | "." | ".."))
            })
            .collect::<Option<Vec<_>>>()?;
        Some(names.join("/"))
    };
    if glob == "**" || glob == "**/*" {
        return Some(Lookup::Prefix(String::new()));
    }
    if let Some(dir) = glob
        .strip_suffix("/**/*")
        .or_else(|| glob.strip_suffix("/**"))
        .or_else(|| glob.strip_suffix('/'))
    {
        return plain(dir).map(Lookup::Prefix);
    }
    plain(&glob).map(Lookup::Literal)
}

/// Whether the group must scan the table: it is empty, or a glob in it is
/// not a prefix or literal lookup.
pub(super) fn needs_scan(globs: &[String]) -> bool {
    globs.is_empty() || globs.iter().any(|glob| classify(glob).is_none())
}

type Entry<'a> = (&'a PathBuf, &'a String);

fn prefix_entries<'a>(files: &'a Files, dir: &str, into: &mut Vec<Entry<'a>>) {
    if dir.is_empty() {
        into.extend(files.iter());
        return;
    }
    let dir = Path::new(dir);
    into.extend(get_child_files(dir, files).skip_while(|(path, _)| path.as_path() == dir));
}

/// The union of the group's matches in table order, or `None` when the group
/// must scan (see `needs_scan`).
fn lookup_entries<'a>(files: &'a Files, globs: &[String]) -> Option<Vec<Entry<'a>>> {
    if globs.is_empty() {
        return None;
    }
    let mut entries = Vec::new();
    for glob in globs {
        match classify(glob)? {
            Lookup::Prefix(dir) => prefix_entries(files, &dir, &mut entries),
            Lookup::Literal(file) => entries.extend(files.get_key_value(Path::new(&file))),
        }
    }
    entries.sort_unstable_by_key(|(path, _)| *path);
    entries.dedup_by_key(|(path, _)| *path);
    Some(entries)
}

fn hash_entry(hasher: &mut xxh3::Xxh3, path: &Path, hash: &str) {
    // Off Windows a valid UTF-8 path normalizes to itself, so skip the copy.
    match path.to_str() {
        Some(file) if !cfg!(windows) => hasher.update(file.as_bytes()),
        _ => hasher.update(path.to_normalized_string().as_bytes()),
    }
    hasher.update(hash.as_bytes());
}

fn hash_entries(entries: &[Entry<'_>]) -> String {
    let mut hasher = xxh3::Xxh3::new();
    for (path, hash) in entries {
        hash_entry(&mut hasher, path, hash);
    }
    hasher.digest().to_string()
}

fn hash_by_scan(files: &Files, globs: &[String]) -> anyhow::Result<String> {
    let glob_set = build_glob_set(globs)?;
    let matched: Vec<Entry<'_>> = files
        .par_iter()
        .filter(|(path, _)| glob_set.is_match(path.to_normalized_string()))
        .collect();
    Ok(hash_entries(&matched))
}

fn hash_group(files: &Files, globs: &[String]) -> anyhow::Result<String> {
    match lookup_entries(files, globs) {
        Some(entries) => Ok(hash_entries(&entries)),
        None => hash_by_scan(files, globs),
    }
}

/// One digest per glob group, byte-identical to hashing the scan's matches.
pub(super) fn hash_glob_groups(
    files: &Files,
    glob_groups: &[Vec<String>],
) -> anyhow::Result<Vec<String>> {
    glob_groups
        .par_iter()
        .map(|globs| hash_group(files, globs))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table(paths: &[&str]) -> Files {
        paths
            .iter()
            .map(|p| (PathBuf::from(p), format!("hash-of-{p}")))
            .collect()
    }

    fn sample() -> Files {
        table(&[
            "package.json",
            "pnpm-lock.yaml",
            "tsconfig.base.json",
            "eslint.config.js",
            "libs/a/src/index.ts",
            "libs/a/src/index.spec.ts",
            "libs/a/tsconfig.json",
            "libs/a/.eslintignore",
            "libs/a/nested/src/deep.ts",
            "libs/a/nested/tsconfig.json",
            "libs/a-b/src/index.ts",
            "libs/a.ts",
            "libs/a.ts/inside.ts",
            "libs/b/src/index.ts",
            "libs/b/eslint.config.js",
            "apps/web/src/main.ts",
            "apps/@scope/pkg/src/main.ts",
        ])
    }

    fn strs(globs: &[&str]) -> Vec<String> {
        globs.iter().map(|g| g.to_string()).collect()
    }

    fn sequential_scan(files: &Files, globs: &[String]) -> String {
        let glob_set = build_glob_set(globs).unwrap();
        let matched: Vec<Entry<'_>> = files
            .iter()
            .filter(|(path, _)| glob_set.is_match(path.to_normalized_string()))
            .collect();
        hash_entries(&matched)
    }

    fn assert_same_as_scan(files: &Files, globs: &[&str]) {
        let globs = strs(globs);
        assert_eq!(
            hash_group(files, &globs).unwrap(),
            sequential_scan(files, &globs),
            "globs {globs:?}"
        );
    }

    fn paths_of<'a>(entries: &[Entry<'a>]) -> Vec<&'a str> {
        entries.iter().map(|(p, _)| p.to_str().unwrap()).collect()
    }

    #[test]
    fn classifies_globs() {
        let prefix = |g: &str| match classify(g) {
            Some(Lookup::Prefix(dir)) => Some(dir),
            _ => None,
        };
        let literal = |g: &str| match classify(g) {
            Some(Lookup::Literal(file)) => Some(file),
            _ => None,
        };
        assert_eq!(prefix("libs/a/**/*").as_deref(), Some("libs/a"));
        assert_eq!(prefix("libs/a/**").as_deref(), Some("libs/a"));
        assert_eq!(prefix("libs/a/").as_deref(), Some("libs/a"));
        assert_eq!(prefix("**/*").as_deref(), Some(""));
        assert_eq!(prefix("**").as_deref(), Some(""));
        assert_eq!(
            literal("libs/a/.eslintignore").as_deref(),
            Some("libs/a/.eslintignore")
        );
        assert_eq!(
            literal("apps/@scope/pkg/tsconfig.json").as_deref(),
            Some("apps/@scope/pkg/tsconfig.json")
        );
        // Characters globset reads as text stay literal lookups.
        for name in ["libs/a!b", "libs/pi|pe", "libs/x)", "libs/y]", "libs/co,ma"] {
            assert_eq!(prefix(&format!("{name}/**")).as_deref(), Some(name));
            assert_eq!(literal(name).as_deref(), Some(name));
        }
        for scanned in [
            "libs/(a)/**",
            "libs/brace}/**",
            "libs/+(a|b)/**",
            "libs/?/**",
            "libs/**/*.spec.ts",
            "libs/{a,b}/**/*",
            "!libs/a/**/*",
            "**/*.{ts,js}",
            "/**/*",
            "/",
            "",
            "libs//a/**/*",
            "libs/./a/**/*",
            "../a/**/*",
            "/libs/a/**/*",
            "libs/a//tsconfig.json",
            "./tsconfig.base.json",
        ] {
            assert!(classify(scanned).is_none(), "{scanned:?} must scan");
        }
    }

    #[cfg(windows)]
    #[test]
    fn classifies_backslash_globs_on_windows() {
        assert!(matches!(
            classify(r"libs\a\**\*"),
            Some(Lookup::Prefix(dir)) if dir == "libs/a"
        ));
        assert!(matches!(
            classify(r"libs\a\.eslintignore"),
            Some(Lookup::Literal(file)) if file == "libs/a/.eslintignore"
        ));
    }

    #[cfg(not(windows))]
    #[test]
    fn backslash_is_an_escape_off_windows() {
        assert!(classify(r"libs\a\**\*").is_none());
        // An escape names its character: a directory literally called `*`.
        assert!(matches!(
            classify(r"libs/\*/**"),
            Some(Lookup::Prefix(dir)) if dir == "libs/*"
        ));
        let files = table(&["libs/*/x.ts", "libs/a/x.ts"]);
        assert_same_as_scan(&files, &[r"libs/\*/**"]);
        assert_same_as_scan(&files, &[r"libs/\*/x.ts"]);
    }

    #[test]
    fn needs_scan_only_for_patterns_and_empty_groups() {
        assert!(!needs_scan(&strs(&["libs/a/**/*", "pnpm-lock.yaml"])));
        assert!(needs_scan(&strs(&["libs/a/**/*", "**/*.spec.ts"])));
        assert!(needs_scan(&[]));
    }

    #[test]
    fn prefix_entries_are_the_subtree_only() {
        let files = sample();
        let mut entries = Vec::new();
        prefix_entries(&files, "libs/a", &mut entries);
        assert_eq!(
            paths_of(&entries),
            [
                "libs/a/.eslintignore",
                "libs/a/nested/src/deep.ts",
                "libs/a/nested/tsconfig.json",
                "libs/a/src/index.spec.ts",
                "libs/a/src/index.ts",
                "libs/a/tsconfig.json",
            ]
        );

        let mut file_as_dir = Vec::new();
        prefix_entries(&files, "libs/a.ts", &mut file_as_dir);
        assert_eq!(paths_of(&file_as_dir), ["libs/a.ts/inside.ts"]);

        let mut missing = Vec::new();
        prefix_entries(&files, "libs/missing", &mut missing);
        assert!(missing.is_empty());

        let mut all = Vec::new();
        prefix_entries(&files, "", &mut all);
        assert_eq!(all.len(), files.len());
    }

    #[test]
    fn overlapping_lookups_merge_without_duplicates() {
        let files = sample();
        let entries = lookup_entries(
            &files,
            &strs(&[
                "libs/a/tsconfig.json",
                "libs/a/**/*",
                "libs/a/nested/**/*",
                "pnpm-lock.yaml",
                "tsconfig.base.json",
                "libs/a/does-not-exist.json",
            ]),
        )
        .unwrap();
        assert_eq!(entries.len(), 6 + 2);
        let paths = paths_of(&entries);
        let mut sorted = paths.iter().map(|p| PathBuf::from(p)).collect::<Vec<_>>();
        sorted.sort();
        assert_eq!(
            paths,
            sorted
                .iter()
                .map(|p| p.to_str().unwrap())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn matches_the_scanning_path() {
        let files = sample();
        assert_same_as_scan(&files, &["libs/a/**/*"]);
        assert_same_as_scan(&files, &["**/*"]);
        assert_same_as_scan(&files, &["libs/a/**/*", "libs/a/.eslintignore"]);
        assert_same_as_scan(
            &files,
            &[
                "libs/a/**/*",
                "eslint.config.js",
                "libs/a/.eslintignore",
                "pnpm-lock.yaml",
                "tsconfig.base.json",
                "libs/a/tsconfig.json",
            ],
        );
        assert_same_as_scan(&files, &["libs/a/nested/**/*", "libs/a/**/*"]);
        assert_same_as_scan(&files, &["apps/@scope/pkg/**/*", "pnpm-lock.yaml"]);
        assert_same_as_scan(&files, &["libs/missing/**/*", "missing.json"]);
        assert_same_as_scan(&files, &["libs/a/"]);
        assert_same_as_scan(&files, &["**/*", "pnpm-lock.yaml"]);
        let named = table(&[
            "libs/a!b/x.ts",
            "libs/pi|pe/x.ts",
            "libs/x)/y.ts",
            "libs/y]/z.ts",
        ]);
        for glob in [
            "libs/a!b/**",
            "libs/pi|pe/x.ts",
            "libs/x)/**/*",
            "libs/y]/z.ts",
        ] {
            assert_same_as_scan(&named, &[glob]);
        }
        assert_same_as_scan(&files, &["libs/a.ts/**/*"]);
        assert_same_as_scan(&files, &["libs/a.ts/"]);
        assert_same_as_scan(&files, &["libs//a/**/*"]);
        assert_same_as_scan(&files, &["libs/./a/**/*"]);
        assert_same_as_scan(&files, &["/libs/a/**/*"]);
        assert_same_as_scan(&files, &["../libs/a/**/*"]);
        assert_same_as_scan(&files, &["libs/**/*.spec.ts"]);
        assert_same_as_scan(&files, &["{libs,apps}/**/*.ts"]);
        assert_same_as_scan(&files, &[]);
    }

    #[test]
    fn empty_group_hashes_every_file_like_the_scan() {
        let files = sample();
        assert_eq!(
            hash_group(&files, &[]).unwrap(),
            hash_group(&files, &strs(&["**/*"])).unwrap()
        );
    }

    #[test]
    fn parallel_scan_keeps_table_order() {
        let paths: Vec<String> = (0..5000)
            .map(|i| {
                format!(
                    "libs/p{}/src/file{i}.{}",
                    i % 37,
                    if i % 3 == 0 { "spec.ts" } else { "ts" }
                )
            })
            .collect();
        let files: Files = paths
            .iter()
            .map(|p| (PathBuf::from(p), p.len().to_string()))
            .collect();
        let globs = strs(&["**/*.spec.ts"]);
        assert_eq!(
            hash_by_scan(&files, &globs).unwrap(),
            sequential_scan(&files, &globs)
        );
    }

    #[test]
    fn hashes_groups_independently_in_input_order() {
        let files = sample();
        let groups = vec![
            strs(&["libs/a/**/*", "pnpm-lock.yaml"]),
            strs(&["libs/b/**/*", "pnpm-lock.yaml"]),
            strs(&["libs/**/*.spec.ts"]),
            strs(&["libs/a/**/*", "pnpm-lock.yaml"]),
        ];
        let hashes = hash_glob_groups(&files, &groups).unwrap();
        assert_eq!(hashes.len(), 4);
        assert_eq!(hashes[0], hashes[3]);
        assert_ne!(hashes[0], hashes[1]);
        assert_eq!(hashes[2], sequential_scan(&files, &groups[2]));
    }

    #[test]
    fn digest_changes_with_content_and_membership() {
        let files = sample();
        let globs = strs(&["libs/a/**/*", "pnpm-lock.yaml"]);
        let before = hash_group(&files, &globs).unwrap();

        let mut changed = files.clone();
        changed.insert(PathBuf::from("libs/a/src/index.ts"), "other".into());
        assert_ne!(before, hash_group(&changed, &globs).unwrap());

        let mut added = files.clone();
        added.insert(PathBuf::from("libs/a/src/new.ts"), "n".into());
        assert_ne!(before, hash_group(&added, &globs).unwrap());

        let mut unrelated = files.clone();
        unrelated.insert(PathBuf::from("libs/b/src/new.ts"), "n".into());
        assert_eq!(before, hash_group(&unrelated, &globs).unwrap());
    }
}
