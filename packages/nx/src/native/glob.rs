pub mod glob_files;
mod glob_group;
mod glob_parser;
pub mod glob_transform;

use crate::native::glob::glob_transform::convert_glob;
use dashmap::DashMap;
use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use std::fmt::Debug;
use std::path::Path;
use std::sync::{Arc, LazyLock};
use tracing::trace;

static GLOB_CACHE: LazyLock<DashMap<String, Arc<NxGlobSet>>> = LazyLock::new(DashMap::new);

pub struct NxGlobSetBuilder {
    included_globs: GlobSetBuilder,
    excluded_globs: GlobSetBuilder,
}

impl NxGlobSetBuilder {
    pub fn new<S: AsRef<str>>(globs: &[S]) -> anyhow::Result<Self> {
        let mut glob_set_builder = NxGlobSetBuilder {
            included_globs: GlobSetBuilder::new(),
            excluded_globs: GlobSetBuilder::new(),
        };
        let mut globs: Vec<&str> = globs.iter().map(|s| s.as_ref()).collect();
        globs.sort();
        for glob in globs {
            glob_set_builder.add(glob)?;
        }
        Ok(glob_set_builder)
    }

    pub fn add(&mut self, glob: &str) -> anyhow::Result<&mut NxGlobSetBuilder> {
        let negated = glob.starts_with('!');
        let glob_string = glob.strip_prefix('!').unwrap_or(glob).to_string();

        let glob_string = if glob_string.ends_with('/') {
            format!("{}**", glob_string)
        } else {
            glob_string
        };

        let glob = GlobBuilder::new(&glob_string)
            .literal_separator(true)
            .build()
            .map_err(anyhow::Error::from)?;

        if negated {
            self.excluded_globs.add(glob);
        } else {
            self.included_globs.add(glob);
        }

        Ok(self)
    }

    pub fn build(&self) -> anyhow::Result<NxGlobSet> {
        Ok(NxGlobSet {
            excluded_globs: self.excluded_globs.build()?,
            included_globs: self.included_globs.build()?,
        })
    }
}

#[derive(Debug)]
pub struct NxGlobSet {
    included_globs: GlobSet,
    excluded_globs: GlobSet,
}
impl NxGlobSet {
    pub fn is_match<P: AsRef<Path>>(&self, path: P) -> bool {
        if self.included_globs.is_empty() {
            !self.excluded_globs.is_match(path.as_ref())
        } else if self.excluded_globs.is_empty() {
            self.included_globs.is_match(path.as_ref())
        } else {
            self.included_globs.is_match(path.as_ref())
                && !self.excluded_globs.is_match(path.as_ref())
        }
    }
}

/// Splits a glob that is a single top-level brace group (`{a,b,c}`) into its
/// alternatives, so each can be extglob-converted independently; returns
/// anything else unchanged. A glob that starts with `{` and ends with `}` can
/// still be several groups (`{a,b}/x.{c,d}`), which globset expands natively,
/// so only a group whose opening brace closes at the final character is split.
/// The common path returns a borrowing `Once` to stay allocation-free.
fn potential_glob_split(
    glob: &str,
) -> itertools::Either<std::vec::IntoIter<&str>, std::iter::Once<&str>> {
    use itertools::Either::*;
    let bytes = glob.as_bytes();
    if bytes.first() != Some(&b'{') || bytes.last() != Some(&b'}') {
        return Right(std::iter::once(glob));
    }

    // Not a single group if the opening brace closes before the final char.
    let mut depth = 0usize;
    for (i, &b) in bytes.iter().enumerate() {
        match b {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 && i != bytes.len() - 1 {
                    return Right(std::iter::once(glob));
                }
            }
            _ => {}
        }
    }

    // Split on commas at the outer depth, leaving any nested `{...}` intact.
    let inner = &glob[1..bytes.len() - 1];
    let mut parts = Vec::new();
    let mut depth = 0usize;
    let mut start = 0usize;
    for (i, &b) in inner.as_bytes().iter().enumerate() {
        match b {
            b'{' => depth += 1,
            b'}' => depth -= 1,
            b',' if depth == 0 => {
                parts.push(&inner[start..i]);
                start = i + 1;
            }
            _ => {}
        }
    }
    parts.push(&inner[start..]);
    Left(parts.into_iter())
}

