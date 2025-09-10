use std::env;
use std::path::PathBuf;

/// Get the user's home directory path in a cross-platform way
pub fn get_home_dir() -> anyhow::Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        env::var("USERPROFILE")
            .or_else(|_| {
                // Fallback to HOMEDRIVE + HOMEPATH on Windows
                let drive = env::var("HOMEDRIVE")?;
                let path = env::var("HOMEPATH")?;
                Ok(format!("{}{}", drive, path))
            })
            .map(PathBuf::from)
            .map_err(|_| anyhow::anyhow!("Could not determine user home directory on Windows"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        env::var("HOME")
            .map(PathBuf::from)
            .map_err(|_| anyhow::anyhow!("Could not determine user home directory"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_home_dir() {
        let home = get_home_dir().expect("Should be able to get home directory");
        assert!(home.exists(), "Home directory should exist");
        assert!(home.is_dir(), "Home directory should be a directory");
    }
}
