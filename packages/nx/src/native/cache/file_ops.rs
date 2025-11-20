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

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<u64> {
    trace!("Creating directory: {:?}", dst.as_ref());
    fs::create_dir_all(&dst)?;
    trace!("Successfully created directory: {:?}", dst.as_ref());

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
            let subdir_size = copy_dir_all(entry.path(), dest_path)?;
            dirs_copied += 1;
            trace!(
                "Successfully copied subdirectory: {:?} ({} bytes)",
                entry_name, subdir_size
            );
            subdir_size
        } else if ty.is_symlink() {
            trace!("Copying symlink: {:?}", entry.path());
            symlink(fs::read_link(entry.path())?, dest_path)?;
            symlinks_copied += 1;
            trace!("Successfully copied symlink: {:?}", entry_name);
            0
        } else {
            trace!("Copying file: {:?}", entry.path());
            let file_size = fs::copy(entry.path(), dest_path)?;
            files_copied += 1;
            trace!(
                "Successfully copied file: {:?} ({} bytes)",
                entry_name, file_size
            );
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
}