pub(crate) fn build_glob_set<S: AsRef<str> + Debug>(globs: &[S]) -> anyhow::Result<Arc<NxGlobSet>> {
    // Build cache key from sorted globs joined by null byte (cannot appear in glob strings)
    let mut sorted_globs: Vec<&str> = globs.iter().map(|s| s.as_ref()).collect();
    sorted_globs.sort();
    let cache_key = sorted_globs.join("\0");

    if let Some(cached) = GLOB_CACHE.get(&cache_key) {
        return Ok(Arc::clone(cached.value()));
    }

    let result = globs
        .iter()
        .flat_map(|s| potential_glob_split(s.as_ref()))
        .map(|glob| {
            // Decide on the pattern without its negation marker. A leading `!`
            // marks the whole glob as an exclusion — it is not extglob syntax —
            // and convert_glob strips bare `@`, `+` and `?` out of anything it
            // touches (see special_char_with_no_group, which `+spec.ts`-style
            // patterns rely on). Routing a plain exclusion through it purely
            // because of that leading `!` silently rewrote `!dist/@scope/pkg`
            // to `!dist/scope/pkg`, so the exclusion matched nothing.
            let pattern = glob.strip_prefix('!').unwrap_or(glob);
            if pattern.contains('!')
                || pattern.contains('|')
                || pattern.contains('(')
                || pattern.contains("{,")
            {
                convert_glob(glob)
            } else {
                Ok(vec![glob.to_string()])
            }
        })
        .collect::<anyhow::Result<Vec<_>>>()?
        .concat();

    trace!(?globs, ?result, "converted globs");

    let glob_set = Arc::new(NxGlobSetBuilder::new(&result)?.build()?);
    GLOB_CACHE.insert(cache_key, Arc::clone(&glob_set));
    Ok(glob_set)
}

#[napi]
/// Checks which `paths` match the given `globs`, using the same glob engine
/// as the task hasher (`build_glob_set`). Used to statically match
/// `dependentTasksOutputFiles` globs against candidate paths.
pub fn match_glob_paths(globs: Vec<String>, paths: Vec<String>) -> anyhow::Result<Vec<bool>> {
    let glob_set = build_glob_set(&globs)?;
    Ok(paths.iter().map(|path| glob_set.is_match(path)).collect())
}

