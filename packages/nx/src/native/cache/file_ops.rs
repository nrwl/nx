#[napi]
pub fn remove(src: String) -> anyhow::Result<()> {
    fs_extra::remove_items(&[src]).map_err(anyhow::Error::from)
}

#[napi]
pub fn copy(src: String, dest: String) -> anyhow::Result<()> {
    let copy_options = fs_extra::dir::CopyOptions::new()
        .overwrite(true)
        .skip_exist(false)
        .copy_inside(true);
    fs_extra::copy_items(&[src], dest, &copy_options)?;
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;

    #[test]
    fn should_copy_files() {
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
}
