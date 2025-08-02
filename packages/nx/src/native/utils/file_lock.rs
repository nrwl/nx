use napi::bindgen_prelude::*;
use std::fs;
#[cfg(not(target_arch = "wasm32"))]
use std::{fs::OpenOptions, path::Path};
#[cfg(not(target_arch = "wasm32"))]
use tracing::trace;

#[cfg(not(target_arch = "wasm32"))]
use fs4::fs_std::FileExt;

#[napi]
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
    pub fn wait(&mut self, env: Env) -> napi::Result<napi::JsObject> {
        if self.locked {
            let lock_file_path = self.lock_file_path.clone();
            self.locked = false;
            env.spawn_future(async move {
                let file = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .create(true)
                    .open(&lock_file_path)?;
                fs4::fs_std::FileExt::lock_shared(&file)?;
                fs4::fs_std::FileExt::unlock(&file)?;
                Ok(())
            })
        } else {
            env.spawn_future(async move { Ok(()) })
        }
    }

    #[napi]
    pub fn lock(&mut self) -> napi::Result<()> {
        fs4::fs_std::FileExt::lock_exclusive(&self.file)?;
        self.locked = true;
        Ok(())
    }

    /// Synchronously wait for the lock to be released
    /// This blocks the thread until the lock is available
    #[napi]
    pub fn wait_sync(&mut self) -> napi::Result<()> {
        if self.locked {
            // Acquire a shared lock - this will block until any exclusive lock is released
            fs4::fs_std::FileExt::lock_shared(&self.file)?;
            // Immediately unlock since we just wanted to wait
            fs4::fs_std::FileExt::unlock(&self.file)?;
            self.locked = false;
        }
        Ok(())
    }
}

#[napi]
#[cfg(target_arch = "wasm32")]
impl FileLock {
    #[napi(constructor)]
    pub fn new(lock_file_path: String) -> anyhow::Result<Self> {
        anyhow::bail!("FileLock is not supported on WASM")
    }
}

// TODO: Fix the tests
#[cfg(test)]
mod test {
    use super::*;

    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    #[test]
    fn test_new_lock() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let lock_file_path = lock_file.path().to_path_buf();
        let lock_file_path_str = lock_file_path.into_os_string().into_string().unwrap();
        let mut file_lock = FileLock::new(lock_file_path_str).unwrap();
        assert_eq!(file_lock.locked, false);
        let _ = file_lock.lock();
        assert_eq!(file_lock.locked, true);
        assert!(lock_file.exists());
        let _ = file_lock.unlock();
        assert_eq!(file_lock.locked, false);
    }

    #[test]
    fn test_drop() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let lock_file_path = lock_file.path().to_path_buf();
        let lock_file_path_str = lock_file_path.into_os_string().into_string().unwrap();
        {
            let mut file_lock = FileLock::new(lock_file_path_str.clone()).unwrap();
            let _ = file_lock.lock();
        }
        let file_lock = FileLock::new(lock_file_path_str.clone());
        assert_eq!(file_lock.unwrap().locked, false);
    }
}
