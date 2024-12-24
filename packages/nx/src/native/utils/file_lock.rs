use std::fs::{self, File};
use std::io;
use std::path::Path;
use std::time::Duration;

#[napi]
#[derive(Clone)]
pub struct FileLock {
    #[napi]
    pub locked: bool,

    lock_file_path: String,
}

#[napi]
impl FileLock {
    #[napi(constructor)]
    pub fn new(lock_file_path: String) -> Self {
        let locked = Path::new(&lock_file_path).exists();
        Self {
            locked,
            lock_file_path,
        }
    }

    #[napi]
    pub fn lock(&mut self) -> anyhow::Result<()> {
        if self.locked {
            anyhow::bail!("File {} is already locked", self.lock_file_path)
        }

        let _ = File::create(&self.lock_file_path)?;
        self.locked = true;
        Ok(())
    }

    #[napi]
    pub fn unlock(&mut self) -> anyhow::Result<()> {
        if !self.locked {
            anyhow::bail!("File {} is not locked", self.lock_file_path)
        }
        fs::remove_file(&self.lock_file_path).or_else(|err| {
            if err.kind() == io::ErrorKind::NotFound {
                Ok(())
            } else {
                Err(err)
            }
        })?;
        self.locked = false;
        Ok(())
    }

    #[napi]
    pub async fn wait(&self) -> Result<(), napi::Error> {
        if !self.locked {
            return Ok(());
        }

        loop {
            if !self.locked || !Path::new(&self.lock_file_path).exists() {
                break Ok(());
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}

// Ensure the lock file is removed when the FileLock is dropped
impl Drop for FileLock {
    fn drop(&mut self) {
        if self.locked {
            let _ = self.unlock();
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    use assert_fs::prelude::*;
    use assert_fs::TempDir;

    #[test]
    fn test_new_lock() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let lock_file_path = lock_file.path().to_path_buf();
        let lock_file_path_str = lock_file_path.into_os_string().into_string().unwrap();
        let mut file_lock = FileLock::new(lock_file_path_str);
        assert_eq!(file_lock.locked, false);
        let _ = file_lock.lock();
        assert_eq!(file_lock.locked, true);
        assert!(lock_file.exists());
        let _ = file_lock.unlock();
        assert_eq!(lock_file.exists(), false);
    }

    #[tokio::test]
    async fn test_wait() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let lock_file_path = lock_file.path().to_path_buf();
        let lock_file_path_str = lock_file_path.into_os_string().into_string().unwrap();
        let mut file_lock = FileLock::new(lock_file_path_str);
        let _ = file_lock.lock();
        let file_lock_clone = file_lock.clone();
        let wait_fut = async move {
            let _ = file_lock_clone.wait().await;
        };
        let _ = tokio::runtime::Runtime::new().unwrap().block_on(wait_fut);
        assert_eq!(file_lock.locked, false);
        assert_eq!(lock_file.exists(), false);
    }

    #[test]
    fn test_drop() {
        let tmp_dir = TempDir::new().unwrap();
        let lock_file = tmp_dir.child("test_lock_file");
        let lock_file_path = lock_file.path().to_path_buf();
        let lock_file_path_str = lock_file_path.into_os_string().into_string().unwrap();
        {
            let mut file_lock = FileLock::new(lock_file_path_str.clone());
            let _ = file_lock.lock();
        }
        assert_eq!(lock_file.exists(), false);
    }
}
