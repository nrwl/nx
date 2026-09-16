use std::cmp;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread::available_parallelism;
use std::{fs, io};

use fs_extra::error::ErrorKind;
use rayon::prelude::*;
use tracing::{debug, trace};

/// Pool for copying and removing the entries of a directory tree in parallel,
/// kept apart from the global rayon pool. A third of the available parallelism
/// and never fewer than two threads, as `workspace/files_hashing.rs` sizes its
/// hashing: the work is bound by per-file latency, and more threads than that
/// only contend in the filesystem.
static COPY_POOL: LazyLock<rayon::ThreadPool> = LazyLock::new(|| {
    let num_parallelism = cmp::max(available_parallelism().map_or(2, |n| n.get()) / 3, 2);
    rayon::ThreadPoolBuilder::new()
        .num_threads(num_parallelism)
        .thread_name(|i| format!("nx-copy-{i}"))
        .build()
        .expect("failed to build the copy thread pool")
});

#[napi]
pub fn remove(src: String) -> anyhow::Result<()> {
    fs_extra::remove_items(&[src]).map_err(|err| match err.kind {
        ErrorKind::Io(err_kind) => anyhow::Error::new(err_kind),
        _ => anyhow::Error::new(err),
    })
}

#[napi]
pub fn copy(src: String, dest: String) -> anyhow::Result<i64> {
    _copy(src, dest)
}

pub fn _copy<P>(src: P, dest: P) -> anyhow::Result<i64>
where
    P: AsRef<Path>,
{
    _copy_impl(src.as_ref(), dest.as_ref(), None)
}

/// Copy `src` to `dest`.
///
/// With `boundary = Some(root)` the copy is confined to `root` (cache restore):
/// parents are realized as real dirs (any symlink under `root` is replaced) and
/// existing entries are removed, not written through. `None` keeps the original.
pub fn _copy_impl(src: &Path, dest: &Path, boundary: Option<&Path>) -> anyhow::Result<i64> {
    let dest: PathBuf = remove_trailing_single_dot(dest);
    let dest_parent = dest.parent().unwrap_or(&dest);
    let src: PathBuf = src.into();

    trace!("Copying {:?} -> {:?}", &src, &dest);

    match boundary {
        Some(root) => {
            create_dir_all_within(root, dest_parent)?;
            // Never follow or merge into a stale entry at the destination.
            remove_path(&dest)?;
        }
        None => {
            if !dest_parent.exists() {
                trace!("Creating parent directory: {:?}", dest_parent);
                fs::create_dir_all(dest_parent)?;
            }
        }
    }

    // Check symlink before dir: `is_dir()` follows symlinks, so a symlinked
    // output must be recreated as a link, not followed (which would copy its
    // target's contents in). The link is recreated verbatim even if it points
    // outside the workspace — it is only a pointer, and we never write *through*
    // a symlink (create_dir_all_within realizes parents as real directories).
    let size = if src.is_symlink() {
        trace!("Copying symlink: {:?}", &src);
        remove_existing_symlink(&dest)?;
        symlink(fs::read_link(&src)?, &dest)?;
        0
    } else if src.is_dir() {
        trace!("Copying directory: {:?}", &src);
        copy_dir_all(&src, &dest, boundary).map_err(anyhow::Error::new)?
    } else {
        trace!("Copying file: {:?}", &src);
        fs::copy(&src, &dest)?
    };

    debug!("Copy completed: {:?} -> {:?} ({} bytes)", &src, &dest, size);
    Ok(size as i64)
}

/// Create `dir` and missing ancestors without traversing a symlink at or below
/// `boundary`: such a symlink/file is replaced with a real directory. Paths at
/// or above `boundary` are trusted and untouched (e.g. a `/tmp` system symlink).
fn create_dir_all_within(boundary: &Path, dir: &Path) -> io::Result<()> {
    // At or above the boundary: trust the existing tree, only create if missing.
    if dir == boundary || !dir.starts_with(boundary) {
        return match fs::symlink_metadata(dir) {
            Ok(_) => Ok(()),
            Err(_) => fs::create_dir_all(dir),
        };
    }

    if let Some(parent) = dir.parent() {
        create_dir_all_within(boundary, parent)?;
    }

    match fs::symlink_metadata(dir) {
        Ok(meta) if meta.file_type().is_dir() => Ok(()),
        Ok(_) => {
            // Replace a symlink/file occupying the path with a real directory.
            remove_path(dir)?;
            fs::create_dir(dir)
        }
        Err(_) => match fs::create_dir(dir) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => Ok(()),
            Err(e) => Err(e),
        },
    }
}

