use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, TryLockError};
use std::time::UNIX_EPOCH;

use anyhow::{Context, Result, bail};
use dashmap::DashMap;
use rayon::prelude::*;
use tracing::trace;
use walkdir::WalkDir;
use xxhash_rust::xxh3;

use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::hasher::hash_file_path;
use crate::native::walker::HARDCODED_IGNORE_PATTERNS;

/// Hashed in place of the content of a declared exact path that does not
/// exist: absence is an observation, so the key flips when the file appears.
const MISSING_FILE_HASH: &str = "missing";

/// Expansion per `files:{project}:[...]` instruction, scoped to one `hash_plans` call:
/// nothing watches gitignored directories, so a longer-lived memo goes stale.
pub(crate) type FilesExpansionCache = DashMap<String, Arc<FilesExpansion>>;

/// Content hashes keyed by absolute path, revalidated by (mtime, size).
/// Validated per lookup, so it outlives hashers and project graphs; the
/// daemon keeps one for its whole life through `shared_file_content_cache`.
pub(crate) struct FileContentCache {
    entries: DashMap<PathBuf, CachedFileContent>,
    limit: usize,
    /// The current run; every hit and insert stamps its entry with it.
    run: AtomicU64,
    /// Whether `begin_run` has ever been called: a run boundary exists, and
    /// inserts never evict.
    has_runs: AtomicBool,
    /// Size at which an insert evicts in a process that never hashes up
    /// front: twice the limit, or the limit past the last eviction's survivors.
    ceiling: AtomicUsize,
    evicting: Mutex<()>,
}

/// Content-hashed output names (`index-a1b2c3.js`) leave a dead key behind
/// per build, so the map grows with build count. Past this size, a run
/// starts by dropping the oldest runs' entries, never the newest run's, until
/// the map fits.
const FILE_CONTENT_CACHE_LIMIT: usize = 100_000;

impl FileContentCache {
    pub(crate) fn new() -> Self {
        Self::with_limit(FILE_CONTENT_CACHE_LIMIT)
    }

    fn with_limit(limit: usize) -> Self {
        Self {
            entries: DashMap::new(),
            limit,
            run: AtomicU64::new(1),
            has_runs: AtomicBool::new(false),
            ceiling: AtomicUsize::new(limit * 2),
            evicting: Mutex::new(()),
        }
    }

    /// Call once per run, from the up-front batch only. The smaller passes
    /// that hash deferred tasks belong to the same run, so their hits keep
    /// the run's entries young.
    pub(crate) fn begin_run(&self) {
        self.has_runs.store(true, Ordering::Relaxed);
        let Some(_guard) = self.eviction_guard() else {
            return;
        };
        self.run.fetch_add(1, Ordering::Relaxed);
        if self.entries.len() > self.limit {
            self.evict_oldest_runs();
        }
    }

    /// Drops the oldest runs first until the map fits the limit, and only as
    /// much of the last run it reaches as needed, so two commands whose sets
    /// each fit the limit, but not together, still share it. The newest run that
    /// touched the cache is never dropped, however large, so a run in
    /// between that read nothing costs it nothing.
    fn evict_oldest_runs(&self) {
        let mut by_run: BTreeMap<u64, usize> = BTreeMap::new();
        for entry in self.entries.iter() {
            *by_run
                .entry(entry.used_in.load(Ordering::Relaxed))
                .or_default() += 1;
        }
        let Some(&newest) = by_run.keys().next_back() else {
            return;
        };
        let mut remaining = self.entries.len();
        // Runs below `cutoff` go entirely; `partial` is (run, how many of it go).
        let mut cutoff = 0;
        let mut partial = None;
        for (&run, &count) in &by_run {
            if run == newest || remaining <= self.limit {
                break;
            }
            if remaining - count >= self.limit {
                remaining -= count;
                cutoff = run + 1;
            } else {
                partial = Some((run, remaining - self.limit));
                break;
            }
        }
        if cutoff == 0 && partial.is_none() {
            return;
        }
        let (partial_run, mut to_drop) = partial.unwrap_or((0, 0));
        self.entries.retain(|_, cached| {
            let run = cached.used_in.load(Ordering::Relaxed);
            if run < cutoff {
                return false;
            }
            if run == partial_run && to_drop > 0 {
                to_drop -= 1;
                return false;
            }
            true
        });
    }

