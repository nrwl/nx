use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use once_cell::sync::Lazy;
use regex::Regex;
use std::path::Path;

pub struct NxGlobSet {
    globs: Vec<NxGlob>,
}

impl NxGlobSet {
    pub fn new<S: AsRef<str>>(globs: &[S]) -> anyhow::Result<Self> {
        let mut glob_set = NxGlobSet { globs: Vec::new() };

        let mut globs: Vec<&str> = globs.iter().map(|s| s.as_ref()).collect();
        globs.sort();
        for glob in globs {
            glob_set.add(glob.as_ref())?;
        }
        Ok(glob_set)
    }

    pub fn add(&mut self, glob: &str) -> anyhow::Result<&mut NxGlobSet> {
        let glob = NxGlob::new(glob)?;
        self.globs.push(glob);
        Ok(self)
    }

    pub fn is_match<P: AsRef<Path>>(&self, path: P) -> bool {
        let has_negated = self.globs.iter().any(|glob| glob.negated);
        if has_negated {
            self.globs.iter().all(|glob| glob.is_match(path.as_ref()))
        } else {
            self.globs.iter().any(|glob| glob.is_match(path.as_ref()))
        }
    }
}

struct NxGlob {
    glob_set: GlobSet,
    negated: bool,
}

impl NxGlob {
    pub fn new<S: AsRef<str>>(raw_glob: S) -> anyhow::Result<Self> {
        let raw_glob = raw_glob.as_ref();
        let negated = raw_glob.starts_with('!');
        let glob_string = raw_glob.strip_prefix('!').unwrap_or(raw_glob).to_string();

        let glob_string = if glob_string.ends_with('/') {
            format!("{}**", glob_string)
        } else {
            glob_string
        };

        let glob = GlobBuilder::new(&glob_string)
            .literal_separator(true)
            .build()
            .map_err(anyhow::Error::from)?;

        let glob_set = GlobSetBuilder::new().add(glob).build()?;
        Ok(NxGlob { negated, glob_set })
    }

    fn glob_match<P: AsRef<Path>>(&self, path: P) -> NxGlobMatch {
        if self.glob_set.is_match(path) {
            return if self.negated {
                NxGlobMatch::NegatedMatch
            } else {
                NxGlobMatch::Match
            };
        }
        NxGlobMatch::NoMatch
    }

    pub fn is_match<P: AsRef<Path>>(&self, path: P) -> bool {
        match self.glob_match(path) {
            NxGlobMatch::Match => true,
            NxGlobMatch::NegatedMatch => false,
            NxGlobMatch::NoMatch => self.negated,
        }
    }
}

pub enum NxGlobMatch {
    Match,
    NoMatch,
    NegatedMatch,
}

pub(crate) fn build_glob_set<S: AsRef<str>>(globs: &[S]) -> anyhow::Result<NxGlobSet> {
    let globs = globs
        .iter()
        .map(|s| convert_glob(s.as_ref()))
        .collect::<anyhow::Result<Vec<_>>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();

    NxGlobSet::new(&globs)
}

// path/!(cache)/**
static NEGATIVE_DIRS_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"!\((.*)\)/").unwrap());
// path/**/!(README).md
static NEGATIVE_FILES_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"!\((.*)\)\.").unwrap());
// path/**/*.(js|ts)
static MULTI_PATTERNS_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\.\((.*)\)$").unwrap());

