//! Expands an `includeIgnored` fileset group, or a dependency's declared
//! outputs, into the files on disk.
//!
//! - `glob_text` is the text layer: what a glob may say, and where the
//!   literal prefix a walk starts from ends.
//! - `entries` holds one parsed positive or negation.
//! - `walk` reads the disk.
//! - `expansion` resolves the entries into files, leaning on the workspace
//!   context or an index wherever it can.

mod entries;
mod expansion;
mod glob_text;
mod walk;

pub(crate) use entries::{Negation, Positive};
pub use expansion::{FilesExpansion, expand_files, expand_files_with};
pub(crate) use expansion::{
    FilesExpansionCache, Members, NO_INDEX, Source, expand_cached, expand_entries,
    expand_files_cached,
};
#[cfg(test)]
use expansion::{NOTHING_KNOWN, parse_group};
#[cfg(test)]
use glob_text::{expand_literal_braces, validate_files_glob};
pub(crate) use glob_text::{literal_prefix, normalize_glob, validate_files_globs};
pub use walk::FileStamp;
pub(crate) use walk::{seed_walk, stamp_of};

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    pub(crate) fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("dist/gen/a.js").write_str("a").unwrap();
        temp.child("dist/gen/a.js.map").write_str("map").unwrap();
        temp.child("dist/gen/nested/b.js").write_str("b").unwrap();
        temp.child("dist/other/c.js").write_str("c").unwrap();
        temp.child("dist/gen/node_modules/dep/index.js")
            .write_str("dep")
            .unwrap();
        temp.child("node_modules/foo/package.json")
            .write_str("{}")
            .unwrap();
        temp
    }

    pub(crate) fn globs(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn walked_files_carry_their_stamp_unless_the_context_knows_them() {
        let temp = workspace();
        let expansion = expand_files_with(temp.path(), &globs(&["dist/gen/**/*.js"]), &|path| {
            path == "dist/gen/a.js"
        })
        .unwrap();
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert!(expansion.stamps[0].is_none());
        assert!(expansion.stamps[1].is_some());
    }

    #[test]
    fn a_directory_the_members_list_is_taken_from_the_list_not_the_disk() {
        let temp = workspace();
        let listed = |dir: &str| {
            (dir == "dist/gen").then(|| {
                globs(&[
                    "dist/gen/a.js",
                    "dist/gen/a.js.map",
                    "dist/gen/nested/b.js",
                    "dist/gen/phantom.js",
                ])
            })
        };
        let group = globs(&["dist/gen/**/*.js", "!dist/gen/nested/**"]);
        let (positives, negations) = parse_group(&group).unwrap();
        let expansion = expand_entries(
            temp.path(),
            &positives,
            &negations,
            &Source::fileset(NOTHING_KNOWN, &listed),
        )
        .unwrap();
        // The pattern and the negation apply to the list; nothing is stat'ed.
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/phantom.js"]
        );
        assert!(expansion.stamps.iter().all(Option::is_none));
        // A directory the list does not hold is walked as before.
        let expansion = expand_entries(
            temp.path(),
            &parse_group(&globs(&["dist/other/**"])).unwrap().0,
            &[],
            &Source::fileset(NOTHING_KNOWN, &listed),
        )
        .unwrap();
        assert_eq!(expansion.files, vec!["dist/other/c.js"]);
    }

    #[test]
    fn expands_literal_brace_groups() {
        assert_eq!(
            expand_literal_braces("{nx,tsconfig.base}.json"),
            vec!["nx.json", "tsconfig.base.json"]
        );
        assert_eq!(
            expand_literal_braces("tools/{a,b}/{x,y}.ts"),
            vec![
                "tools/a/x.ts",
                "tools/a/y.ts",
                "tools/b/x.ts",
                "tools/b/y.ts"
            ]
        );
        assert_eq!(expand_literal_braces("!{a,b}.md"), vec!["!a.md", "!b.md"]);
        for unchanged in [
            "{a,*}.json",
            "{a,{b,c}}.json",
            "dist/**",
            "{a}.json",
            "{a,b/c}.ts",
        ] {
            assert_eq!(expand_literal_braces(unchanged), vec![unchanged]);
        }
    }

    #[test]
    fn a_root_brace_group_of_literals_names_exact_files_and_a_wildcard_one_walks() {
        let temp = workspace();
        temp.child("nx.json").write_str("{}").unwrap();
        temp.child("tsconfig.base.json").write_str("{}").unwrap();
        let group = globs(&["{nx,tsconfig.base,missing}.json"]);
        validate_files_globs("web", &group).unwrap();
        let expansion = expand_files(temp.path(), &group).unwrap();
        // A name that does not exist matches nothing.
        assert_eq!(expansion.files, vec!["nx.json", "tsconfig.base.json"]);
        // A wildcard alternative stays a glob, walked from the workspace root.
        let walked = expand_files(temp.path(), &globs(&["{nx,*}.json"])).unwrap();
        assert_eq!(walked.files, vec!["nx.json", "tsconfig.base.json"]);
        // In-directory groups keep matching as before.
        let nested = expand_files(temp.path(), &globs(&["dist/gen/{a,nested/b}.js"])).unwrap();
        assert_eq!(nested.files, vec!["dist/gen/a.js", "dist/gen/nested/b.js"]);
    }

    #[test]
    fn refuses_a_prefix_that_leaves_the_workspace() {
        let temp = workspace();
        let outside = temp.path().parent().unwrap().join("outside-secret.txt");
        std::fs::write(&outside, "secret").unwrap();
        let err = match expand_files(temp.path(), &globs(&["../outside-secret.txt"])) {
            Err(err) => err,
            Ok(_) => panic!("a prefix outside the workspace must be refused"),
        };
        assert!(err.to_string().contains("outside the workspace"), "{err}");
        assert!(expand_files(temp.path(), &globs(&["../**"])).is_err());
        std::fs::remove_file(outside).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinks_whose_target_leaves_the_workspace() {
        let temp = workspace();
        let outside = temp.path().parent().unwrap().join("outside-linked.js");
        std::fs::write(&outside, "secret").unwrap();
        std::os::unix::fs::symlink(&outside, temp.path().join("dist/gen/escape.js")).unwrap();
        std::os::unix::fs::symlink(
            temp.path().join("dist/other/c.js"),
            temp.path().join("dist/gen/inside.js"),
        )
        .unwrap();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        assert_eq!(expansion.files, vec!["dist/gen/a.js", "dist/gen/inside.js"]);
        // An exact path that is itself a link out of the workspace is refused.
        assert!(expand_files(temp.path(), &globs(&["dist/gen/escape.js"])).is_err());
        std::fs::remove_file(outside).unwrap();
    }

    #[test]
    fn expands_from_the_literal_prefix_and_applies_negations() {
        let temp = workspace();
        let expansion = expand_files(
            temp.path(),
            &globs(&["dist/gen/**/*.js", "!dist/gen/**/*.map"]),
        )
        .unwrap();
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
    }

    #[test]
    fn walks_skip_hardcoded_ignores_but_exact_paths_inside_them_are_read() {
        let temp = workspace();
        let walked = expand_files(temp.path(), &globs(&["dist/**"])).unwrap();
        assert!(
            !walked.files.iter().any(|f| f.contains("node_modules")),
            "{:?}",
            walked.files
        );

        let exact = expand_files(temp.path(), &globs(&["node_modules/foo/package.json"])).unwrap();
        assert_eq!(exact.files, vec!["node_modules/foo/package.json"]);

        let prefixed = expand_files(temp.path(), &globs(&["node_modules/foo/**"])).unwrap();
        assert_eq!(prefixed.files, vec!["node_modules/foo/package.json"]);
    }

    #[test]
    fn a_fileset_that_lands_on_a_directory_selects_nothing() {
        let temp = workspace();
        assert!(
            expand_files(temp.path(), &globs(&["dist/other"]))
                .unwrap()
                .files
                .is_empty(),
            "a fileset names files; a directory is not one"
        );
        assert_eq!(
            expand_files(temp.path(), &globs(&["dist/other/**/*"]))
                .unwrap()
                .files,
            vec!["dist/other/c.js"],
            "this is how to ask for what is under it"
        );
    }

    #[test]
    fn reads_brackets_parentheses_and_escapes_as_any_fileset_does() {
        let temp = workspace();
        for file in [
            "apps/web/app/(marketing)/page.tsx",
            "apps/web/app/marketing/page.tsx",
            "apps/web/app/[id]/page.tsx",
            "apps/web/app/i/page.tsx",
            "apps/web/app/d/page.tsx",
            "apps/web/app/plain/page.tsx",
        ] {
            temp.child(file).write_str("x").unwrap();
        }
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();

        // `[id]` is a character class and `(marketing)` a group, as in a
        // regular fileset; a backslash escapes brackets the same way too.
        assert_eq!(
            expand(&["apps/web/app/[id]/page.tsx"]).files,
            vec!["apps/web/app/d/page.tsx", "apps/web/app/i/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/\\[id\\]/page.tsx"]).files,
            vec!["apps/web/app/[id]/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/(marketing)/**"]).files,
            vec!["apps/web/app/marketing/page.tsx"]
        );
        // A negation reads the same way.
        assert_eq!(
            expand(&["apps/web/app/**/page.tsx", "!apps/web/app/[id]/**"]).files,
            vec![
                "apps/web/app/(marketing)/page.tsx",
                "apps/web/app/[id]/page.tsx",
                "apps/web/app/marketing/page.tsx",
                "apps/web/app/plain/page.tsx"
            ]
        );
        assert!(expand(&["apps/web/app/(absent)/x.json"]).files.is_empty());
    }

    #[test]
    fn an_exact_path_the_context_knows_never_touches_the_disk() {
        let temp = workspace();
        // Neither path is on disk: membership comes from the context alone.
        let expansion = expand_files_with(
            temp.path(),
            &globs(&["libs/x/tracked.ts", "libs/x/absent.ts"]),
            &|path| path == "libs/x/tracked.ts",
        )
        .unwrap();
        assert_eq!(expansion.files, vec!["libs/x/tracked.ts"]);
        assert_eq!(expansion.stamps, vec![None]);
    }

    #[test]
    fn repeated_slashes_are_normalized_and_a_bare_negation_is_rejected() {
        let temp = workspace();
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();
        assert_eq!(
            expand(&["dist//gen/**", "!dist//gen//**/*.map"]).files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        // Normalizes to `dist/gen`, a directory, which names no files.
        assert!(expand(&["dist/gen/"]).files.is_empty());
        // A negation that normalizes to nothing would exclude everything.
        for bare in ["!", "!/", "!//"] {
            let group = globs(&["dist/**", bare]);
            assert!(validate_files_globs("web", &group).is_err(), "{bare}");
            assert!(expand_files(temp.path(), &group).is_err(), "{bare}");
        }
        assert!(validate_files_globs("web", &globs(&["dist/**", "!../x"])).is_err());
        assert!(validate_files_globs("web", &globs(&["dist/./gen/**"])).is_err());
    }

    #[test]
    fn rejects_a_group_of_only_negations() {
        let err = validate_files_globs("web", &globs(&["!dist/**/*.map"])).unwrap_err();
        assert!(
            err.to_string()
                .contains("no positive includeIgnored fileset"),
            "{err}"
        );
        assert!(validate_files_globs("web", &globs(&["dist/**", "!dist/**/*.map"])).is_ok());
    }

    #[test]
    fn rejects_a_dot_slash_prefix() {
        assert!(validate_files_globs("web", &globs(&["./dist/**"])).is_err());
    }

    #[test]
    fn a_glob_with_no_leading_directory_walks_from_the_workspace_root() {
        let temp = workspace();
        temp.child("root.json").write_str("{}").unwrap();
        validate_files_globs(
            "web",
            &globs(&["**/*.js", "*.json", "dist/**/*.gen", "!**/*.map"]),
        )
        .unwrap();
        // The hardcoded skips still apply below the root, so node_modules is out.
        assert_eq!(
            expand_files(temp.path(), &globs(&["**/*.js"]))
                .unwrap()
                .files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js", "dist/other/c.js"]
        );
        assert_eq!(
            expand_files(temp.path(), &globs(&["*.json"]))
                .unwrap()
                .files,
            vec!["root.json"]
        );
        // A negation with no leading directory filters the walk the same way.
        assert_eq!(
            expand_files(temp.path(), &globs(&["**/*.js", "!**/nested/**"]))
                .unwrap()
                .files,
            vec!["dist/gen/a.js", "dist/other/c.js"]
        );
    }

    #[test]
    fn rejects_paths_that_leave_the_workspace_before_touching_the_disk() {
        for glob in ["../secret", "dist/../../secret", "/etc/passwd", "../**"] {
            let err = validate_files_globs("web", &globs(&[glob])).unwrap_err();
            assert!(
                err.to_string().contains("outside the workspace")
                    || err.to_string().contains("absolute path"),
                "{glob}: {err}"
            );
        }
    }

    #[test]
    fn keeps_at_and_plus_literal_in_the_walk_root() {
        let temp = workspace();
        temp.child("libs/app/@gen/schema.json")
            .write_str("{}")
            .unwrap();
        temp.child("libs/app/gen/schema.json")
            .write_str("{}")
            .unwrap();
        temp.child("libs/app/g+en/schema.json")
            .write_str("{}")
            .unwrap();
        temp.child("node_modules/@scope/pkg/package.json")
            .write_str("{}")
            .unwrap();
        let expand = |glob: &str| expand_files(temp.path(), &globs(&[glob])).unwrap();

        assert_eq!(
            expand("libs/app/@gen/schema.json").files,
            vec!["libs/app/@gen/schema.json"]
        );
        assert!(expand("libs/app/@gen").files.is_empty());
        assert_eq!(
            expand("libs/app/@gen/**").files,
            vec!["libs/app/@gen/schema.json"]
        );
        assert_eq!(
            expand("libs/app/g+en/schema.json").files,
            vec!["libs/app/g+en/schema.json"]
        );
        assert_eq!(
            expand("node_modules/@scope/pkg/package.json").files,
            vec!["node_modules/@scope/pkg/package.json"]
        );
        assert!(expand("libs/app/@gen/absent.json").files.is_empty());
        assert!(validate_files_globs("web", &globs(&["@gen/**"])).is_ok());
    }
}
