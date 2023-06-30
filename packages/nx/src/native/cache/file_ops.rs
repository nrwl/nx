use std::fs;
use std::path::PathBuf;

#[napi]
pub fn remove(src: String) -> anyhow::Result<()> {
    fs_extra::remove_items(&[src]).map_err(anyhow::Error::from)
}

#[napi]
pub fn copy(src: String, dest: String) -> anyhow::Result<()> {
    let copy_options = fs_extra::dir::CopyOptions::new()
        .overwrite(true)
        .skip_exist(false);

    let dest: PathBuf = dest.into();
    let dest_parent = dest.parent().unwrap_or(&dest);

    if !dest_parent.exists() {
        fs::create_dir_all(dest_parent)?;
    }

    fs_extra::copy_items(&[src], dest_parent, &copy_options)?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;

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

        assert!(temp
            .child("new-parent/child/grand-child/.config/file.txt")
            .exists());
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
}