/// Remove the entry at `path` without following a final symlink (the link is
/// unlinked, not its target); directories recurse, a missing path is a no-op.
fn remove_path(path: &Path) -> io::Result<()> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_dir() => remove_dir_all_parallel(path),
        Ok(_) => fs::remove_file(path),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

/// `fs::remove_dir_all` with the top-level subdirectories removed in parallel
/// on the copy pool. Every traversal is the standard library's, so a symlink
/// swapped in under `dir` is unlinked, never followed. An entry the listing
/// cannot read is left for the final `fs::remove_dir_all`, which reports it.
fn remove_dir_all_parallel(dir: &Path) -> io::Result<()> {
    let subdirs: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_ok_and(|ty| ty.is_dir()))
        .map(|entry| entry.path())
        .collect();

    COPY_POOL.install(|| subdirs.par_iter().try_for_each(fs::remove_dir_all))?;

    fs::remove_dir_all(dir)
}

/// Restore the given expanded outputs from `outputs_path` into `workspace_root`.
/// Only the listed outputs are copied (never the whole cache dir) and each copy
/// is confined to `workspace_root`, so a malicious artifact can't write beyond
/// the declared outputs or escape via a symlink.
pub fn copy_outputs_into_workspace(
    workspace_root: &Path,
    outputs_path: &Path,
    expanded_outputs: &[String],
) -> anyhow::Result<i64> {
    let mut size = 0;
    for output in expanded_outputs {
        let from = outputs_path.join(output);
        // Only restore entries the artifact actually contains.
        if fs::symlink_metadata(&from).is_err() {
            trace!("No cached artifact for output {}, skipping", output);
            continue;
        }
        let to = workspace_root.join(output);
        size += _copy_impl(&from, &to, Some(workspace_root))?;
    }
    Ok(size)
}

fn remove_trailing_single_dot(path: impl AsRef<Path>) -> PathBuf {
    let mut components = path.as_ref().components().collect::<Vec<_>>();

    if let Some(last_component) = components.last() {
        if last_component.as_os_str() == "." {
            components.pop();
        }
    }

    components.iter().collect()
}

#[cfg(windows)]
fn symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    std::os::windows::fs::symlink_file(original, link)
}

#[cfg(unix)]
fn symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

#[cfg(target_os = "wasi")]
fn symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> io::Result<()> {
    std::os::wasi::fs::symlink_path(original, link)
}

/// Removes an existing symlink at `path` if one exists.
/// Uses `symlink_metadata` which does not follow symlinks, so it correctly
/// detects dangling symlinks that `is_file()`/`is_dir()` would miss.
fn remove_existing_symlink(path: &Path) -> io::Result<()> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_symlink() => {
            trace!("Removing existing symlink at {:?}", path);
            fs::remove_file(path)?;
        }
        _ => {}
    }
    Ok(())
}

