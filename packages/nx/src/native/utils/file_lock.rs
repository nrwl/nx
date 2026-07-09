#[cfg(not(target_arch = "wasm32"))]
use napi::bindgen_prelude::*;
use std::fs;
#[cfg(not(target_arch = "wasm32"))]
use std::{fs::OpenOptions, path::Path};
#[cfg(not(target_arch = "wasm32"))]
use tracing::trace;

#[cfg(not(target_arch = "wasm32"))]
use fs4::fs_std::FileExt;

#[napi]
#[cfg_attr(target_arch = "wasm32", allow(dead_code))]
pub struct FileLock {
    #[napi]
    pub locked: bool,
    file: fs::File,
    lock_file_path: String,
}

/// const lock = new FileLock('lockfile.lock');
/// if (lock.locked) {
///   lock.wait()
///   readFromCache()
/// } else {
///  lock.lock()
///  ... do some work
///  writeToCache()
///  lock.unlock()
/// }

#[napi]
#[cfg(not(target_arch = "wasm32"))]
impl FileLock {
    #[napi(constructor)]
    pub fn new(lock_file_path: String) -> anyhow::Result<Self> {
        // Creates the directory where the lock file will be stored
        fs::create_dir_all(Path::new(&lock_file_path).parent().unwrap())?;

        // Opens the lock file
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&lock_file_path)?;

        trace!("Locking file {}", lock_file_path);

        // Check if the file is locked
        let file_lock: std::result::Result<(), std::io::Error> = file.try_lock_exclusive();

        if file_lock.is_ok() {
            // Checking if the file is locked, locks it, so unlock it.
            fs4::fs_std::FileExt::unlock(&file)?;
        }

        Ok(Self {
            file,
            locked: file_lock.is_err(),
            lock_file_path,
        })
    }

    #[napi]
    pub fn unlock(&mut self) -> Result<()> {
        fs4::fs_std::FileExt::unlock(&self.file)?;
        self.locked = false;
        Ok(())
    }

    #[napi]
    pub fn check(&mut self) -> Result<bool> {
        // Check if the file is locked
        let file_lock: std::result::Result<(), std::io::Error> = self.file.try_lock_exclusive();

        if file_lock.is_ok() {
            // Checking if the file is locked, locks it, so unlock it.
            fs4::fs_std::FileExt::unlock(&self.file)?;
        }

        self.locked = file_lock.is_err();
        Ok(self.locked)
    }

    #[napi(ts_return_type = "Promise<void>")]
    pub fn wait(&mut self, env: Env) -> napi::Result<PromiseRaw<'static, ()>> {
        if self.locked {
            let lock_file_path = self.lock_file_path.clone();
            self.locked = false;
            let promise = env.spawn_future(async move {
                let file = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .create(true)
                    .open(&lock_file_path)?;
                fs4::fs_std::FileExt::lock_shared(&file)?;
                fs4::fs_std::FileExt::unlock(&file)?;
                Ok(())
            })?;
            // SAFETY: PromiseRaw's inner napi_value is GC-managed by V8
            // and remains valid beyond this stack frame.
            Ok(unsafe { std::mem::transmute(promise) })
        } else {
            let promise = env.spawn_future(async move { Ok(()) })?;
            Ok(unsafe { std::mem::transmute(promise) })
        }
    }

    #[napi]
    pub fn lock(&mut self) -> napi::Result<()> {
        self.file.lock_exclusive()?;
        self.locked = true;
        Ok(())
    }
}

#[napi]
#[cfg(target_arch = "wasm32")]
impl FileLock {
    #[napi(constructor)]
    pub fn new(_lock_file_path: String) -> anyhow::Result<Self> {
        anyhow::bail!("FileLock is not supported on WASM")
    }
}

#[cfg(test)]
mod test {
    use super::*;

    use assert_fs::prelude::*;
    use assert_fs::TempDir;

    fn lock_path(tmp_dir: &TempDir, name: &str) -> String {
        let lock_file = tmp_dir.child(name);
        lock_file
            .path()
            .to_path_buf()
            .into_os_string()
            .into_string()
            .unwrap()
    }

    #[test]
    fn test_new_lock() {
        let tmp = TempDir::new().unwrap();
        let path = lock_path(&tmp, "test_new_lock");
        let mut file_lock = FileLock::new(path.clone()).unwrap();
        assert!(!file_lock.locked);

        file_lock.lock().unwrap();
        assert!(file_lock.locked);
        assert!(tmp.child("test_new_lock").exists());

        file_lock.unlock().unwrap();
        assert!(!file_lock.locked);
    }

    #[test]
    fn test_drop_releases_lock() {
        let tmp = TempDir::new().unwrap();
        let path = lock_path(&tmp, "test_drop");
        {
            let mut lock = FileLock::new(path.clone()).unwrap();
            lock.lock().unwrap();
            assert!(lock.locked);
        }
        let lock = FileLock::new(path).unwrap();
        assert!(!lock.locked);
    }

    #[test]
    fn test_check_detects_contention() {
        let tmp = TempDir::new().unwrap();
        let path = lock_path(&tmp, "test_check");

        // No one holds the lock
        let mut lock_a = FileLock::new(path.clone()).unwrap();
        assert!(!lock_a.check().unwrap());

        // A second handle acquires the lock
        let mut lock_b = FileLock::new(path.clone()).unwrap();
        lock_b.lock().unwrap();

        // lock_a should detect the contention
        assert!(lock_a.check().unwrap());

        lock_b.unlock().unwrap();

        // After release, no contention
        assert!(!lock_a.check().unwrap());
    }
}
