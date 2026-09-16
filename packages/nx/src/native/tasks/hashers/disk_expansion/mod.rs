//! Expands an `includeIgnored` fileset group, or a dependency's declared
//! outputs, into the files on disk.
//!
//! - `entries` holds one parsed positive or negation. The glob text rules
//!   themselves live in `crate::native::glob::glob_transform`.
//! - `expansion` resolves the entries into files, leaning on the workspace
//!   context or an index wherever it can, and walking where it cannot.

mod entries;
mod expansion;

pub(crate) use entries::{Negation, Positive};
pub use expansion::FilesExpansion;
pub(crate) use expansion::validate_files_globs;
pub(crate) use expansion::{
    FilesExpansionCache, Source, expand_cached, expand_entries, expand_globs,
};
#[cfg(test)]
use expansion::{NOTHING_TRACKED, parse_group, validate_files_glob};

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::native::walker::PathPredicate;
    use anyhow::Result;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;
    use std::path::Path;

    /// The disk-backed source, which is what most of these tests expand from.
    pub(crate) fn expand_files(workspace_root: &Path, globs: &[String]) -> Result<FilesExpansion> {
        expand_globs(
            workspace_root,
            globs,
            &Source::fileset_from_disk(workspace_root),
        )
    }

    /// `expand_files` with a workspace context to lean on.
    fn expand_files_with(
        workspace_root: &Path,
        globs: &[String],
        tracked_file: PathPredicate,
    ) -> Result<FilesExpansion> {
        expand_globs(
            workspace_root,
            globs,
            &Source::fileset_reading_disk(tracked_file, workspace_root),
        )
    }

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
    fn a_path_the_context_knows_is_taken_without_reading_the_disk() {
        let temp = workspace();
        // The tracked path exists only in the caller's word for it.
        let expansion = expand_files_with(temp.path(), &globs(&["dist/gen/absent.js"]), &|path| {
            path == "dist/gen/absent.js"
        })
        .unwrap();
        assert_eq!(expansion.files, vec!["dist/gen/absent.js"]);
    }

    // A source applies `accept` so it can skip work, not because the loop
    // trusts it to. One that over-selects must not widen the result.
    #[test]
    fn a_source_that_ignores_the_filter_cannot_widen_the_result() {
        let temp = workspace();
        let everything = |dir: &str, _accept: PathPredicate| {
            (dir == "dist/gen").then(|| globs(&["dist/gen/a.js", "dist/gen/a.js.map"]))
        };
        let group = globs(&["dist/gen/**/*.js"]);
        let (positives, negations) = parse_group(&group).unwrap();
        let expansion = expand_entries(
            temp.path(),
            &positives,
            &negations,
            &Source::fileset(NOTHING_TRACKED, &everything),
        )
        .unwrap();
        assert_eq!(expansion.files, vec!["dist/gen/a.js"]);
    }

    #[test]
    fn a_directory_is_whatever_the_source_says_it_holds() {
        let temp = workspace();
        // A phantom the disk does not have, to prove the source is believed.
        let listed = |dir: &str, accept: PathPredicate| {
            (dir == "dist/gen").then(|| {
                globs(&[
                    "dist/gen/a.js",
                    "dist/gen/a.js.map",
                    "dist/gen/nested/b.js",
                    "dist/gen/phantom.js",
                ])
                .into_iter()
                .filter(|path| accept(path))
                .collect()
            })
        };
        let group = globs(&["dist/gen/**/*.js", "!dist/gen/nested/**"]);
        let (positives, negations) = parse_group(&group).unwrap();
        let expansion = expand_entries(
            temp.path(),
            &positives,
            &negations,
            &Source::fileset(NOTHING_TRACKED, &listed),
        )
        .unwrap();
        // The pattern and the negation apply to what the source returned.
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/phantom.js"]
        );
        // A directory the source has nothing for contributes nothing.
        let expansion = expand_entries(
            temp.path(),
            &parse_group(&globs(&["dist/other/**"])).unwrap().0,
            &[],
            &Source::fileset(NOTHING_TRACKED, &listed),
        )
        .unwrap();
        assert!(expansion.files.is_empty());
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

    /// A glob that says it leaves the workspace is refused when the plan is
    /// built, before anything reads the disk. A link is not refused: it does
    /// not say so, see `a_link_is_read_where_it_points`.
    #[test]
    fn refuses_a_glob_that_says_it_leaves_the_workspace() {
        let err = match validate_files_glob("../outside-secret.txt") {
            Err(err) => err,
            Ok(_) => panic!("a glob that leaves the workspace must be refused"),
        };
        assert!(err.to_string().contains("outside the workspace"), "{err}");
        assert!(validate_files_glob("../**").is_err());
        assert!(validate_files_glob("/etc/passwd").is_err());
        assert!(validate_files_glob("!../**").is_err());
    }

    /// A fileset reads a path wherever it points, the same as a declared
    /// output: `dist` is often a link into a build cache. A linked directory
    /// is still not walked into, which is what the glob case pins.
    #[cfg(unix)]
    #[test]
    fn a_link_is_read_where_it_points() {
        let temp = workspace();
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("linked.js").write_str("out").unwrap();
        elsewhere.child("tree/deep.js").write_str("deep").unwrap();
        std::os::unix::fs::symlink(
            elsewhere.path().join("linked.js"),
            temp.path().join("dist/gen/escape.js"),
        )
        .unwrap();
        std::os::unix::fs::symlink(
            elsewhere.path().join("tree"),
            temp.path().join("dist/gen/tree"),
        )
        .unwrap();

        let expansion = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        assert_eq!(expansion.files, vec!["dist/gen/a.js", "dist/gen/escape.js"]);
        // Named exactly, a link out is read rather than refused.
        assert_eq!(
            expand_files(temp.path(), &globs(&["dist/gen/escape.js"]))
                .unwrap()
                .files,
            vec!["dist/gen/escape.js"]
        );
        // A linked directory named exactly is read where it points.
        assert_eq!(
            expand_files(temp.path(), &globs(&["dist/gen/tree"]))
                .unwrap()
                .files,
            vec!["dist/gen/tree/deep.js"]
        );
        // A walk still does not descend into one.
        assert!(
            !expand_files(temp.path(), &globs(&["dist/**"]))
                .unwrap()
                .files
                .iter()
                .any(|f| f.contains("tree/"))
        );
    }

    /// A negation applies to an entry that names one file as much as to a
    /// walked one, whether the file is found on disk or vouched for by the
    /// context. Nothing joins the result without being asked.
    #[test]
    fn a_negation_excludes_an_exact_path_entry_too() {
        let temp = workspace();
        let group = globs(&["dist/gen/a.js", "dist/other/c.js", "!dist/gen/a.js"]);
        assert_eq!(
            expand_files(temp.path(), &group).unwrap().files,
            vec!["dist/other/c.js"]
        );
        // The same when the context vouches for it, so no stat is taken.
        let known: PathPredicate = &|path| path == "dist/gen/a.js";
        assert_eq!(
            expand_files_with(temp.path(), &group, known).unwrap().files,
            vec!["dist/other/c.js"]
        );
    }

    /// Negations apply to the whole group however it is ordered, the same way
    /// `NxGlobSetBuilder` sorts a regular fileset's patterns and keeps its
    /// exclusions in a set of their own.
    #[test]
    fn the_order_of_a_negation_in_the_group_does_not_matter() {
        let temp = workspace();
        let first = expand_files(
            temp.path(),
            &globs(&["!dist/gen/**/*.map", "dist/gen/**/*"]),
        )
        .unwrap();
        let last = expand_files(
            temp.path(),
            &globs(&["dist/gen/**/*", "!dist/gen/**/*.map"]),
        )
        .unwrap();
        assert_eq!(first.files, last.files);
        assert!(!first.files.iter().any(|f| f.ends_with(".map")));
        assert!(first.files.contains(&"dist/gen/a.js".to_string()));
    }

    #[test]
    fn expands_from_the_partitioned_directory_and_applies_negations() {
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
        // Listed, so the assertion below cannot pass on an empty expansion.
        assert_eq!(
            walked.files,
            vec![
                "dist/gen/a.js",
                "dist/gen/a.js.map",
                "dist/gen/nested/b.js",
                "dist/other/c.js"
            ]
        );
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
    fn a_glob_rooted_at_a_skipped_directory_still_reads_it() {
        let temp = workspace();
        temp.child("node_modules/foo/package.json")
            .write_str("{}")
            .unwrap();
        // The prefix is the skipped directory itself, not a path inside it.
        assert_eq!(
            expand_files(temp.path(), &globs(&["node_modules/**/package.json"]))
                .unwrap()
                .files,
            vec!["node_modules/foo/package.json"]
        );
    }

    #[test]
    fn an_exact_directory_means_everything_under_it() {
        let temp = workspace();
        // The same rule a declared output follows, and what a negation
        // naming a directory already excluded.
        assert_eq!(
            expand_files(temp.path(), &globs(&["dist/other"]))
                .unwrap()
                .files,
            vec!["dist/other/c.js"]
        );
        assert_eq!(
            expand_files(temp.path(), &globs(&["dist/other/**/*"]))
                .unwrap()
                .files,
            vec!["dist/other/c.js"]
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
    }

    #[test]
    fn repeated_slashes_are_normalized_and_a_bare_negation_is_rejected() {
        let temp = workspace();
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();
        assert_eq!(
            expand(&["dist//gen/**", "!dist//gen//**/*.map"]).files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert_eq!(
            expand(&["dist/gen/"]).files,
            vec!["dist/gen/a.js", "dist/gen/a.js.map", "dist/gen/nested/b.js"]
        );
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
        assert_eq!(
            expand("libs/app/@gen").files,
            vec!["libs/app/@gen/schema.json"]
        );
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