fn copy_dir_all(
    src: impl AsRef<Path>,
    dst: impl AsRef<Path>,
    boundary: Option<&Path>,
) -> io::Result<u64> {
    let src = src.as_ref();
    let dst = dst.as_ref();

    trace!("Creating directory: {:?}", dst);
    match boundary {
        Some(root) => create_dir_all_within(root, dst)?,
        None => fs::create_dir_all(dst)?,
    }

    trace!("Reading source directory: {:?}", src);
    let entries = fs::read_dir(src)?.collect::<io::Result<Vec<_>>>()?;

    let files_copied = AtomicUsize::new(0);
    let dirs_copied = AtomicUsize::new(0);
    let symlinks_copied = AtomicUsize::new(0);

    // `dst` exists before any entry is copied, every entry has its own
    // destination, and a subdirectory creates itself before touching its
    // own entries, so the parallel copies never race one another.
    let total_size = COPY_POOL.install(|| {
        entries
            .par_iter()
            .map(|entry| -> io::Result<u64> {
                let ty = entry.file_type()?;
                let dest_path = dst.join(entry.file_name());

                if ty.is_dir() {
                    trace!("Copying subdirectory: {:?}", entry.path());
                    let subdir_size = copy_dir_all(entry.path(), dest_path, boundary)?;
                    dirs_copied.fetch_add(1, Ordering::Relaxed);
                    Ok(subdir_size)
                } else if ty.is_symlink() {
                    trace!("Copying symlink: {:?}", entry.path());
                    remove_existing_symlink(&dest_path)?;
                    symlink(fs::read_link(entry.path())?, dest_path)?;
                    symlinks_copied.fetch_add(1, Ordering::Relaxed);
                    Ok(0)
                } else {
                    trace!("Copying file: {:?}", entry.path());
                    // On restore, don't follow a pre-existing dest symlink.
                    if boundary.is_some() {
                        remove_existing_symlink(&dest_path)?;
                    }
                    let file_size = fs::copy(entry.path(), dest_path)?;
                    files_copied.fetch_add(1, Ordering::Relaxed);
                    Ok(file_size)
                }
            })
            .try_reduce(|| 0, |a, b| Ok(a + b))
    })?;

    debug!(
        "Directory copy completed: {:?} -> {:?} ({} files, {} dirs, {} symlinks, {} bytes total)",
        src,
        dst,
        files_copied.load(Ordering::Relaxed),
        dirs_copied.load(Ordering::Relaxed),
        symlinks_copied.load(Ordering::Relaxed),
        total_size
    );
    Ok(total_size)
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::fixture::ChildPath;
    use assert_fs::prelude::*;

    #[test]
    fn should_copy_directories() {
        let temp = TempDir::new().unwrap();
        temp.child("parent")
            .child("child")
            .child("grand-child")
            .child(".config")
            .child("file.txt")
            .touch()
            .unwrap();
        let src = temp.join("parent/child/grand-child/.config");
        let dest = temp.join("new-parent/child/grand-child/.config");
        copy(src.to_string_lossy().into(), dest.to_string_lossy().into()).unwrap();

        assert!(
            temp.child("new-parent/child/grand-child/.config/file.txt")
                .exists()
        );
    }

    #[test]
    fn should_copy_single_files() {
        let temp = TempDir::new().unwrap();
        temp.child("parent")
            .child("file.txt")
            .write_str("content")
            .unwrap();

        let src = temp.join("parent/file.txt");
        let dest = temp.join("new-parent/file.txt");
        copy(src.to_string_lossy().into(), dest.to_string_lossy().into()).unwrap();

        assert!(temp.child("new-parent/file.txt").exists());
    }

    #[test]
    fn should_copy_symlinks() {
        let temp = TempDir::new().unwrap();
        let target = temp.child("parent").child("target.txt");
        target.touch().unwrap();
        let link = temp.child("parent").child("file.txt");

        link.symlink_to_file(&target).unwrap();

        let src = temp.join("parent/file.txt");
        let dest = temp.join("new-parent/file.txt");
        copy(src.to_string_lossy().into(), dest.to_string_lossy().into()).unwrap();

        assert!(temp.child("new-parent/file.txt").exists());
        assert_eq!(
            temp.child("new-parent/file.txt").read_link().unwrap(),
            target.path()
        );
    }

    #[test]
    fn should_copy_directories_with_symlinks() {
        let temp = TempDir::new().unwrap();
        let target = temp.child("parent").child("target.txt");
        target.touch().unwrap();
        let link = temp.child("parent").child("file.txt");

        link.symlink_to_file(&target).unwrap();

        let src = temp.join("parent");
        let dest = temp.join("new-parent");
        copy(src.to_string_lossy().into(), dest.to_string_lossy().into()).unwrap();

        assert!(temp.child("new-parent/file.txt").exists());
        assert_eq!(
            temp.child("new-parent/file.txt").read_link().unwrap(),
            target.path()
        );
    }

    #[test]
    fn restore_copies_only_declared_outputs() {
        // A malicious artifact ships files beyond the declared outputs; the
        // restore must copy ONLY the declared (expanded) outputs.
        let cache = TempDir::new().unwrap();
        let workspace = TempDir::new().unwrap();

        cache.child("dist/main.js").write_str("ok").unwrap();
        cache
            .child(".git/hooks/pre-commit")
            .write_str("#!/bin/sh\nevil")
            .unwrap();
        cache.child("package.json").write_str("{evil}").unwrap();

        let expanded = vec!["dist/main.js".to_string()];
        copy_outputs_into_workspace(workspace.path(), cache.path(), &expanded).unwrap();

        assert!(workspace.child("dist/main.js").exists());
        assert!(!workspace.child(".git/hooks/pre-commit").exists());
        assert!(!workspace.child("package.json").exists());
    }

    #[cfg(unix)]
    #[test]
    fn restore_does_not_traverse_parent_symlink() {
        use std::os::unix::fs::symlink;

        // A directory outside the workspace holding a victim file.
        let outside = TempDir::new().unwrap();
        outside.child("keep.txt").write_str("keep").unwrap();

        let cache = TempDir::new().unwrap();
        cache.child("dist/payload.js").write_str("PWNED").unwrap();

        let workspace = TempDir::new().unwrap();
        // A planted/pre-existing symlink: <workspace>/dist -> <outside>.
        symlink(outside.path(), workspace.join("dist")).unwrap();

        let expanded = vec!["dist/payload.js".to_string()];
        copy_outputs_into_workspace(workspace.path(), cache.path(), &expanded).unwrap();

        // The write must land in the workspace, not through the symlink.
        assert!(!outside.child("payload.js").exists());
        // The implicit delete must not have followed the symlink either.
        assert!(outside.child("keep.txt").exists());
        // The symlink was replaced with a real directory holding the output.
        assert!(workspace.child("dist/payload.js").exists());
        assert!(
            !workspace
                .join("dist")
                .symlink_metadata()
                .unwrap()
                .file_type()
                .is_symlink()
        );
    }

    #[cfg(unix)]
    #[test]
    fn remove_path_unlinks_symlink_without_following() {
        use std::os::unix::fs::symlink;

        let outside = TempDir::new().unwrap();
        outside.child("keep.txt").write_str("keep").unwrap();

        let workspace = TempDir::new().unwrap();
        symlink(outside.path(), workspace.join("link")).unwrap();

        remove_path(&workspace.join("link")).unwrap();

        assert!(workspace.join("link").symlink_metadata().is_err());
        assert!(outside.child("keep.txt").exists());
    }

    #[cfg(unix)]
    #[test]
    fn restore_recreates_escaping_symlink_without_following_it() {
        use std::os::unix::fs::symlink;

        // A directory outside the workspace.
        let outside = TempDir::new().unwrap();
        outside.child("secret.txt").write_str("SECRET").unwrap();

        // The declared output `dist` is a symlink pointing outside the workspace.
        let cache = TempDir::new().unwrap();
        symlink(outside.path(), cache.join("dist")).unwrap();

        let workspace = TempDir::new().unwrap();
        let expanded = vec!["dist".to_string()];
        copy_outputs_into_workspace(workspace.path(), cache.path(), &expanded).unwrap();

        // The symlink is recreated verbatim — a pointer outside the workspace is
        // allowed; nothing was written *through* it.
        let dist = workspace.join("dist");
        assert!(
            dist.symlink_metadata().unwrap().file_type().is_symlink(),
            "the symlink should be recreated, not rejected"
        );
        assert_eq!(dist.read_link().unwrap(), outside.path());

        // The target's contents were NOT copied into the workspace as real files
        // (the symlink was not followed): removing the link leaves nothing behind.
        remove_path(&dist).unwrap();
        assert!(!dist.join("secret.txt").exists());
        assert!(outside.child("secret.txt").exists());
    }

    #[cfg(unix)]
    #[test]
    fn restore_allows_symlinked_output_within_workspace() {
        use std::os::unix::fs::symlink;

        // The legit pnpm/Next.js case: an output symlink whose (relative) target
        // stays inside the workspace must still be restored.
        let cache = TempDir::new().unwrap();
        cache.child("dist/real.js").write_str("ok").unwrap();
        symlink("real.js", cache.join("dist/link.js")).unwrap();

        let workspace = TempDir::new().unwrap();
        let expanded = vec!["dist/real.js".to_string(), "dist/link.js".to_string()];
        copy_outputs_into_workspace(workspace.path(), cache.path(), &expanded).unwrap();

        let link = workspace.join("dist/link.js");
        assert!(
            link.symlink_metadata().unwrap().file_type().is_symlink(),
            "an in-workspace symlink output must be restored"
        );
        assert_eq!(link.read_link().unwrap(), Path::new("real.js"));
        assert_eq!(std::fs::read_to_string(&link).unwrap(), "ok");
    }

    /// Every entry below `root` as (relative path, description), sorted, so
    /// two trees can be compared for structure and contents.
    fn tree_manifest(root: &Path) -> Vec<(PathBuf, String)> {
        fn walk(root: &Path, dir: &Path, out: &mut Vec<(PathBuf, String)>) {
            for entry in fs::read_dir(dir).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                let rel = path.strip_prefix(root).unwrap().to_path_buf();
                let ty = entry.file_type().unwrap();
                if ty.is_symlink() {
                    let target = fs::read_link(&path).unwrap();
                    out.push((rel, format!("symlink -> {}", target.display())));
                } else if ty.is_dir() {
                    out.push((rel, "dir".to_string()));
                    walk(root, &path, out);
                } else {
                    let contents = fs::read_to_string(&path).unwrap();
                    out.push((rel, format!("file {contents}")));
                }
            }
        }
        let mut out = Vec::new();
        walk(root, root, &mut out);
        out.sort();
        out
    }

    /// A tree wide and deep enough to be split across the thread pool: 6 dirs
    /// x 4 subdirs x 25 files with distinct contents, plus empty directories
    /// at two depths. Returns the number of bytes written.
    fn write_wide_tree(root: &ChildPath) -> u64 {
        let mut bytes = 0;
        for d in 0..6 {
            for s in 0..4 {
                let dir = root.child(format!("d{d}/s{s}"));
                for f in 0..25 {
                    let contents = format!("{d}-{s}-{f}:{}", "x".repeat(f * 7));
                    dir.child(format!("f{f}.txt")).write_str(&contents).unwrap();
                    bytes += contents.len() as u64;
                }
                dir.child("empty").create_dir_all().unwrap();
            }
        }
        root.child("empty-top").create_dir_all().unwrap();
        bytes
    }

    #[test]
    fn should_copy_wide_tree_byte_for_byte() {
        let temp = TempDir::new().unwrap();
        let src = temp.child("src");
        let bytes = write_wide_tree(&src);

        let dest = temp.join("dest");
        let size = copy(
            src.path().to_string_lossy().into(),
            dest.to_string_lossy().into(),
        )
        .unwrap();

        assert_eq!(size as u64, bytes);
        assert_eq!(tree_manifest(&dest), tree_manifest(src.path()));
        assert!(dest.join("d0/s0/empty").is_dir());
        assert!(dest.join("empty-top").is_dir());
    }

    #[test]
    fn restore_replaces_stale_outputs_with_wide_tree() {
        let cache = TempDir::new().unwrap();
        let workspace = TempDir::new().unwrap();
        let bytes = write_wide_tree(&cache.child("dist"));

        // Stale outputs at the destination: a file the artifact does not have
        // and one whose contents differ.
        workspace
            .child("dist/stale/old.txt")
            .write_str("old")
            .unwrap();
        workspace
            .child("dist/d0/s0/f0.txt")
            .write_str("stale")
            .unwrap();

        let expanded = vec!["dist".to_string()];
        let size = copy_outputs_into_workspace(workspace.path(), cache.path(), &expanded).unwrap();

        assert_eq!(size as u64, bytes);
        assert_eq!(
            tree_manifest(&workspace.join("dist")),
            tree_manifest(&cache.join("dist"))
        );
    }

    #[cfg(unix)]
    #[test]
    fn should_copy_nested_symlinks_without_following() {
        use std::os::unix::fs::symlink;

        let temp = TempDir::new().unwrap();
        let src = temp.child("src");
        src.child("a/b/target.txt").write_str("target").unwrap();
        symlink("target.txt", src.join("a/b/rel-link.txt")).unwrap();
        symlink("b", src.join("a/dir-link")).unwrap();
        symlink("missing.txt", src.join("a/dangling")).unwrap();

        let dest = temp.join("dest");
        copy(
            src.path().to_string_lossy().into(),
            dest.to_string_lossy().into(),
        )
        .unwrap();

        // Links are recreated as links (targets verbatim), never expanded.
        assert_eq!(tree_manifest(&dest), tree_manifest(src.path()));
        assert_eq!(
            fs::read_to_string(dest.join("a/b/rel-link.txt")).unwrap(),
            "target"
        );
        assert!(
            dest.join("a/dir-link")
                .symlink_metadata()
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert!(
            dest.join("a/dangling")
                .symlink_metadata()
                .unwrap()
                .file_type()
                .is_symlink()
        );
    }

    #[test]
    fn should_fail_when_a_nested_directory_cannot_be_created() {
        let temp = TempDir::new().unwrap();
        let src = temp.child("src");
        write_wide_tree(&src);
        // A file sits where a subdirectory of the copy has to go.
        temp.child("dest/d3/s2").write_str("in the way").unwrap();

        let dest = temp.join("dest");
        let result = copy(
            src.path().to_string_lossy().into(),
            dest.to_string_lossy().into(),
        );

        assert!(result.is_err());
    }

    #[cfg(unix)]
    #[test]
    fn remove_path_unlinks_nested_directory_symlink_without_following() {
        use std::os::unix::fs::symlink;

        let temp = TempDir::new().unwrap();
        let outside = temp.child("outside");
        outside.child("keep.txt").write_str("keep").unwrap();
        let dist = temp.child("dist");
        write_wide_tree(&dist);
        symlink(outside.path(), dist.join("d1/s1/link-to-outside")).unwrap();
        symlink(outside.path(), dist.join("top-link")).unwrap();

        remove_path(dist.path()).unwrap();

        assert!(!dist.path().exists());
        assert_eq!(
            fs::read_to_string(outside.join("keep.txt")).unwrap(),
            "keep"
        );
    }

    #[cfg(unix)]
    #[test]
    fn restore_replaces_nested_escaping_symlink_without_following_it() {
        use std::os::unix::fs::symlink;

        let cache = TempDir::new().unwrap();
        let workspace = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        outside.child("keep.txt").write_str("keep").unwrap();
        write_wide_tree(&cache.child("dist"));
        // A symlink deep in the stale outputs points outside the workspace.
        workspace.child("dist/d0").create_dir_all().unwrap();
        symlink(outside.path(), workspace.join("dist/d0/s0")).unwrap();

        let expanded = vec!["dist".to_string()];
        copy_outputs_into_workspace(workspace.path(), cache.path(), &expanded).unwrap();

        assert_eq!(
            tree_manifest(&workspace.join("dist")),
            tree_manifest(&cache.join("dist"))
        );
        assert_eq!(
            fs::read_to_string(outside.join("keep.txt")).unwrap(),
            "keep"
        );
        assert_eq!(fs::read_dir(outside.path()).unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn should_fail_when_a_nested_source_is_unreadable() {
        use std::os::unix::fs::PermissionsExt;

        let temp = TempDir::new().unwrap();
        let src = temp.child("src");
        write_wide_tree(&src);
        let locked = src.join("d3/s2");
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        if fs::read_dir(&locked).is_ok() {
            // Running as root: permissions do not apply, nothing to check.
            fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
            return;
        }

        let dest = temp.join("dest");
        let result = copy(
            src.path().to_string_lossy().into(),
            dest.to_string_lossy().into(),
        );

        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(result.is_err());
    }
}
