use crate::error::Result;
use std::path::Path;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;
#[cfg(windows)]
use tokio::net::windows::named_pipe::ClientOptions;

/// Wrapper around socket connection to daemon
pub struct DaemonSocket {
    #[cfg(unix)]
    stream: UnixStream,
    #[cfg(windows)]
    stream: tokio::net::windows::named_pipe::NamedPipeClient,
}

impl DaemonSocket {
    /// Connect to daemon at given socket path
    pub async fn connect<P: AsRef<Path>>(socket_path: P) -> Result<Self> {
        let path = socket_path.as_ref().to_string_lossy().to_string();

        #[cfg(unix)]
        {
            let stream = UnixStream::connect(&path)
                .await
                .map_err(|e| crate::error::DaemonClientError::ConnectionError(e.to_string()))?;
            Ok(DaemonSocket { stream })
        }

        #[cfg(windows)]
        {
            let stream = ClientOptions::new()
                .open(&path)
                .map_err(|e| crate::error::DaemonClientError::ConnectionError(e.to_string()))?;
            Ok(DaemonSocket { stream })
        }

        #[cfg(not(any(unix, windows)))]
        {
            Err(crate::error::DaemonClientError::ConnectionError(
                "Unsupported platform".to_string(),
            ))
        }
    }

    /// Send message to daemon
    pub async fn send(&mut self, message: &[u8]) -> Result<()> {
        self.stream.write_all(message).await?;
        self.stream.flush().await?;
        Ok(())
    }

    /// Receive message from daemon
    pub async fn receive(&mut self, buf: &mut [u8]) -> Result<usize> {
        let n = self.stream.read(buf).await?;
        if n == 0 {
            return Err(crate::error::DaemonClientError::ConnectionClosed);
        }
        Ok(n)
    }

    /// Close the socket connection
    pub async fn close(&mut self) -> Result<()> {
        #[cfg(unix)]
        {
            self.stream.shutdown().await.ok();
        }
        #[cfg(windows)]
        {
            // Windows named pipes don't have a shutdown method
            drop(&mut self.stream);
        }
        Ok(())
    }
}

/// Get the daemon socket path based on OS and workspace root
pub fn get_socket_path(workspace_root: &str) -> String {
    // Hash the workspace root to create a unique identifier
    let hash = hash_string(workspace_root);

    if cfg!(windows) {
        format!(r"\\?\pipe\nx-daemon-{}", hash)
    } else {
        // Unix-like systems
        let temp_dir = std::env::var("NX_SOCKET_DIR")
            .or_else(|_| std::env::var("NX_DAEMON_SOCKET_DIR"))
            .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());

        format!("{}/nx-daemon-{}.sock", temp_dir, hash)
    }
}

/// Simple hash function for workspace root
fn hash_string(s: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    let hash = hasher.finish();
    format!("{:x}", hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_socket_path_unix() {
        let path = get_socket_path("/home/user/project");
        assert!(path.ends_with(".sock"));
        assert!(path.starts_with("/tmp/") || path.contains("/nx-daemon-"));
    }

    #[test]
    fn test_socket_path_consistent() {
        let path1 = get_socket_path("/home/user/project");
        let path2 = get_socket_path("/home/user/project");
        assert_eq!(path1, path2);
    }
}
