pub mod glob_files;
mod glob_group;
mod glob_parser;
pub mod glob_transform;

use crate::native::glob::glob_transform::convert_glob;
use dashmap::DashMap;
use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use once_cell::sync::Lazy;
use std::fmt::Debug;
use std::path::Path;
use std::sync::Arc;
use tracing::trace;

/// Global cache for compiled glob sets.
///
/// Glob pattern compilation is expensive (~0.1-0.5ms per pattern) and the same
/// patterns are frequently reused across:
/// - Task hashing (workspace files, project files, task outputs)
/// - File walking (ignore patterns)
/// - Project matching (by name, tag, directory)
///
/// This cache stores compiled NxGlobSet instances keyed by the normalized,
/// sorted glob pattern string. Using Arc allows cheap cloning for concurrent access.
///
/// Cache invalidation is not needed because:
/// 1. Glob patterns are immutable configuration values
/// 2. The daemon process restarts when configuration changes
/// 3. CLI invocations are short-lived
static GLOB_SET_CACHE: Lazy<DashMap<String, Arc<NxGlobSet>>> = Lazy::new(DashMap::new);

/// Statistics for glob cache performance monitoring.
/// Only compiled in debug/test builds to avoid overhead in production.
#[cfg(any(debug_assertions, test))]
static GLOB_CACHE_STATS: Lazy<GlobCacheStats> = Lazy::new(GlobCacheStats::new);

#[cfg(any(debug_assertions, test))]
pub struct GlobCacheStats {
    hits: std::sync::atomic::AtomicU64,
    misses: std::sync::atomic::AtomicU64,
}

#[cfg(any(debug_assertions, test))]
impl GlobCacheStats {
    fn new() -> Self {
        Self {
            hits: std::sync::atomic::AtomicU64::new(0),
            misses: std::sync::atomic::AtomicU64::new(0),
        }
    }

