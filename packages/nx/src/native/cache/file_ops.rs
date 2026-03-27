use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::{fs, io};

use fs_extra::error::ErrorKind;
use rayon::prelude::*;
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
    let dest: PathBuf = remove_trailing_single_dot(dest);
    let dest_parent = dest.parent().unwrap_or(&dest);
    let src: PathBuf = src.as_ref().into();

    trace!("Copying {:?} -> {:?}", &src, &dest);

    if !dest_parent.exists() {
        trace!("Creating parent directory: {:?}", dest_parent);
        fs::create_dir_all(dest_parent)?;
        trace!("Successfully created parent directory: {:?}", dest_parent);
    }

    let size = if src.is_dir() {
        trace!("Copying directory: {:?}", &src);
        let copied_size = copy_dir_all(&src, &dest).map_err(anyhow::Error::new)?;
        trace!(
            "Successfully copied directory: {:?} ({} bytes)",
            &src, copied_size
        );
        copied_size
    } else if src.is_symlink() {
        trace!("Copying symlink: {:?}", &src);
        remove_existing_symlink(&dest)?;
        symlink(fs::read_link(&src)?, &dest)?;
        trace!("Successfully copied symlink: {:?}", &src);
        0
    } else {
        trace!("Copying file: {:?}", &src);
        let copied_size = fs::copy(&src, &dest)?;
        trace!(
            "Successfully copied file: {:?} ({} bytes)",
            &src, copied_size
        );
        copied_size
    };

    debug!("Copy completed: {:?} -> {:?} ({} bytes)", &src, &dest, size);
    Ok(size as i64)
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

enum EntryKind {
    File { src: PathBuf, dst: PathBuf },
    Symlink { src: PathBuf, dst: PathBuf },
}

/// Walk the entire directory tree and collect all entries up front.
/// Directories are created sequentially (cheap), files/symlinks are collected for parallel copy.
fn collect_entries(src: &Path, dst: &Path, entries: &mut Vec<EntryKind>) -> io::Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());

        if ty.is_dir() {
            collect_entries(&entry.path(), &dest_path, entries)?;
        } else if ty.is_symlink() {
            entries.push(EntryKind::Symlink {
                src: entry.path(),
                dst: dest_path,
            });
        } else {
            entries.push(EntryKind::File {
                src: entry.path(),
                dst: dest_path,
            });
        }
    }
    Ok(())
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<u64> {
    trace!(
        "Collecting entries: {:?} -> {:?}",
        src.as_ref(),
        dst.as_ref()
    );

    let mut entries = Vec::new();
    collect_entries(src.as_ref(), dst.as_ref(), &mut entries)?;

    trace!("Copying {} entries in parallel", entries.len());

    let total_size = AtomicU64::new(0);

    entries.par_iter().try_for_each(|entry| -> io::Result<()> {
        match entry {
            EntryKind::File { src, dst } => {
                let size = fs::copy(src, dst)?;
                total_size.fetch_add(size, Ordering::Relaxed);
                trace!("Copied file: {:?} ({} bytes)", src, size);
            }
            EntryKind::Symlink { src, dst } => {
                remove_existing_symlink(dst)?;
                symlink(fs::read_link(src)?, dst)?;
                trace!("Copied symlink: {:?}", src);
            }
        }
        Ok(())
    })?;

    let total = total_size.load(Ordering::Relaxed);
    debug!(
        "Directory copy completed: {:?} -> {:?} ({} entries, {} bytes total)",
        src.as_ref(),
        dst.as_ref(),
        entries.len(),
        total
    );
    Ok(total)
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
}
