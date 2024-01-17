mod glob_group;
mod glob_parser;
mod glob_transform;

use crate::native::glob::glob_transform::convert_glob;
use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use std::fmt::Debug;
use std::path::Path;
use tracing::trace;

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

fn potential_glob_split(
    glob: &str,
) -> itertools::Either<std::str::Split<char>, std::iter::Once<&str>> {
    use itertools::Either::*;
    if glob.starts_with('{') && glob.ends_with('}') {
        Left(glob.trim_matches('{').trim_end_matches('}').split(','))
    } else {
        Right(std::iter::once(glob))
    }
}

pub(crate) fn build_glob_set<S: AsRef<str> + Debug>(globs: &[S]) -> anyhow::Result<NxGlobSet> {
    let result = globs
        .iter()
        .flat_map(|s| potential_glob_split(s.as_ref()))
        .map(|glob| {
            if glob.contains('!') || glob.contains('|') || glob.contains('(') || glob.contains("{,")
            {
                convert_glob(glob)
            } else {
                Ok(vec![glob.to_string()])
            }
        })
        .collect::<anyhow::Result<Vec<_>>>()?
        .concat();

    trace!(?globs, ?result, "converted globs");

    NxGlobSetBuilder::new(&result)?.build()
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