/// Converts a glob string to a list of globs
/// e.g. `path/!(cache)/**` -> `path/**`, `!path/cache/**`
fn convert_glob(glob: &str) -> anyhow::Result<Vec<String>> {
    let glob = MULTI_PATTERNS_REGEX.replace_all(glob, |caps: &regex::Captures| {
        format!(".{{{}}}", &caps[1].replace('|', ","))
    });

    let mut globs: Vec<String> = Vec::new();

    if let Some(dir_captures) = NEGATIVE_DIRS_REGEX.captures(&glob) {
        if let Some(dir_name_match) = dir_captures.get(1) {
            let negative_dirs = dir_name_match
                .as_str()
                .split('|')
                .map(|name| NEGATIVE_DIRS_REGEX.replace_all(&glob, format!("{}/", name)))
                .collect::<Vec<_>>();

            let dir_globs = negative_dirs
                .iter()
                .map(|dir| NEGATIVE_FILES_REGEX.replace_all(dir, "*."))
                .map(|dir| format!("!{}", dir))
                .collect::<Vec<String>>();

            globs.extend(dir_globs);
        }
    }

    let removed_negative_dirs = NEGATIVE_DIRS_REGEX.replace_all(&glob, "");

    if let Some(file_captures) = NEGATIVE_FILES_REGEX.captures(&removed_negative_dirs) {
        if let Some(file_name_match) = file_captures.get(1) {
            let file_globs = file_name_match
                .as_str()
                .split('|')
                .map(|name| {
                    NEGATIVE_FILES_REGEX.replace_all(&removed_negative_dirs, format!("{}.", name))
                })
                .map(|file_name| format!("!{}", file_name))
                .collect::<Vec<String>>();

            globs.extend(file_globs);
        }
    }

    let no_negatives = NEGATIVE_DIRS_REGEX.replace_all(&removed_negative_dirs, "");
    let glob_result = NEGATIVE_FILES_REGEX.replace_all(&no_negatives, "*.").into();

    globs.push(glob_result);

    Ok(globs)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn should_convert_globs() {
        let full_convert =
            convert_glob("dist/!(cache|cache2)/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            full_convert,
            [
                "!dist/cache/**/*.{js,ts}",
                "!dist/cache2/**/*.{js,ts}",
                "!dist/**/README.{js,ts}",
                "!dist/**/LICENSE.{js,ts}",
                "dist/**/*.{js,ts}",
            ]
        );

        let no_dirs = convert_glob("dist/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            no_dirs,
            [
                "!dist/**/README.{js,ts}",
                "!dist/**/LICENSE.{js,ts}",
                "dist/**/*.{js,ts}",
            ]
        );

        let no_files = convert_glob("dist/!(cache|cache2)/**/*.(js|ts)").unwrap();
        assert_eq!(
            no_files,
            [
                "!dist/cache/**/*.{js,ts}",
                "!dist/cache2/**/*.{js,ts}",
                "dist/**/*.{js,ts}",
            ]
        );

        let no_extensions = convert_glob("dist/!(cache|cache2)/**/*.js").unwrap();
        assert_eq!(
            no_extensions,
            [
                "!dist/cache/**/*.js",
                "!dist/cache2/**/*.js",
                "dist/**/*.js",
            ]
        );

        let no_patterns = convert_glob("dist/**/*.js").unwrap();
        assert_eq!(no_patterns, ["dist/**/*.js",]);
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
        let glob_set = build_glob_set(&["!ignore/"]).unwrap();
        assert!(glob_set.is_match("file.map"));
        assert!(glob_set.is_match("file.txt"));
        assert!(glob_set.is_match("file.js"));
        assert!(glob_set.is_match("file.ts"));
        assert!(!glob_set.is_match("ignore/file.map"));

        let glob_set = build_glob_set(&["!nested/ignore/", "nested/"]).unwrap();
        assert!(!glob_set.is_match("file.map"));
        assert!(!glob_set.is_match("nested/ignore/file.js"));
        assert!(!glob_set.is_match("another-nested/nested/file.ts"));
        assert!(glob_set.is_match("nested/file.js"));
        assert!(glob_set.is_match("nested/nested/file.ts"));

        let glob_set = build_glob_set(&["!*.{css,map}"]).unwrap();
        assert!(glob_set.is_match("file.js"));
        assert!(glob_set.is_match("nested/file.css"));
        assert!(!glob_set.is_match("file.css"));
        assert!(!glob_set.is_match("file.map"));

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
        assert!(glob_set.is_match("dist/file.txt"));
        // no matches
        assert!(!glob_set.is_match("dist/nested/README.txt"));
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
        assert!(glob_set.is_match("dist/file.js"));
        assert!(glob_set.is_match("dist/main.js"));
        // no matches
        assert!(!glob_set.is_match("dist/cache/"));
        assert!(!glob_set.is_match("dist/main/"));
    }
}