    /// A poisoned lock still guards; only a busy one means another thread is
    /// evicting right now.
    fn eviction_guard(&self) -> Option<MutexGuard<'_, ()>> {
        match self.evicting.try_lock() {
            Ok(guard) => Some(guard),
            Err(TryLockError::Poisoned(poisoned)) => Some(poisoned.into_inner()),
            Err(TryLockError::WouldBlock) => None,
        }
    }

    fn get(&self, path: &Path, (mtime, size): FileStamp) -> Option<String> {
        let cached = self.entries.get(path)?;
        if cached.mtime != mtime || cached.size != size {
            return None;
        }
        cached
            .used_in
            .store(self.run.load(Ordering::Relaxed), Ordering::Relaxed);
        Some(cached.hash.clone())
    }

    fn insert(&self, path: PathBuf, content: CachedFileContent) {
        // Without a run boundary, inserts evict instead, and each eviction is
        // the boundary. With one, an eviction here could drop what this run
        // already used.
        if !self.has_runs.load(Ordering::Relaxed)
            && self.entries.len() >= self.ceiling.load(Ordering::Relaxed)
        {
            self.evict_without_run();
        }
        content
            .used_in
            .store(self.run.load(Ordering::Relaxed), Ordering::Relaxed);
        self.entries.insert(path, content);
    }

    fn evict_without_run(&self) {
        let Some(_guard) = self.eviction_guard() else {
            return;
        };
        // Re-read under the lock: a thread that saw the same size as the
        // evictor must not evict a second time.
        if self.entries.len() < self.ceiling.load(Ordering::Relaxed) {
            return;
        }
        self.run.fetch_add(1, Ordering::Relaxed);
        self.evict_oldest_runs();
        let next = (self.entries.len() + self.limit).max(self.limit * 2);
        self.ceiling.store(next, Ordering::Relaxed);
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries.len()
    }
}

/// The process-wide cache. Absolute keys keep separate workspaces apart when
/// one process hashes several (tests do).
pub(crate) fn shared_file_content_cache() -> &'static FileContentCache {
    static CACHE: std::sync::OnceLock<FileContentCache> = std::sync::OnceLock::new();
    CACHE.get_or_init(FileContentCache::new)
}

/// Revalidated by (mtime, size) only: on a filesystem with coarse mtime a
/// same-size rewrite inside one tick is a stale hit (the racy-index problem).
pub(crate) struct CachedFileContent {
    mtime: u128,
    size: u64,
    hash: String,
    /// The run that last hit or inserted this entry; eviction goes by it.
    used_in: AtomicU64,
}

impl CachedFileContent {
    fn new((mtime, size): FileStamp, hash: String) -> Self {
        Self {
            mtime,
            size,
            hash,
            used_in: AtomicU64::new(0),
        }
    }
}

/// The `(mtime, size)` a file showed when expansion looked at it.
pub type FileStamp = (u128, u64);

pub struct FilesExpansion {
    /// Existing files matched by the group, sorted, workspace-relative.
    pub files: Vec<String>,
    /// Aligned with `files`: the stamp read while expanding, so hashing does
    /// not stat again, or `None` when the workspace context vouched for the
    /// file and the disk was never consulted.
    pub stamps: Vec<Option<FileStamp>>,
    /// Declared exact paths that do not exist on disk.
    pub missing: Vec<String>,
}

fn stamp_of(metadata: &std::fs::Metadata) -> FileStamp {
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    (mtime, metadata.len())
}

/// Expands brace groups whose alternatives are all literal names into the
/// exact paths they stand for (`{nx,tsconfig.base}.json` → `nx.json`,
/// `tsconfig.base.json`; several groups multiply out). A group with a wildcard
/// or a nested brace is left as-is. A group of literals at the workspace root
/// names exact files, not a walk.
pub(crate) fn expand_literal_braces(glob: &str) -> Vec<String> {
    let negated = glob.starts_with('!');
    let body = glob.strip_prefix('!').unwrap_or(glob);
    let Some(open) = body.find('{') else {
        return vec![glob.to_string()];
    };
    let Some(close) = body[open..].find('}').map(|i| open + i) else {
        return vec![glob.to_string()];
    };
    let alternatives: Vec<&str> = body[open + 1..close].split(',').collect();
    let literal = alternatives.len() > 1
        && alternatives
            .iter()
            .all(|a| !a.is_empty() && !a.contains(['*', '?', '[', ']', '{', '}', '/', '\\']));
    if !literal {
        return vec![glob.to_string()];
    }
    let prefix = if negated { "!" } else { "" };
    alternatives
        .iter()
        .flat_map(|alternative| {
            let expanded = format!("{}{}{}", &body[..open], alternative, &body[close + 1..]);
            expand_literal_braces(&expanded)
        })
        .map(|expanded| {
            let expanded = expanded.strip_prefix('!').unwrap_or(&expanded).to_string();
            format!("{prefix}{expanded}")
        })
        .collect()
}

/// The literal directory a glob is walked from, and whether a pattern follows
/// it. `partition_glob` is not used: it treats `@`, `+`, `(`, `)` and `,` as
/// glob syntax and strips them, but in a path they are ordinary characters
/// (`node_modules/@scope/pkg`, `app/(marketing)`). The prefix is only ever
/// compared as text; just the remainder reaches the glob parser.
pub(crate) fn literal_prefix(glob: &str) -> Result<(String, bool)> {
    literal_prefix_with(glob, false)
}

