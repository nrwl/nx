use std::path::{Path, PathBuf};
use std::{fs, io};

use fs_extra::error::ErrorKind;
use tracing::{debug, trace};

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
            trace!("Ensuring parent directory: {:?}", dest_parent);
            fs::create_dir_all(dest_parent)?;
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
        Ok(meta) if meta.file_type().is_dir() => fs::remove_dir_all(path),
        Ok(_) => fs::remove_file(path),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
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
    trace!("Creating directory: {:?}", dst.as_ref());
    match boundary {
        Some(root) => create_dir_all_within(root, dst.as_ref())?,
        None => fs::create_dir_all(&dst)?,
    }

    trace!("Reading source directory: {:?}", src.as_ref());
    let mut total_size = 0;
    let mut files_copied = 0;
    let mut dirs_copied = 0;
    let mut symlinks_copied = 0;

    for entry in fs::read_dir(&src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let entry_name = entry.file_name();
        let dest_path = dst.as_ref().join(&entry_name);

        let size: u64 = if ty.is_dir() {
            trace!("Copying subdirectory: {:?}", entry.path());
            let subdir_size = copy_dir_all(entry.path(), dest_path, boundary)?;
            dirs_copied += 1;
            subdir_size
        } else if ty.is_symlink() {
            trace!("Copying symlink: {:?}", entry.path());
            remove_existing_symlink(&dest_path)?;
            symlink(fs::read_link(entry.path())?, dest_path)?;
            symlinks_copied += 1;
            0
        } else {
            trace!("Copying file: {:?}", entry.path());
            // On restore, don't follow a pre-existing dest symlink.
            if boundary.is_some() {
                remove_existing_symlink(&dest_path)?;
            }
            let file_size = fs::copy(entry.path(), dest_path)?;
            files_copied += 1;
            file_size
        };
        total_size += size;
    }

    debug!(
        "Directory copy completed: {:?} -> {:?} ({} files, {} dirs, {} symlinks, {} bytes total)",
        src.as_ref(),
        dst.as_ref(),
        files_copied,
        dirs_copied,
        symlinks_copied,
        total_size
    );
    Ok(total_size)
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::TempDir;
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
}
