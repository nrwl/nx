use std::path::Path;
use std::sync::Arc;

use anyhow::Context;

use crate::native::glob::{NxGlobSet, build_glob_set};

/// The globs that decide which files a plugin's `createNodes` receives.
#[napi(object)]
#[derive(Debug, Clone, Default)]
pub struct PluginGlobs {
    /// The plugin's `createNodes` pattern. Omitted, every file passes it.
    pub pattern: Option<String>,
    pub include: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    /// Names the plugin in pattern errors.
    pub name: Option<String>,
    /// The plugin's position in `nx.json` `plugins`, for pattern errors.
    pub index: Option<u32>,
}

/// An `include` or `exclude` list. Patterns apply in order and the last one
/// that matches decides, so a `!` pattern can re-include what an earlier one
/// excluded. A list that starts with `!` starts from "matches everything".
struct OrderedGlobs {
    entries: Vec<(bool, Arc<NxGlobSet>)>,
    initial: bool,
    has_negation: bool,
}

impl OrderedGlobs {
    fn new(patterns: &[String]) -> anyhow::Result<Self> {
        let entries = patterns
            .iter()
            .map(|pattern| {
                let negated = pattern.starts_with('!');
                let glob = if negated { &pattern[1..] } else { pattern };
                build_glob_set(&[glob])
                    .with_context(|| format!("invalid pattern {pattern:?}"))
                    .map(|set| (negated, set))
            })
            .collect::<anyhow::Result<Vec<_>>>()?;
        let has_negation = entries.iter().any(|(negated, _)| *negated);
        let initial = entries.first().is_some_and(|(negated, _)| *negated);
        Ok(Self {
            entries,
            initial,
            has_negation,
        })
    }

    fn is_match(&self, path: &Path, empty: bool) -> bool {
        if self.entries.is_empty() {
            return empty;
        }
        if !self.has_negation {
            return self.entries.iter().any(|(_, set)| set.is_match(path));
        }
        self.entries
            .iter()
            .fold(self.initial, |matched, (negated, set)| {
                if set.is_match(path) {
                    !negated
                } else {
                    matched
                }
            })
    }
}

pub struct PluginGlobMatcher {
    pattern: Option<Arc<NxGlobSet>>,
    include: OrderedGlobs,
    exclude: OrderedGlobs,
    prefix: Option<std::path::PathBuf>,
}

impl PluginGlobMatcher {
    pub fn new(globs: &PluginGlobs) -> anyhow::Result<Self> {
        Self::build(globs).with_context(|| match (&globs.name, globs.index) {
            (Some(name), Some(index)) => {
                format!("Plugin {name} (nx.json plugins[{index}]) has an invalid glob")
            }
            (Some(name), None) => format!("Plugin {name} has an invalid glob"),
            _ => "Invalid plugin glob".to_string(),
        })
    }

    fn build(globs: &PluginGlobs) -> anyhow::Result<Self> {
        let pattern = globs
            .pattern
            .as_deref()
            .map(|pattern| {
                build_glob_set(&[pattern])
                    .with_context(|| format!("invalid createNodes pattern {pattern:?}"))
            })
            .transpose()?;
        let include = globs.include.as_deref().unwrap_or_default();
        let exclude = globs.exclude.as_deref().unwrap_or_default();

        // Only a non-negated pattern can let a file through an include list
        // that does not start with `!`, so every match lies under their prefix.
        let include_prefix = match include.first() {
            Some(first) if !first.starts_with('!') => build_glob_set(include)?
                .literal_prefix()
                .map(Path::to_path_buf),
            _ => None,
        };
        let pattern_prefix = pattern
            .as_ref()
            .and_then(|set| set.literal_prefix())
            .map(Path::to_path_buf);
        let prefix = match (include_prefix, pattern_prefix) {
            (Some(include), Some(pattern)) if include.starts_with(&pattern) => Some(include),
            (Some(_), Some(pattern)) => Some(pattern),
            (include, pattern) => include.or(pattern),
        };

        Ok(Self {
            pattern,
            include: OrderedGlobs::new(include)?,
            exclude: OrderedGlobs::new(exclude)?,
            prefix,
        })
    }

    /// The directory every matching file lies under, when there is one.
    pub fn literal_prefix(&self) -> Option<&Path> {
        self.prefix.as_deref()
    }

    pub fn is_match(&self, path: impl AsRef<Path>) -> bool {
        let path = path.as_ref();
        self.pattern.as_ref().is_none_or(|set| set.is_match(path))
            && self.include.is_match(path, true)
            && !self.exclude.is_match(path, false)
    }
}