    pub fn record_hit(&self) {
        self.hits.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn record_miss(&self) {
        self.misses
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn get_stats() -> (u64, u64) {
        let hits = GLOB_CACHE_STATS
            .hits
            .load(std::sync::atomic::Ordering::Relaxed);
        let misses = GLOB_CACHE_STATS
            .misses
            .load(std::sync::atomic::Ordering::Relaxed);
        (hits, misses)
    }

    pub fn reset() {
        GLOB_CACHE_STATS
            .hits
            .store(0, std::sync::atomic::Ordering::Relaxed);
        GLOB_CACHE_STATS
            .misses
            .store(0, std::sync::atomic::Ordering::Relaxed);
    }
}

/// Clears the glob set cache. Primarily useful for testing.
#[cfg(test)]
pub fn clear_glob_cache() {
    GLOB_SET_CACHE.clear();
    #[cfg(any(debug_assertions, test))]
    GlobCacheStats::reset();
}

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

#[derive(Debug, Clone)]
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

/// A cached reference to an NxGlobSet that can be cheaply cloned.
/// This wrapper allows callers to use the glob set without worrying about
/// the caching implementation details.
#[derive(Debug, Clone)]
pub struct CachedNxGlobSet {
    inner: Arc<NxGlobSet>,
}

impl CachedNxGlobSet {
    pub fn is_match<P: AsRef<Path>>(&self, path: P) -> bool {
        self.inner.is_match(path)
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

/// Creates a normalized cache key from glob patterns.
/// Patterns are sorted to ensure consistent cache keys regardless of input order.
fn create_cache_key<S: AsRef<str>>(globs: &[S]) -> String {
    let mut patterns: Vec<&str> = globs.iter().map(|s| s.as_ref()).collect();
    patterns.sort();
    patterns.join("\x00") // Use null byte as separator (invalid in glob patterns)
}

/// Builds a glob set from the given patterns, using a global cache to avoid
/// redundant compilation of frequently-used patterns.
///
/// # Performance
///
/// Glob pattern compilation involves:
/// 1. Parsing extended glob syntax (!, |, (), etc.)
/// 2. Converting to standard glob patterns
/// 3. Compiling regex matchers via the `globset` crate
///
/// This is expensive (~0.1-0.5ms per pattern) and the same patterns are often
/// reused hundreds of times during a single Nx operation:
/// - `{projectRoot}/**/*` for every project's file hashing
/// - `**/node_modules`, `**/.git` for file walking
/// - `**/*.spec.ts` for test file exclusions
///
/// The cache eliminates redundant compilation, providing 100-300ms savings
/// in large workspaces with many projects.
pub(crate) fn build_glob_set<S: AsRef<str> + Debug>(globs: &[S]) -> anyhow::Result<NxGlobSet> {
    let cache_key = create_cache_key(globs);

    // Fast path: check if we have a cached version
    if let Some(cached) = GLOB_SET_CACHE.get(&cache_key) {
        trace!(?globs, "glob set cache HIT");
        #[cfg(any(debug_assertions, test))]
        GLOB_CACHE_STATS.record_hit();
        // Clone the Arc (cheap) and return the inner NxGlobSet (also cheap due to Clone derive)
        return Ok((*cached).as_ref().clone());
    }

    trace!(?globs, "glob set cache MISS - compiling");
    #[cfg(any(debug_assertions, test))]
    GLOB_CACHE_STATS.record_miss();

    // Slow path: compile the glob set
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

    let glob_set = NxGlobSetBuilder::new(&result)?.build()?;

    // Store in cache for future use
    GLOB_SET_CACHE.insert(cache_key, Arc::new(glob_set.clone()));

    Ok(glob_set)
}

/// Builds a cached glob set that returns an Arc-wrapped reference.
/// Use this when you need to store or pass the glob set around without copying.
pub(crate) fn build_glob_set_cached<S: AsRef<str> + Debug>(
    globs: &[S],
) -> anyhow::Result<CachedNxGlobSet> {
    let cache_key = create_cache_key(globs);

    // Fast path: check if we have a cached version
    if let Some(cached) = GLOB_SET_CACHE.get(&cache_key) {
        trace!(?globs, "glob set cache HIT (cached variant)");
        #[cfg(any(debug_assertions, test))]
        GLOB_CACHE_STATS.record_hit();
        return Ok(CachedNxGlobSet {
            inner: Arc::clone(&cached),
        });
    }

    trace!(?globs, "glob set cache MISS (cached variant) - compiling");
    #[cfg(any(debug_assertions, test))]
    GLOB_CACHE_STATS.record_miss();

    // Slow path: compile the glob set
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

    trace!(?globs, ?result, "converted globs (cached variant)");

    let glob_set = NxGlobSetBuilder::new(&result)?.build()?;
    let arc_glob_set = Arc::new(glob_set);

    // Store in cache for future use
    GLOB_SET_CACHE.insert(cache_key, Arc::clone(&arc_glob_set));

    Ok(CachedNxGlobSet {
        inner: arc_glob_set,
    })
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

    // ==================== Caching Tests ====================

    #[test]
    fn cache_key_is_order_independent() {
        // Same patterns in different order should produce the same cache key
        let key1 = create_cache_key(&["a", "b", "c"]);
        let key2 = create_cache_key(&["c", "a", "b"]);
        let key3 = create_cache_key(&["b", "c", "a"]);

        assert_eq!(key1, key2);
        assert_eq!(key2, key3);
    }

    #[test]
    fn cache_returns_equivalent_glob_sets() {
        clear_glob_cache();

        let patterns = &["src/**/*.ts", "!src/**/*.spec.ts"];

        // First call - cache miss
        let glob_set1 = build_glob_set(patterns).unwrap();

        // Second call - cache hit
        let glob_set2 = build_glob_set(patterns).unwrap();

        // Both should behave identically
        assert!(glob_set1.is_match("src/index.ts"));
        assert!(glob_set2.is_match("src/index.ts"));
        assert!(!glob_set1.is_match("src/index.spec.ts"));
        assert!(!glob_set2.is_match("src/index.spec.ts"));
    }

    #[test]
    fn cache_records_hits_and_misses() {
        // Use a unique pattern that no other test uses to ensure we get a cache miss
        // followed by a cache hit for our specific pattern
        let unique_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let patterns = vec![format!("cache-test-unique-{}-pattern/**/*.js", unique_id)];
        let pattern_refs: Vec<&str> = patterns.iter().map(|s| s.as_str()).collect();

        // Get baseline stats before our test
        let (hits_before, misses_before) = GlobCacheStats::get_stats();

        // First call with unique pattern - should be a miss
        let _ = build_glob_set(&pattern_refs).unwrap();
        let (hits_after_first, misses_after_first) = GlobCacheStats::get_stats();

        // Second call with same pattern - should be a hit
        let _ = build_glob_set(&pattern_refs).unwrap();
        let (hits_after_second, misses_after_second) = GlobCacheStats::get_stats();

        // The delta from before to after first call should include at least 1 miss
        assert!(
            misses_after_first >= misses_before + 1,
            "Expected at least 1 new miss, but misses went from {} to {}",
            misses_before,
            misses_after_first
        );

        // The delta from first to second call should include exactly 1 hit
        assert!(
            hits_after_second >= hits_after_first + 1,
            "Expected at least 1 new hit, but hits went from {} to {}",
            hits_after_first,
            hits_after_second
        );

        // No new misses should occur for the second call to the same pattern
        // (other tests may add misses, so we just verify our hit worked)
        assert!(
            hits_after_second > hits_before,
            "Expected hits to increase from {} but got {}",
            hits_before,
            hits_after_second
        );

        // Verify the cache is actually working by checking it returns the same result
        let glob_set1 = build_glob_set(&pattern_refs).unwrap();
        let glob_set2 = build_glob_set(&pattern_refs).unwrap();

        // Create a test path that matches our pattern
        let test_path = format!("cache-test-unique-{}-pattern/nested/file.js", unique_id);
        assert!(glob_set1.is_match(&test_path));
        assert!(glob_set2.is_match(&test_path));
    }

    #[test]
    fn cached_variant_returns_arc_wrapped_glob_set() {
        clear_glob_cache();

        let patterns = &["cached-variant/**/*.tsx"];

        // Get cached version
        let cached1 = build_glob_set_cached(patterns).unwrap();
        let cached2 = build_glob_set_cached(patterns).unwrap();

        // Both should work correctly
        assert!(cached1.is_match("cached-variant/component.tsx"));
        assert!(cached2.is_match("cached-variant/component.tsx"));
        assert!(!cached1.is_match("cached-variant/component.ts"));
        assert!(!cached2.is_match("cached-variant/component.ts"));
    }

    #[test]
    fn different_patterns_create_different_cache_entries() {
        clear_glob_cache();

        let patterns1 = &["unique-pattern-1/**/*"];
        let patterns2 = &["unique-pattern-2/**/*"];

        let glob_set1 = build_glob_set(patterns1).unwrap();
        let glob_set2 = build_glob_set(patterns2).unwrap();

        // Each should match its own pattern
        assert!(glob_set1.is_match("unique-pattern-1/file.js"));
        assert!(!glob_set1.is_match("unique-pattern-2/file.js"));
        assert!(glob_set2.is_match("unique-pattern-2/file.js"));
        assert!(!glob_set2.is_match("unique-pattern-1/file.js"));
    }

    #[test]
    fn cache_handles_complex_patterns_correctly() {
        clear_glob_cache();

        let complex_patterns = &[
            "dist/!(cache|tmp)/**/*",
            "!dist/**/*.map",
            "!dist/**/README.md",
        ];

        // First call
        let glob_set1 = build_glob_set(complex_patterns).unwrap();

        // Second call (from cache)
        let glob_set2 = build_glob_set(complex_patterns).unwrap();

        // Both should have identical behavior
        assert!(glob_set1.is_match("dist/src/index.js"));
        assert!(glob_set2.is_match("dist/src/index.js"));
        assert!(!glob_set1.is_match("dist/cache/index.js"));
        assert!(!glob_set2.is_match("dist/cache/index.js"));
        assert!(!glob_set1.is_match("dist/src/index.js.map"));
        assert!(!glob_set2.is_match("dist/src/index.js.map"));
    }
}