pub(crate) fn contains_glob_pattern(value: &str) -> bool {
    value.contains('!')
        || value.contains('?')
        || value.contains('@')
        || value.contains('+')
        || value.contains('*')
        || value.contains('|')
        || value.contains(',')
        || value.contains('{')
        || value.contains('}')
        || value.contains('[')
        || value.contains(']')
        || value.contains('(')
        || value.contains(')')
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn should_not_strip_literal_chars_from_plain_negated_globs() {
        // A leading `!` is not extglob syntax. Routing a plain exclusion
        // through convert_glob because of it used to eat the `@`/`+`, so the
        // exclusion matched nothing at all.
        let glob_set = build_glob_set(&["dist/**", "!dist/libs/@scope/pkg/.cache/**"]).unwrap();
        assert!(glob_set.is_match("dist/libs/@scope/pkg/index.js"));
        assert!(!glob_set.is_match("dist/libs/@scope/pkg/.cache/x"));

        let glob_set = build_glob_set(&["dist/**", "!dist/libs/a+b/.cache/**"]).unwrap();
        assert!(!glob_set.is_match("dist/libs/a+b/.cache/x"));

        // Extglob exclusions still convert exactly as before — nx's own default
        // inputs rely on `+spec.ts` collapsing to `spec.ts`.
        let glob_set = build_glob_set(&["libs/**/*", "!libs/**/?(*.)+spec.ts?(.snap)"]).unwrap();
        assert!(!glob_set.is_match("libs/a/b.spec.ts"));
        assert!(glob_set.is_match("libs/a/b.ts"));
    }

    #[test]
    fn should_match_glob_paths() {
        let result = match_glob_paths(
            vec!["**/*.d.ts".to_string()],
            vec![
                "dist/libs/dep/index.d.ts".to_string(),
                "dist/libs/dep/index.js".to_string(),
            ],
        )
        .unwrap();
        assert_eq!(result, vec![true, false]);
    }

    #[test]
    fn should_work_with_simple_globs() {
        let glob_set = build_glob_set(&["**/*"]).unwrap();
        assert!(glob_set.is_match("packages/nx/package.json"));

        let glob_set = build_glob_set(&["!test/*.spec.ts"]).unwrap();
        assert!(!glob_set.is_match("test/file.spec.ts"));
        assert!(glob_set.is_match("test/file.ts"));

        let glob_set = build_glob_set(&["test/*.spec.ts"]).unwrap();
        assert!(glob_set.is_match("test/file.spec.ts"));
        assert!(!glob_set.is_match("test/file.ts"));
    }

    #[test]
    fn should_detect_package_json() {
        let glob_set = build_glob_set(&["packages/*/package.json"]).unwrap();
        assert!(glob_set.is_match("packages/nx/package.json"))
    }

    #[test]
    fn should_not_detect_deeply_nested_package_json() {
        let glob_set = build_glob_set(&["packages/*/package.json"]).unwrap();
        assert!(!glob_set.is_match("packages/nx/test-files/package.json"))
    }

    #[test]
    fn should_detect_deeply_nested_package_json() {
        let glob_set = build_glob_set(&["packages/**/package.json"]).unwrap();
        assert!(glob_set.is_match("packages/nx/test-files/package.json"))
    }

    #[test]
    fn should_detect_node_modules() {
        let glob_set = build_glob_set(&["**/node_modules"]).unwrap();
        assert!(glob_set.is_match("node_modules"));
        assert!(glob_set.is_match("packages/nx/node_modules"));
    }

    #[test]
    fn should_not_detect_root_plugin_configs() {
        let glob_set = build_glob_set(&["*/**/Cargo.toml"]).unwrap();
        assert!(glob_set.is_match("packages/a/Cargo.toml"));
        assert!(glob_set.is_match("a/Cargo.toml"));
        assert!(!glob_set.is_match("Cargo.toml"))
    }

    #[test]
    fn should_handle_negated_globs() {
        let glob_set = build_glob_set(&["!nested/ignore/", "nested/"]).unwrap();
        assert!(!glob_set.is_match("file.map"));
        assert!(!glob_set.is_match("nested/ignore/file.js"));
        assert!(!glob_set.is_match("another-nested/nested/file.ts"));
        assert!(glob_set.is_match("nested/file.js"));
        assert!(glob_set.is_match("nested/nested/file.ts"));

        let glob_set = build_glob_set(&["nested/", "!nested/*.{css,map}"]).unwrap();
        assert!(glob_set.is_match("nested/file.js"));
        assert!(glob_set.is_match("nested/file.ts"));
        assert!(!glob_set.is_match("nested/file.css"));
        assert!(!glob_set.is_match("nested/file.map"));

        let glob_set = build_glob_set(&["!nested/**/ignore/", "nested/**"]).unwrap();
        assert!(glob_set.is_match("nested/nested/file.js"));
        assert!(!glob_set.is_match("nested/ignore/file.ts"));
        assert!(!glob_set.is_match("nested/nested/ignore/file.ts"));
    }

    #[test]
    fn should_handle_multiple_globs() {
        let glob_set = build_glob_set(&["nested/", "doesnt-exist/"]).unwrap();
        assert!(glob_set.is_match("nested/file.js"));
        assert!(!glob_set.is_match("file.js"));
    }

    #[test]
    fn should_handle_complex_patterns() {
        let glob_set =
            build_glob_set(&["dist/!(cache|cache2)/**/!(README|LICENSE).(txt|md)"]).unwrap();

        // matches
        assert!(glob_set.is_match("dist/nested/file.txt"));
        assert!(glob_set.is_match("dist/nested/file.md"));
        assert!(glob_set.is_match("dist/nested/doublenested/triplenested/file.txt"));
        // no matches
        assert!(!glob_set.is_match("dist/file.txt"));
        assert!(!glob_set.is_match("dist/cache/nested/README.txt"));
        assert!(!glob_set.is_match("dist/nested/LICENSE.md"));
        assert!(!glob_set.is_match("dist/cache/file.txt"));
        assert!(!glob_set.is_match("dist/cache2/file.txt"));
        assert!(!glob_set.is_match("dist/cache2/README.txt"));
        assert!(!glob_set.is_match("dist/LICENSE.md"));
        assert!(!glob_set.is_match("dist/README.txt"));

        let glob_set = build_glob_set(&["dist/*.(js|ts)"]).unwrap();
        // matches
        assert!(glob_set.is_match("dist/file.js"));
        assert!(glob_set.is_match("dist/file.ts"));
        //no matches
        assert!(!glob_set.is_match("dist/file.txt"));
        assert!(!glob_set.is_match("dist/nested/file.js"));

        let glob_set = build_glob_set(&["dist/**/!(main).(js|ts)"]).unwrap();
        // matches
        assert!(glob_set.is_match("dist/file.js"));
        //no matches
        assert!(!glob_set.is_match("dist/main.js"));

        let glob_set = build_glob_set(&["dist/!(main|cache)/"]).unwrap();
        // matches
        assert!(glob_set.is_match("dist/nested/"));
        // no matches
        assert!(!glob_set.is_match("dist/main.js"));
        assert!(!glob_set.is_match("dist/file.js"));
        assert!(!glob_set.is_match("dist/cache/"));
        assert!(!glob_set.is_match("dist/main/"));

        let glob_set = build_glob_set(&["**/*.spec.ts{,.snap}"]).unwrap();
        // matches
        assert!(glob_set.is_match("src/file.spec.ts"));
        assert!(glob_set.is_match("src/file.spec.ts.snap"));
        // no matches
        assert!(!glob_set.is_match("src/file.ts"));
    }

    #[test]
    fn should_handle_negative_globs_with_one_directory() {
        let glob_set = build_glob_set(&["packages/!(package-a)*"]).unwrap();

        // matches
        assert!(glob_set.is_match("packages/package-b"));
        assert!(glob_set.is_match("packages/package-c"));
        // no matches
        assert!(!glob_set.is_match("packages/package-a"));
        assert!(!glob_set.is_match("packages/package-a-b"));
        assert!(!glob_set.is_match("packages/package-a-b/nested"));
        assert!(!glob_set.is_match("packages/package-b/nested"));

        let glob_set = build_glob_set(&["packages/!(package-a)*/package.json"]).unwrap();
        assert!(glob_set.is_match("packages/package-b/package.json"));
        assert!(glob_set.is_match("packages/package-c/package.json"));
        assert!(!glob_set.is_match("packages/package-a/package.json"));
        assert!(!glob_set.is_match("packages/package/a/package.json"));
    }

    #[test]
    fn should_handle_complex_extglob_patterns() {
        let glob_set = build_glob_set(&["**/?(*.)+(spec|test).[jt]s?(x)?(.snap)"]).unwrap();
        // matches
        assert!(glob_set.is_match("packages/package-a/spec.jsx.snap"));
        assert!(glob_set.is_match("packages/package-a/spec.js.snap"));
        assert!(glob_set.is_match("packages/package-a/spec.jsx"));
        assert!(glob_set.is_match("packages/package-a/spec.js"));
        assert!(glob_set.is_match("packages/package-a/spec.tsx.snap"));
        assert!(glob_set.is_match("packages/package-a/spec.ts.snap"));
        assert!(glob_set.is_match("packages/package-a/spec.tsx"));
        assert!(glob_set.is_match("packages/package-a/spec.ts"));
        assert!(glob_set.is_match("packages/package-a/file.spec.jsx.snap"));
        assert!(glob_set.is_match("packages/package-a/file.spec.js.snap"));
        assert!(glob_set.is_match("packages/package-a/file.spec.jsx"));
        assert!(glob_set.is_match("packages/package-a/file.spec.js"));
        assert!(glob_set.is_match("packages/package-a/file.spec.tsx.snap"));
        assert!(glob_set.is_match("packages/package-a/file.spec.ts.snap"));
        assert!(glob_set.is_match("packages/package-a/file.spec.tsx"));
        assert!(glob_set.is_match("packages/package-a/file.spec.ts"));
        assert!(glob_set.is_match("spec.jsx.snap"));
        assert!(glob_set.is_match("spec.js.snap"));
        assert!(glob_set.is_match("spec.jsx"));
        assert!(glob_set.is_match("spec.js"));
        assert!(glob_set.is_match("spec.tsx.snap"));
        assert!(glob_set.is_match("spec.ts.snap"));
        assert!(glob_set.is_match("spec.tsx"));
        assert!(glob_set.is_match("spec.ts"));
        assert!(glob_set.is_match("file.spec.jsx.snap"));
        assert!(glob_set.is_match("file.spec.js.snap"));
        assert!(glob_set.is_match("file.spec.jsx"));
        assert!(glob_set.is_match("file.spec.js"));
        assert!(glob_set.is_match("file.spec.tsx.snap"));
        assert!(glob_set.is_match("file.spec.ts.snap"));
        assert!(glob_set.is_match("file.spec.tsx"));
        assert!(glob_set.is_match("file.spec.ts"));

        // no matches
        assert!(!glob_set.is_match("packages/package-a/spec.jsx.snapx"));
        assert!(!glob_set.is_match("packages/package-a/spec.js.snapx"));
        assert!(!glob_set.is_match("packages/package-a/file.ts"));

        let glob_set = build_glob_set(&["**/!(*.module).ts"]).unwrap();
        //matches
        assert!(glob_set.is_match("test.ts"));
        assert!(glob_set.is_match("nested/comp.test.ts"));
        //no matches
        assert!(!glob_set.is_match("test.module.ts"));

        let glob_set = build_glob_set(&["**/*.*(component,module).ts?(x)"]).unwrap();
        //matches
        assert!(glob_set.is_match("test.component.ts"));
        assert!(glob_set.is_match("test.module.ts"));
        assert!(glob_set.is_match("test.component.tsx"));
        assert!(glob_set.is_match("test.module.tsx"));
        assert!(glob_set.is_match("nested/comp.test.component.ts"));
        assert!(glob_set.is_match("nested/comp.test.module.ts"));
        assert!(glob_set.is_match("nested/comp.test.component.tsx"));
        assert!(glob_set.is_match("nested/comp.test.module.tsx"));
        //no matches
        assert!(!glob_set.is_match("test.ts"));
        assert!(!glob_set.is_match("test.component.spec.ts"));
        assert!(!glob_set.is_match("test.module.spec.ts"));
        assert!(!glob_set.is_match("test.component.spec.tsx"));
        assert!(!glob_set.is_match("test.module.spec.tsx"));
        assert!(!glob_set.is_match("nested/comp.test.component.spec.ts"));
    }

    #[test]
    fn supports_brace_expansion() {
        let glob_set = build_glob_set(&["{packages,apps}/*"]).unwrap();
        assert!(glob_set.is_match("packages/package-a"));
        assert!(glob_set.is_match("apps/app-a"));
        assert!(!glob_set.is_match("apps/app-a/nested"));

        let glob_set = build_glob_set(&["{package-lock.json,yarn.lock,pnpm-lock.yaml}"]).unwrap();
        assert!(glob_set.is_match("package-lock.json"));
        assert!(glob_set.is_match("yarn.lock"));
        assert!(glob_set.is_match("pnpm-lock.yaml"));

        let glob_set =
            build_glob_set(&["{packages/!(package-a)*/package.json,packages/*/package.json}"])
                .unwrap();
        assert!(glob_set.is_match("packages/package-b/package.json"));
        assert!(glob_set.is_match("packages/package-c/package.json"));
        assert!(!glob_set.is_match("packages/package-a/package.json"));
    }

    #[test]
    fn supports_multiple_brace_groups() {
        // The vite/vitest generators write this include; for a workspace-root
        // project it reaches the native glob unprefixed, so it starts with `{`,
        // ends with `}`, and spans three groups.
        let glob_set =
            build_glob_set(&["{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"])
                .unwrap();
        assert!(glob_set.is_match("src/a.spec.ts"));
        assert!(glob_set.is_match("tests/b.test.tsx"));
        assert!(glob_set.is_match("src/deep/c.spec.mts"));
        assert!(!glob_set.is_match("src/helper.ts"));
        assert!(!glob_set.is_match("lib/a.spec.ts"));
    }

    #[test]
    fn potential_glob_split_only_splits_a_single_enclosing_group() {
        let split = |glob| potential_glob_split(glob).collect::<Vec<_>>();
        // A single top-level group is split so each branch converts on its own.
        assert_eq!(split("{a,b,c}"), vec!["a", "b", "c"]);
        // Multiple groups spanning the string are left whole for globset.
        assert_eq!(
            split("{src,tests}/**/*.{test,spec}.{js,ts}"),
            vec!["{src,tests}/**/*.{test,spec}.{js,ts}"]
        );
        // A comma nested inside a group is not a split point.
        assert_eq!(split("{a,@(b|c).{d,e}}"), vec!["a", "@(b|c).{d,e}"]);
        // Not a single enclosing group -> unchanged.
        assert_eq!(split("{a,b}/*"), vec!["{a,b}/*"]);
        assert_eq!(split("src/**/*.ts"), vec!["src/**/*.ts"]);
    }

    #[test]
    fn should_handle_invalid_group_globs() {
        let glob_set = build_glob_set(&[
            "libs/**/*",
            "!libs/**/?(*.)+spec.ts?(.snap)",
            "!libs/tsconfig.spec.json",
            "!libs/jest.config.ts",
            "!libs/.eslintrc.json",
            "!libs/**/test-setup.ts",
        ])
        .unwrap();

        assert!(glob_set.is_match("libs/src/index.ts"));
        assert!(!glob_set.is_match("libs/src/index.spec.ts"));
    }
}