#[napi]
/// The `files` that pass a plugin's `createNodes` pattern, `include` and
/// `exclude`, in input order. Matches the way the project graph finds each
/// plugin's config files.
pub fn match_plugin_files(files: Vec<String>, globs: PluginGlobs) -> anyhow::Result<Vec<String>> {
    let matcher = PluginGlobMatcher::new(&globs)?;
    Ok(files
        .into_iter()
        .filter(|file| matcher.is_match(file))
        .collect())
}

#[cfg(test)]
mod test {
    use super::*;

    fn globs(pattern: Option<&str>, include: &[&str], exclude: &[&str]) -> PluginGlobs {
        let list = |l: &[&str]| Some(l.iter().map(|s| s.to_string()).collect());
        PluginGlobs {
            pattern: pattern.map(str::to_string),
            include: list(include),
            exclude: list(exclude),
            ..Default::default()
        }
    }

    fn matching(globs: &PluginGlobs, files: &[&str]) -> Vec<String> {
        match_plugin_files(files.iter().map(|s| s.to_string()).collect(), globs.clone()).unwrap()
    }

    #[test]
    fn empty_lists_include_everything_and_exclude_nothing() {
        let files = ["a/project.json", "b/project.json"];
        assert_eq!(matching(&globs(None, &[], &[]), &files), files);
    }

    #[test]
    fn requires_the_create_nodes_pattern() {
        let files = [
            "a/vite.config.ts",
            "a/project.json",
            ".hidden/vite.config.ts",
        ];
        assert_eq!(
            matching(&globs(Some("**/vite.config.{ts,js}"), &[], &[]), &files),
            ["a/vite.config.ts", ".hidden/vite.config.ts"]
        );
    }

    #[test]
    fn applies_include_and_exclude() {
        let files = ["apps/a/x.json", "libs/b/x.json", "apps/c-e2e/x.json"];
        assert_eq!(
            matching(&globs(None, &["apps/**/*"], &["**/*-e2e/**/*"]), &files),
            ["apps/a/x.json"]
        );
    }

    #[test]
    fn a_later_negation_re_includes_an_excluded_file() {
        let files = [
            "e2e/app-e2e/project.json",
            "e2e/toolkit-workspace-e2e/project.json",
            "libs/a/project.json",
        ];
        let exclude = ["**/*-e2e/**/*", "!**/toolkit-workspace-e2e/**/*"];
        assert_eq!(
            matching(&globs(None, &[], &exclude), &files),
            [
                "e2e/toolkit-workspace-e2e/project.json",
                "libs/a/project.json"
            ]
        );
    }

    #[test]
    fn a_leading_negation_starts_from_everything() {
        let files = ["apps/a/x.json", "apps/legacy/x.json", "libs/b/x.json"];
        assert_eq!(
            matching(&globs(None, &["!apps/legacy/**"], &[]), &files),
            ["apps/a/x.json", "libs/b/x.json"]
        );
        assert_eq!(
            matching(&globs(None, &[], &["!apps/**"]), &files),
            ["apps/a/x.json", "apps/legacy/x.json"]
        );
    }

    #[test]
    fn the_last_matching_pattern_decides() {
        let files = ["a/x.json", "a/keep/x.json", "a/keep/drop/x.json"];
        let include = ["a/**", "!a/keep/**", "a/keep/drop/**"];
        assert_eq!(
            matching(&globs(None, &include, &[]), &files),
            ["a/x.json", "a/keep/drop/x.json"]
        );
    }

    #[test]
    fn narrows_to_the_deepest_literal_prefix() {
        let scoped = PluginGlobMatcher::new(&globs(Some("**/*.ts"), &["apps/api/src/*"], &[]));
        assert_eq!(
            scoped.unwrap().literal_prefix(),
            Some(Path::new("apps/api/src"))
        );

        let nested = PluginGlobMatcher::new(&globs(Some("apps/**/*.ts"), &["apps/api/**"], &[]));
        assert_eq!(
            nested.unwrap().literal_prefix(),
            Some(Path::new("apps/api"))
        );

        let negated = PluginGlobMatcher::new(&globs(Some("**/*.ts"), &["!apps/legacy/**"], &[]));
        assert_eq!(negated.unwrap().literal_prefix(), None);
    }

    #[test]
    fn names_the_plugin_in_pattern_errors() {
        let mut bad = globs(None, &["apps/[a"], &[]);
        bad.name = Some("@nx/vite/plugin".into());
        bad.index = Some(3);
        let error = format!("{:#}", PluginGlobMatcher::new(&bad).err().unwrap());
        assert!(
            error.contains("@nx/vite/plugin (nx.json plugins[3])"),
            "{error}"
        );
        assert!(error.contains("apps/[a"), "{error}");
    }
}