fn literal_prefix_with(glob: &str, brackets_literal: bool) -> Result<(String, bool)> {
    if Path::new(glob).is_absolute() || glob.starts_with('/') {
        bail!(
            "The includeIgnored fileset \"{glob}\" is an absolute path; globs are workspace-relative."
        );
    }
    let mut literal: Vec<&str> = Vec::new();
    let mut has_pattern = false;
    for segment in glob.split('/') {
        if segment == ".." {
            bail!("The includeIgnored fileset \"{glob}\" points outside the workspace.");
        }
        if segment == "." {
            bail!(
                "The includeIgnored fileset \"{glob}\" has a `.` segment; write it relative to the workspace root without `./`."
            );
        }
        // Only a whole `[name]` segment can be a path; `page.[jt]sx` is a class.
        let literal_brackets = brackets_literal && is_bracket_segment(segment);
        if segment.contains(['*', '?', '{']) || (segment.contains('[') && !literal_brackets) {
            has_pattern = true;
            break;
        }
        literal.push(segment);
    }
    let root = literal.join("/").trim_end_matches('/').to_string();
    Ok((root, has_pattern))
}

/// A whole segment in brackets: `[id]`, `[...slug]`, `[[...slug]]`.
fn is_bracket_segment(segment: &str) -> bool {
    segment.starts_with('[') && segment.ends_with(']')
}

