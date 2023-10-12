use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use once_cell::sync::Lazy;
use regex::Regex;
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
        self.included_globs.is_match(path.as_ref()) && !self.excluded_globs.is_match(path.as_ref())
    }
}

pub(crate) fn build_glob_set<S: AsRef<str> + Debug>(globs: &[S]) -> anyhow::Result<NxGlobSet> {
    let result = globs
        .iter()
        .map(|s| convert_glob(s.as_ref()))
        .collect::<anyhow::Result<Vec<_>>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();

    trace!(?globs, ?result, "converted globs to result");

    NxGlobSetBuilder::new(&result)?.build()
}

// path/!{cache}/**
static NEGATIVE_DIR_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"!\{(.*?)}").unwrap());
// path/**/(subdir1|subdir2)/*.(js|ts)
static GROUP_PATTERNS_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\((.*?)\)").unwrap());
// path/{cache}*
static SINGLE_PATTERN_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\{(.*)}\*").unwrap());

/// Converts a glob string to a list of globs
/// e.g. `path/!(cache)/**` -> `path/**`, `!path/cache/**`
fn convert_glob(glob: &str) -> anyhow::Result<Vec<String>> {
    // If there are no negations or multiple patterns, return the glob as is
    if !glob.contains('!') && !glob.contains('|') && !glob.contains('(') {
        return Ok(vec![glob.to_string()]);
    }

    let glob = GROUP_PATTERNS_REGEX.replace_all(glob, |caps: &regex::Captures| {
        format!("{{{}}}", &caps[1].replace('|', ","))
    });

    let mut globs: Vec<String> = Vec::new();

    // push a glob directory glob that is either "path/*" or "path/**"
    globs.push(
        NEGATIVE_DIR_REGEX
            .replace_all(&glob, |caps: &regex::Captures| {
                let capture = caps.get(0);
                match capture {
                    Some(capture) => {
                        let char = glob.as_bytes()[capture.end() - 1] as char;
                        if char == '*' {
                            "".to_string()
                        } else {
                            "*".to_string()
                        }
                    }
                    None => "".to_string(),
                }
            })
            .into(),
    );

    let matches: Vec<_> = NEGATIVE_DIR_REGEX.find_iter(&glob).collect();

    // convert negative captures to globs (e.g. "path/!{cache,dir}/**" -> "!path/{cache,dir}/**")
    if matches.len() == 1 {
        globs.push(format!(
            "!{}",
            SINGLE_PATTERN_REGEX
                .replace(&glob, |caps: &regex::Captures| { format!("{}*", &caps[1]) })
                .replace('!', "")
        ));
    } else {
        // if there is more than one negative capture, convert each capture to a *, and negate the whole glob
        for matched in matches {
            let a = glob.replace(matched.as_str(), "*");
            globs.push(format!("!{}", a.replace('!', "")));
        }
    }

    Ok(globs)
}

#[cfg(test)]
mod test {
    use super::*;
    use std::assert_eq;

    #[test]
    fn convert_globs_full_convert() {
        let full_convert =
            convert_glob("dist/!(cache|cache2)/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            full_convert,
            [
                "dist/*/**/*.{js,ts}",
                "!dist/*/**/{README,LICENSE}.{js,ts}",
                "!dist/{cache,cache2}/**/*.{js,ts}",
            ]
        );
    }

    #[test]
    fn convert_globs_no_dirs() {
        let no_dirs = convert_glob("dist/**/!(README|LICENSE).(js|ts)").unwrap();
        assert_eq!(
            no_dirs,
            ["dist/**/*.{js,ts}", "!dist/**/{README,LICENSE}.{js,ts}"]
        );
    }

    #[test]
    fn convert_globs_no_files() {
        let no_files = convert_glob("dist/!(cache|cache2)/**/*.(js|ts)").unwrap();
        assert_eq!(
            no_files,
            ["dist/*/**/*.{js,ts}", "!dist/{cache,cache2}/**/*.{js,ts}"]
        );
    }

    #[test]
    fn convert_globs_no_extensions() {
        let no_extensions = convert_glob("dist/!(cache|cache2)/**/*.js").unwrap();
        assert_eq!(
            no_extensions,
            ["dist/*/**/*.js", "!dist/{cache,cache2}/**/*.js"]
        );
    }

    #[test]
    fn convert_globs_no_patterns() {
        let no_patterns = convert_glob("dist/**/*.js").unwrap();
        assert_eq!(no_patterns, ["dist/**/*.js",]);
    }

    #[test]
    fn convert_globs_single_negative() {
        let negative_single_dir = convert_glob("packages/!(package-a)*").unwrap();
        assert_eq!(negative_single_dir, ["packages/*", "!packages/package-a*"]);
    }

    #[test]
    fn should_work_with_simple_globs() {
        let glob_set = build_glob_set(&["**/*"]).unwrap();
        assert!(glob_set.is_match("packages/nx/package.json"))
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
    }
}