/// `literal_prefix`, except that whole `[name]` segments are read as paths
/// (Next.js route directories) when the first of them names something that
/// exists, and as character classes otherwise. One decision covers them all,
/// so `app/[lang]/[id]/x.tsx` with `[lang]/` on disk stays an exact path
/// before `[id]/` exists, instead of `[id]` becoming a class over `[lang]/`'s
/// other subdirectories.
fn split_glob(
    glob: &str,
    workspace_root: &Path,
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Result<(String, bool)> {
    if glob.contains('[') {
        let (root, has_pattern) = literal_prefix_with(glob, true)?;
        if !root.is_empty() && first_bracket_segment_exists(&root, workspace_root, known) {
            return Ok((root, has_pattern));
        }
    }
    literal_prefix(glob)
}

/// Checks the prefix up to and including the first `[name]` segment of
/// `root`, or `root` itself when the context tracks it.
fn first_bracket_segment_exists(
    root: &str,
    workspace_root: &Path,
    known: &(dyn Fn(&str) -> bool + Sync),
) -> bool {
    // A file the context tracks exists, and so does every directory above it.
    if known(root) {
        return true;
    }
    let mut end = 0;
    for segment in root.split('/') {
        end += segment.len();
        if segment.contains('[') {
            let up_to_segment = &root[..end];
            return known(up_to_segment) || workspace_root.join(up_to_segment).exists();
        }
        end += 1;
    }
    true
}

/// Collapses repeated and trailing slashes so `dist//gen/` and `dist/gen`
/// name the same directory, and so prefix arithmetic below lines up.
pub(crate) fn normalize_glob(glob: &str) -> String {
    let (prefix, body) = match glob.strip_prefix('!') {
        Some(body) => ("!", body),
        None => ("", glob),
    };
    let mut out = String::with_capacity(glob.len());
    out.push_str(prefix);
    let mut previous_slash = false;
    for c in body.chars() {
        if c == '/' {
            if previous_slash {
                continue;
            }
            previous_slash = true;
        } else {
            previous_slash = false;
        }
        out.push(c);
    }
    if out.len() > prefix.len() && out.ends_with('/') {
        out.pop();
    }
    out
}

/// Rejects globs that would read outside the workspace or exclude nothing.
/// A glob with no leading directory (`**/*`, `*.gen`) is allowed: it walks
/// from the workspace root, which is slow but not wrong.
pub(crate) fn validate_files_globs(globs: &[String]) -> Result<()> {
    for glob in globs {
        if let Some(body) = glob.strip_prefix('!') {
            let body = normalize_glob(body);
            if body.is_empty() {
                bail!("The includeIgnored fileset \"{glob}\" names nothing to exclude.");
            }
            for expanded in expand_literal_braces(&body) {
                literal_prefix_with(&expanded, true)?;
            }
            continue;
        }
        for expanded in expand_literal_braces(&normalize_glob(glob)) {
            literal_prefix_with(&expanded, true)?;
        }
    }
    Ok(())
}

/// A `!` entry split at its literal prefix. The prefix is compared as text;
/// only the remainder is a glob. Without a remainder it names an exact file,
/// or a directory whose whole contents are excluded.
struct Negation {
    root: String,
    remainder: Option<Arc<NxGlobSet>>,
}

impl Negation {
    fn parse(
        glob: &str,
        workspace_root: &Path,
        known: &(dyn Fn(&str) -> bool + Sync),
    ) -> Result<Self> {
        let normalized = normalize_glob(glob);
        let body = normalized.strip_prefix('!').unwrap_or(&normalized);
        let (root, has_pattern) = split_glob(body, workspace_root, known)?;
        if root.is_empty() && !has_pattern {
            bail!("The includeIgnored fileset \"{glob}\" names nothing to exclude.");
        }
        let remainder = if has_pattern {
            let rest = if root.is_empty() {
                body
            } else {
                &body[root.len() + 1..]
            };
            Some(build_glob_set(&[rest])?)
        } else {
            None
        };
        Ok(Self { root, remainder })
    }

    fn excludes(&self, path: &str) -> bool {
        let rest = if self.root.is_empty() {
            Some(path)
        } else {
            path.strip_prefix(self.root.as_str()).and_then(|rest| {
                if rest.is_empty() {
                    Some(rest)
                } else {
                    rest.strip_prefix('/')
                }
            })
        };
        match (&self.remainder, rest) {
            (_, None) => false,
            (None, Some(_)) => true,
            (Some(set), Some(rest)) => set.is_match(rest),
        }
    }
}

/// Files under `start`, workspace-relative, with the stamp read on the way
/// for anything the context does not vouch for. Top-level subdirectories walk
/// in parallel. `start` itself is never skipped; its descendants are subject
/// to the hardcoded ignores, so `node_modules/foo/**` works.
fn walk_files(
    start: &Path,
    workspace_root: &Path,
    canonical_root: &Path,
    skip: &NxGlobSet,
    accept: &(dyn Fn(&str) -> bool + Sync),
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Vec<(String, Option<FileStamp>)> {
    let Ok(entries) = std::fs::read_dir(start) else {
        return Vec::new();
    };
    let mut leaves = Vec::new();
    let mut dirs = Vec::new();
    for entry in entries.flatten() {
        match entry.file_type() {
            Ok(file_type) if file_type.is_dir() => dirs.push(entry.path()),
            Ok(file_type) => leaves.push((entry.path(), file_type)),
            Err(_) => {}
        }
    }
    let visit = |path: &Path,
                 file_type: std::fs::FileType|
     -> Option<(String, Option<FileStamp>)> {
        let relative = path
            .strip_prefix(workspace_root)
            .ok()?
            .to_string_lossy()
            .replace('\\', "/");
        if !accept(&relative) {
            return None;
        }
        if file_type.is_symlink() {
            // A link pointing out of the workspace is not workspace content.
            if !dunce::canonicalize(path).is_ok_and(|target| target.starts_with(canonical_root)) {
                return None;
            }
        } else if !file_type.is_file() {
            return None;
        }
        if known(&relative) {
            return Some((relative, None));
        }
        let metadata = std::fs::metadata(path).ok()?;
        if !metadata.is_file() {
            return None;
        }
        Some((relative, Some(stamp_of(&metadata))))
    };
    let mut found: Vec<(String, Option<FileStamp>)> = leaves
        .iter()
        .filter_map(|(path, file_type)| visit(path, *file_type))
        .collect();
    let nested: Vec<Vec<(String, Option<FileStamp>)>> = dirs
        .par_iter()
        .map(|dir| {
            if skip.is_match(dir) {
                return Vec::new();
            }
            WalkDir::new(dir)
                .follow_links(false)
                .into_iter()
                .filter_entry(|entry| !skip.is_match(entry.path()))
                .flatten()
                .filter_map(|entry| visit(entry.path(), entry.file_type()))
                .collect()
        })
        .collect();
    for group in nested {
        found.extend(group);
    }
    found
}

/// Expands an `includeIgnored` fileset group. `known` says whether the
/// workspace context tracks a path: an exact path it knows is a member
/// without touching the disk, and a walked file it knows needs no stamp.
/// Every positive glob is resolved from its literal prefix, then the
/// negations filter the result. Walks skip the same directories the workspace
/// walker never enters, but an exact path or a prefix inside one of them is
/// read as-is.
pub fn expand_files_with(
    workspace_root: &Path,
    globs: &[String],
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Result<FilesExpansion> {
    let skip = build_glob_set(HARDCODED_IGNORE_PATTERNS)?;
    let canonical_root = dunce::canonicalize(workspace_root).with_context(|| {
        format!(
            "Cannot resolve the workspace root {}",
            workspace_root.display()
        )
    })?;
    let negations: Vec<Negation> = globs
        .iter()
        .filter(|g| g.starts_with('!'))
        .flat_map(|g| expand_literal_braces(g))
        .map(|g| Negation::parse(&g, workspace_root, known))
        .collect::<Result<_>>()?;
    let positives: Vec<String> = globs
        .iter()
        .filter(|g| !g.starts_with('!'))
        .flat_map(|g| expand_literal_braces(&normalize_glob(g)))
        .collect();

    let mut found: Vec<(String, Option<FileStamp>)> = Vec::new();
    let mut missing: Vec<String> = Vec::new();
    for glob in &positives {
        let (root, has_pattern) = split_glob(glob, workspace_root, known)?;
        if !has_pattern && known(&root) {
            found.push((root, None));
            continue;
        }
        let start = workspace_root.join(&root);
        let Ok(metadata) = std::fs::metadata(&start) else {
            if !has_pattern {
                missing.push(root);
            }
            continue;
        };
        // Confine the prefix to the workspace after symlink resolution, not
        // just lexically.
        let resolved = dunce::canonicalize(&start)
            .with_context(|| format!("Cannot resolve the includeIgnored fileset \"{glob}\""))?;
        if !resolved.starts_with(&canonical_root) {
            bail!("The includeIgnored fileset \"{glob}\" resolves outside the workspace.");
        }
        if metadata.is_file() {
            if !has_pattern {
                found.push((root, Some(stamp_of(&metadata))));
            }
            continue;
        }
        // A directory declared by its exact path means everything under it;
        // with a pattern, only the remainder after the prefix is matched.
        // Excluded files are dropped before they are stat'ed.
        let excluded = |path: &str| negations.iter().any(|n| n.excludes(path));
        let accept: Box<dyn Fn(&str) -> bool + Sync> = if has_pattern {
            // An empty root is the workspace root: the whole glob is the pattern.
            let prefix_len = if root.is_empty() { 0 } else { root.len() + 1 };
            let set = build_glob_set(&[&glob[prefix_len..]])?;
            Box::new(move |path: &str| {
                path.len() > prefix_len && set.is_match(&path[prefix_len..]) && !excluded(path)
            })
        } else {
            Box::new(move |path: &str| !excluded(path))
        };
        found.extend(walk_files(
            &start,
            workspace_root,
            &canonical_root,
            &skip,
            &*accept,
            known,
        ));
    }

    found.retain(|(path, _)| !negations.iter().any(|n| n.excludes(path)));
    missing.retain(|path| !negations.iter().any(|n| n.excludes(path)));
    found.sort_unstable_by(|a, b| a.0.cmp(&b.0));
    found.dedup_by(|a, b| a.0 == b.0);
    missing.sort_unstable();
    missing.dedup();
    let (files, stamps) = found.into_iter().unzip();
    Ok(FilesExpansion {
        files,
        stamps,
        missing,
    })
}

/// `expand_files_with` without a workspace context: every path is checked on
/// disk.
pub fn expand_files(workspace_root: &Path, globs: &[String]) -> Result<FilesExpansion> {
    expand_files_with(workspace_root, globs, &|_| false)
}

pub(crate) fn expand_files_cached(
    workspace_root: &Path,
    key: &str,
    globs: &[String],
    cache: &FilesExpansionCache,
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Result<Arc<FilesExpansion>> {
    if let Some(cached) = cache.get(key) {
        return Ok(Arc::clone(&cached));
    }
    let expansion = Arc::new(expand_files_with(workspace_root, globs, known)?);
    cache.insert(key.to_string(), Arc::clone(&expansion));
    Ok(expansion)
}

/// Folds `(path, content hash)` pairs in path order, like a fileset. `known`
/// answers from the workspace file map so tracked files never touch the disk.
pub(crate) fn hash_files(
    workspace_root: &Path,
    expansion: &FilesExpansion,
    known: impl Fn(&str) -> Option<String> + Sync,
    cache: &FileContentCache,
) -> String {
    let hashes: Vec<String> = expansion
        .files
        .par_iter()
        .zip(expansion.stamps.par_iter())
        .map(|(file, stamp)| {
            known(file).unwrap_or_else(|| hash_file_cached(workspace_root, file, *stamp, cache))
        })
        .collect();

    let mut hasher = xxh3::Xxh3::new();
    for (file, hash) in expansion.files.iter().zip(&hashes) {
        hasher.update(file.as_bytes());
        hasher.update(hash.as_bytes());
    }
    for file in &expansion.missing {
        hasher.update(file.as_bytes());
        hasher.update(MISSING_FILE_HASH.as_bytes());
    }
    hasher.digest().to_string()
}

fn hash_file_cached(
    workspace_root: &Path,
    file: &str,
    stamp: Option<FileStamp>,
    cache: &FileContentCache,
) -> String {
    let path = workspace_root.join(file);
    let stamp = stamp.or_else(|| std::fs::metadata(&path).ok().map(|m| stamp_of(&m)));
    if let Some(hash) = stamp.and_then(|stamp| cache.get(&path, stamp)) {
        trace!("files content cache HIT for {file}");
        return hash;
    }
    let hash = hash_file_path(&path).unwrap_or_else(|| MISSING_FILE_HASH.to_string());
    if let Some(stamp) = stamp {
        cache.insert(path, CachedFileContent::new(stamp, hash.clone()));
    }
    hash
}

/// Index of the workspace file map by path, built once per hasher on first use.
pub(crate) fn index_file_map(files: &[crate::native::types::FileData]) -> HashMap<String, u32> {
    files
        .iter()
        .enumerate()
        .map(|(i, f)| (f.file.clone(), i as u32))
        .collect()
}

#[napi]
/// The files an `includeIgnored` fileset group matches on disk, sorted, then
/// the declared exact paths that are missing (they still take part in the hash).
pub fn expand_files_input(workspace_root: String, globs: Vec<String>) -> Result<Vec<String>> {
    let expansion = expand_files(Path::new(&workspace_root), &globs)?;
    Ok(expansion
        .files
        .into_iter()
        .chain(expansion.missing)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn workspace() -> TempDir {
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

    fn globs(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
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
        validate_files_globs(&group).unwrap();
        let expansion = expand_files(temp.path(), &group).unwrap();
        assert_eq!(expansion.files, vec!["nx.json", "tsconfig.base.json"]);
        assert_eq!(expansion.missing, vec!["missing.json"]);
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
        assert!(expansion.missing.is_empty());
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
    fn exact_directory_means_everything_under_it() {
        let temp = workspace();
        let expansion = expand_files(temp.path(), &globs(&["dist/other"])).unwrap();
        assert_eq!(expansion.files, vec!["dist/other/c.js"]);
    }

    #[test]
    fn missing_exact_path_is_recorded_and_changes_the_hash_when_it_appears() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let input = globs(&["dist/gen/generated.d.ts"]);

        let before = expand_files(temp.path(), &input).unwrap();
        assert!(before.files.is_empty());
        assert_eq!(before.missing, vec!["dist/gen/generated.d.ts"]);
        let hash_before = hash_files(temp.path(), &before, |_| None, &cache);

        temp.child("dist/gen/generated.d.ts")
            .write_str("x")
            .unwrap();
        let after = expand_files(temp.path(), &input).unwrap();
        assert_eq!(after.files, vec!["dist/gen/generated.d.ts"]);
        let hash_after = hash_files(temp.path(), &after, |_| None, &cache);

        assert_ne!(hash_before, hash_after);
    }

    #[test]
    fn content_cache_revalidates_by_mtime_and_size() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let group = globs(&["dist/gen/a.js"]);
        let expand = || expand_files(temp.path(), &group).unwrap();

        let first = hash_files(temp.path(), &expand(), |_| None, &cache);
        assert_eq!(cache.len(), 1);

        // Same size, forced newer mtime: must re-read, not trust the cache.
        std::thread::sleep(std::time::Duration::from_millis(20));
        temp.child("dist/gen/a.js").write_str("z").unwrap();
        let file = temp.path().join("dist/gen/a.js");
        let now = std::fs::File::open(&file).unwrap();
        now.set_modified(std::time::SystemTime::now()).unwrap();
        let second = hash_files(temp.path(), &expand(), |_| None, &cache);
        assert_ne!(first, second);

        // Same size with the cached mtime restored: the documented stale hit,
        // which also proves the second call went through the cache.
        let cached_at = std::fs::metadata(&file).unwrap().modified().unwrap();
        temp.child("dist/gen/a.js").write_str("q").unwrap();
        std::fs::File::open(&file)
            .unwrap()
            .set_modified(cached_at)
            .unwrap();
        let third = hash_files(temp.path(), &expand(), |_| None, &cache);
        assert_eq!(second, third);
    }

    #[test]
    fn file_map_hash_wins_over_disk() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();

        let from_disk = hash_files(temp.path(), &expansion, |_| None, &cache);
        let from_map = hash_files(
            temp.path(),
            &expansion,
            |path| (path == "dist/gen/a.js").then(|| "known".to_string()),
            &cache,
        );
        assert_ne!(from_disk, from_map);
    }

    #[test]
    fn keeps_parens_and_brackets_literal_after_the_walk() {
        let temp = workspace();
        temp.child("apps/web/app/(marketing)/page.tsx")
            .write_str("m")
            .unwrap();
        temp.child("apps/web/app/(marketing)/gen/x.json")
            .write_str("{}")
            .unwrap();
        temp.child("apps/web/app/[id]/page.tsx")
            .write_str("i")
            .unwrap();
        temp.child("apps/web/app/plain/page.tsx")
            .write_str("p")
            .unwrap();
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();

        assert_eq!(
            expand(&["apps/web/app/(marketing)/page.tsx"]).files,
            vec!["apps/web/app/(marketing)/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/(marketing)"]).files,
            vec![
                "apps/web/app/(marketing)/gen/x.json",
                "apps/web/app/(marketing)/page.tsx"
            ]
        );
        assert_eq!(
            expand(&["apps/web/app/(marketing)/**/*.json"]).files,
            vec!["apps/web/app/(marketing)/gen/x.json"]
        );
        assert_eq!(
            expand(&["apps/web/app/[id]/page.tsx"]).files,
            vec!["apps/web/app/[id]/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/[id]/*.tsx"]).files,
            vec!["apps/web/app/[id]/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/(absent)/x.json"]).missing,
            vec!["apps/web/app/(absent)/x.json"]
        );
        // A negation's literal prefix is compared as text too.
        assert_eq!(
            expand(&["apps/web/app/**/*.tsx", "!apps/web/app/(marketing)/**"]).files,
            vec!["apps/web/app/[id]/page.tsx", "apps/web/app/plain/page.tsx"]
        );
        assert_eq!(
            expand(&["apps/web/app/**/*.tsx", "!apps/web/app/[id]/page.tsx"]).files,
            vec![
                "apps/web/app/(marketing)/page.tsx",
                "apps/web/app/plain/page.tsx"
            ]
        );
        // Without such a directory, `[ab]` is still a character class.
        temp.child("dist/gen/a.js").write_str("a").unwrap();
        assert_eq!(expand(&["dist/gen/[ab].js"]).files, vec!["dist/gen/a.js"]);
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
        assert_eq!(expansion.missing, vec!["libs/x/absent.ts"]);
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
        let cache = FileContentCache::new();
        let hashed = hash_files(
            temp.path(),
            &expansion,
            |path| (path == "dist/gen/a.js").then(|| "known".to_string()),
            &cache,
        );
        assert!(!hashed.is_empty());
        // Only the walked, unknown file was read and cached.
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn a_bracket_segment_is_a_path_when_that_directory_exists() {
        let temp = workspace();
        temp.child("apps/web/app/[id]/page.tsx")
            .write_str("i")
            .unwrap();
        // Sibling directories a `[id]` character class would match.
        temp.child("apps/web/app/i/absent.tsx")
            .write_str("i")
            .unwrap();
        temp.child("apps/web/app/d/absent.tsx")
            .write_str("d")
            .unwrap();
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();

        // The file does not exist yet, but its `[id]/` directory does: it is a
        // path, recorded as missing, never a class over the siblings.
        let absent = expand(&["apps/web/app/[id]/absent.tsx"]);
        assert_eq!(absent.files, Vec::<String>::new());
        assert_eq!(absent.missing, vec!["apps/web/app/[id]/absent.tsx"]);
        assert_eq!(
            expand(&["apps/web/app/[id]/gen/**"]).files,
            Vec::<String>::new()
        );
        // Without such a directory anywhere, brackets are a class again.
        assert_eq!(
            expand(&["apps/web/app/[di]/absent.tsx"]).files,
            vec!["apps/web/app/d/absent.tsx", "apps/web/app/i/absent.tsx"]
        );
    }

    #[test]
    fn later_bracket_segments_follow_the_first_one() {
        let temp = workspace();
        temp.child("app/[lang]/page.tsx").write_str("l").unwrap();
        // Siblings a class reading of `[lang]` or of `[id]` would match.
        temp.child("app/l/i/x.tsx").write_str("x").unwrap();
        temp.child("app/g/d/x.tsx").write_str("x").unwrap();
        temp.child("app/[lang]/i/x.tsx").write_str("x").unwrap();
        let expand = |list: &[&str]| expand_files(temp.path(), &globs(list)).unwrap();

        // `[lang]/` exists and `[id]/` does not yet: still one exact path.
        let absent = expand(&["app/[lang]/[id]/x.tsx"]);
        assert_eq!(absent.files, Vec::<String>::new());
        assert_eq!(absent.missing, vec!["app/[lang]/[id]/x.tsx"]);
        assert_eq!(expand(&["app/[lang]/[id]/**"]).files, Vec::<String>::new());
        assert_eq!(
            expand(&["app/[lang]/absent/x.tsx"]).missing,
            vec!["app/[lang]/absent/x.tsx"]
        );

        temp.child("app/[lang]/[id]/x.tsx").write_str("x").unwrap();
        assert_eq!(
            expand(&["app/[lang]/[id]/x.tsx"]).files,
            vec!["app/[lang]/[id]/x.tsx"]
        );
        assert_eq!(
            expand(&["app/[lang]/[id]/**"]).files,
            vec!["app/[lang]/[id]/x.tsx"]
        );

        // Brackets inside a name stay a class even after a `[name]` path.
        temp.child("app/[lang]/page.jsx").write_str("j").unwrap();
        temp.child("app/web/page.tsx").write_str("t").unwrap();
        temp.child("app/web/page.jsx").write_str("j").unwrap();
        assert_eq!(
            expand(&["app/[lang]/page.[jt]sx"]).files,
            vec!["app/[lang]/page.jsx", "app/[lang]/page.tsx"]
        );
        assert_eq!(
            expand(&["app/[lang]/*.[jt]sx"]).files,
            vec!["app/[lang]/page.jsx", "app/[lang]/page.tsx"]
        );
        assert_eq!(
            expand(&["app/web/page.[jt]sx"]).files,
            vec!["app/web/page.jsx", "app/web/page.tsx"]
        );
    }

    #[test]
    fn the_context_can_vouch_for_a_bracket_path_that_is_not_on_disk() {
        let temp = workspace();
        let expansion = expand_files_with(
            temp.path(),
            &globs(&["apps/web/app/[id]/page.tsx"]),
            &|path| path == "apps/web/app/[id]/page.tsx",
        )
        .unwrap();
        assert_eq!(expansion.files, vec!["apps/web/app/[id]/page.tsx"]);
        assert_eq!(expansion.stamps, vec![None]);
    }

    #[test]
    fn hashing_reuses_the_stamp_the_expansion_recorded() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();
        let first = hash_files(temp.path(), &expansion, |_| None, &cache);

        // A different size after expansion: a fresh stat would miss the
        // cache, but the recorded stamp still matches the cached entry.
        temp.child("dist/gen/a.js").write_str("longer").unwrap();
        let same_expansion = hash_files(temp.path(), &expansion, |_| None, &cache);
        assert_eq!(first, same_expansion);
        let re_expanded = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();
        assert_ne!(
            first,
            hash_files(temp.path(), &re_expanded, |_| None, &cache)
        );
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
            assert!(validate_files_globs(&group).is_err(), "{bare}");
            assert!(expand_files(temp.path(), &group).is_err(), "{bare}");
        }
        assert!(validate_files_globs(&globs(&["dist/**", "!../x"])).is_err());
        assert!(validate_files_globs(&globs(&["dist/./gen/**"])).is_err());
    }

    fn cache_path(i: usize) -> PathBuf {
        PathBuf::from(format!("/cached/{i}"))
    }

    const CACHE_STAMP: FileStamp = (1, 1);

    /// Hits over `paths`, inserting on a miss.
    fn touch(cache: &FileContentCache, paths: &[usize]) -> usize {
        paths
            .iter()
            .filter(|&&i| {
                let hit = cache.get(&cache_path(i), CACHE_STAMP).is_some();
                if !hit {
                    cache.insert(
                        cache_path(i),
                        CachedFileContent::new(CACHE_STAMP, "h".into()),
                    );
                }
                hit
            })
            .count()
    }

    /// One run as the orchestrator makes it: the up-front batch, then the
    /// smaller passes for deferred tasks. Returns the up-front hits.
    fn run(cache: &FileContentCache, upfront: &[usize], later: &[&[usize]]) -> usize {
        cache.begin_run();
        let hits = touch(cache, upfront);
        for pass in later {
            touch(cache, pass);
        }
        hits
    }

    #[test]
    fn content_cache_keeps_what_a_whole_run_used() {
        let cache = FileContentCache::with_limit(4);
        let all: Vec<usize> = (0..10).collect();
        assert_eq!(run(&cache, &all, &[&[0], &[]]), 0);
        // A live set larger than the limit keeps hitting, and the small
        // passes after the batch did not age it.
        assert_eq!(run(&cache, &all, &[&[0], &[]]), 10);
        assert_eq!(run(&cache, &all, &[]), 10);
        assert_eq!(cache.len(), 10);
    }

    #[test]
    fn content_cache_survives_runs_that_read_nothing() {
        let cache = FileContentCache::with_limit(4);
        let all: Vec<usize> = (0..10).collect();
        run(&cache, &all, &[]);
        // A lint in between opens a run but reads no disk-backed file.
        run(&cache, &[], &[]);
        run(&cache, &[], &[]);
        assert_eq!(run(&cache, &all, &[]), 10);
    }

    #[test]
    fn content_cache_drops_the_oldest_runs_first() {
        let cache = FileContentCache::with_limit(4);
        run(&cache, &[0, 1, 2, 3], &[]);
        run(&cache, &[4, 5, 6, 7], &[]);
        assert_eq!(cache.len(), 8);
        // Over the limit: the oldest run goes, the newest stays whole.
        run(&cache, &[8, 9], &[]);
        assert_eq!(cache.len(), 6);
        for i in 0..4 {
            assert!(cache.get(&cache_path(i), CACHE_STAMP).is_none(), "{i}");
        }
        for i in 4..10 {
            assert!(cache.get(&cache_path(i), CACHE_STAMP).is_some(), "{i}");
        }
        // Half of the newest set re-read: the other half is now the oldest.
        run(&cache, &[4, 5, 6, 7, 8], &[]);
        assert_eq!(run(&cache, &[4, 5, 6, 7, 8, 9], &[]), 5);
    }

    #[test]
    fn content_cache_shares_the_limit_between_alternating_commands() {
        let cache = FileContentCache::with_limit(10);
        let a: Vec<usize> = (0..6).collect();
        let b: Vec<usize> = (100..106).collect();
        let mut hits = Vec::new();
        for _ in 0..3 {
            hits.push(run(&cache, &a, &[]));
            hits.push(run(&cache, &b, &[]));
        }
        // Together the sets exceed the limit by two, so each run gives up
        // two of the other's entries, not all six.
        assert_eq!(hits, vec![0, 0, 4, 4, 4, 4]);
    }

    #[test]
    fn content_cache_evicts_on_insert_at_twice_its_limit_without_a_run() {
        let cache = FileContentCache::with_limit(4);
        let entry = || CachedFileContent::new(CACHE_STAMP, "h".into());
        for i in 0..8 {
            cache.insert(cache_path(i), entry());
        }
        // Twice the limit: everything so far is the newest run, so it stays.
        cache.insert(cache_path(8), entry());
        assert_eq!(cache.len(), 9);
        // The next eviction waits for the limit past the survivors, then
        // drops the older run.
        for i in 9..12 {
            cache.insert(cache_path(i), entry());
        }
        assert_eq!(cache.len(), 12);
        cache.insert(cache_path(12), entry());
        assert_eq!(cache.len(), 5);
        for i in 0..8 {
            assert!(cache.get(&cache_path(i), CACHE_STAMP).is_none(), "{i}");
        }
        for i in 8..13 {
            assert!(cache.get(&cache_path(i), CACHE_STAMP).is_some(), "{i}");
        }
    }

    #[test]
    fn rejects_a_dot_slash_prefix() {
        assert!(validate_files_globs(&globs(&["./dist/**"])).is_err());
    }

    #[test]
    fn a_glob_with_no_leading_directory_walks_from_the_workspace_root() {
        let temp = workspace();
        temp.child("root.json").write_str("{}").unwrap();
        validate_files_globs(&globs(&["**/*.js", "*.json", "dist/**/*.gen", "!**/*.map"])).unwrap();
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
            let err = validate_files_globs(&globs(&[glob])).unwrap_err();
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
        assert_eq!(
            expand("libs/app/@gen/absent.json").missing,
            vec!["libs/app/@gen/absent.json"]
        );
        assert!(validate_files_globs(&globs(&["@gen/**"])).is_ok());
    }
}
