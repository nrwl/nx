use std::path::Path;
use std::sync::Arc;

use anyhow::anyhow;
use interprocess::{
    bound_util::{RefTokioAsyncRead, RefTokioAsyncWrite},
    local_socket::{
        GenericFilePath, ToFsName,
        tokio::{Stream, prelude::*},
    },
};
use jsonrpsee::core::client::{ReceivedMessage, TransportReceiverT, TransportSenderT};
use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Debug, Error)]
#[error(transparent)]
pub struct IpcError(#[from] anyhow::Error);

pub struct IpcTransport {
    pub reader: IpcTransportReceiver,
    pub writer: IpcTransportSender,
}
impl IpcTransport {
    pub async fn new(socket_path: &Path) -> Result<Self, anyhow::Error> {
        let socket_path = socket_path.to_fs_name::<GenericFilePath>()?;
        let conn = Stream::connect(socket_path).await?;
        let stream = Arc::new(conn);
        let writer = IpcTransportSender(Arc::clone(&stream));
        let reader = IpcTransportReceiver(Arc::clone(&stream));
        Ok(Self { reader, writer })
    }
}

pub struct IpcTransportSender(Arc<Stream>);
pub struct IpcTransportReceiver(Arc<Stream>);

const NEW_LINE: &str = "\r\n";

impl TransportSenderT for IpcTransportSender {
    type Error = IpcError;

    async fn send(&mut self, msg: String) -> Result<(), Self::Error> {
        let mut stream = self.0.as_tokio_async_write();
        let headers = format!("content-length: {}{}{}", msg.len(), NEW_LINE, NEW_LINE);
        stream
            .write_all(headers.as_bytes())
            .await
            .map_err(anyhow::Error::from)?;
        stream.flush().await.map_err(anyhow::Error::from)?;
        let mut msg = msg;
        msg.push_str(NEW_LINE);
        msg.push_str(NEW_LINE);
        stream
            .write_all(msg.as_bytes())
            .await
            .map_err(anyhow::Error::from)?;
        stream.flush().await.map_err(anyhow::Error::from)?;
        Ok(())
    }
}

impl TransportReceiverT for IpcTransportReceiver {
    type Error = IpcError;

    async fn receive(&mut self) -> Result<ReceivedMessage, Self::Error> {
        let mut stream = self.0.as_tokio_async_read();
        let mut response_data = Vec::new();
        let mut buffer = [0u8; 1024];

        loop {
            let bytes_read = stream
                .read(buffer.as_mut())
                .await
                .map_err(anyhow::Error::from)?;
            if bytes_read == 0 {
                break;
            }
            response_data.extend_from_slice(&buffer[..bytes_read]);

            if let Ok(response_str) = String::from_utf8(response_data.clone()) {
                if response_str.contains('\n') {
                    let parts: Vec<&str> = response_str.split('\n').collect();
                    if let Some(response_part) = parts.first() {
                        return Ok(ReceivedMessage::Text(response_part.to_string()));
                    }
                }
            }
        }

        Err(anyhow!("Failed to read from IPC stream").into())
    }
}

#[cfg(test)]
mod test_utils {
    use super::*;
    use std::time::Duration;
    use std::{future::Future, path::PathBuf};
    use tokio::task;

    // Define trait for platform-specific test setup
    pub trait IpcTestSetup {
        type ServerHandle: Sized;
        type ServerSocket: AsyncReadExt + AsyncWriteExt + Unpin;
        type AcceptFuture: Future<Output = Self::ServerSocket> + Send;
        type ConnectFuture: Future<Output = Result<IpcTransport, anyhow::Error>> + Send;

        // Setup connection paths
        fn create_connection_path() -> (PathBuf, PathBuf);

        // Create server
        fn create_server(path: &PathBuf) -> Self::ServerHandle;

        // Accept client connection
        fn accept_connection(handle: &mut Self::ServerHandle) -> Self::AcceptFuture;

        // Connect client
        fn connect_client(path: PathBuf) -> Self::ConnectFuture;
    }

    // Common test implementations
    pub async fn test_ipc_transport_connection<T: IpcTestSetup>() {
        let (server_path, client_path) = T::create_connection_path();

        // Create a mock server
        let mut server = T::create_server(&server_path);

        // Connect in a separate task
        let client_task = task::spawn(async move {
            // Small delay to ensure server is ready
            tokio::time::sleep(Duration::from_millis(100)).await;
            T::connect_client(client_path).await
        });

        // Accept the connection
        T::accept_connection(&mut server).await;

        let result = client_task.await.unwrap();
        assert!(result.is_ok());
    }

    pub async fn test_transport_sender_send<T: IpcTestSetup>() {
        let (server_path, client_path) = T::create_connection_path();

        // Create a mock server
        let mut server = T::create_server(&server_path);

        // Start client in background
        let client_task = task::spawn(async move {
            let mut transport = T::connect_client(client_path).await.unwrap();
            transport.writer.send("test message".to_string()).await
        });

        // Accept the connection and read the message
        let mut socket = T::accept_connection(&mut server).await;
        let mut buf = [0u8; 1024];
        let n = socket.read(&mut buf).await.unwrap();
        let received = String::from_utf8_lossy(&buf[0..n]);

        assert!(received.contains("content-length: 12"));

        let result = client_task.await.unwrap();
        assert!(result.is_ok());
    }

    pub async fn test_transport_receiver_receive<T: IpcTestSetup>() {
        let (server_path, client_path) = T::create_connection_path();

        // Create a mock server
        let mut server = T::create_server(&server_path);

        // Start client in background
        let client_task = task::spawn(async move {
            let mut transport = T::connect_client(client_path).await.unwrap();
            transport.reader.receive().await
        });

        // Accept connection and send a message
        let mut socket = T::accept_connection(&mut server).await;
        let message = "test\nresponse";
        socket.write_all(message.as_bytes()).await.unwrap();
        socket.flush().await.unwrap();

        let result = client_task.await.unwrap();
        assert!(result.is_ok());
        if let Ok(ReceivedMessage::Text(text)) = result {
            assert_eq!(text, "test");
        } else {
            panic!("Expected Text message");
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::test_utils::*;
    use super::*;
    use std::pin::Pin;
    use std::{future::Future, path::PathBuf};
    use tempfile::NamedTempFile;
    use tokio::net::UnixListener;

    struct UnixIpcTestSetup;

    // Define concrete future types
    type AcceptConnectionFuture = Pin<Box<dyn Future<Output = tokio::net::UnixStream> + Send>>;
    type ConnectClientFuture =
        Pin<Box<dyn Future<Output = Result<IpcTransport, anyhow::Error>> + Send>>;

    impl IpcTestSetup for UnixIpcTestSetup {
        type ServerHandle = UnixListener;
        type ServerSocket = tokio::net::UnixStream;
        type AcceptFuture = AcceptConnectionFuture;
        type ConnectFuture = ConnectClientFuture;

        fn create_connection_path() -> (PathBuf, PathBuf) {
            let temp_file = NamedTempFile::new().unwrap();
            let socket_path = temp_file.path().to_path_buf();
            std::fs::remove_file(&socket_path).unwrap_or(());
            (socket_path.clone(), socket_path)
        }

        fn create_server(path: &PathBuf) -> Self::ServerHandle {
            UnixListener::bind(path).unwrap()
        }

        fn accept_connection(handle: &mut Self::ServerHandle) -> Self::AcceptFuture {
            // Take ownership of the listener and create a new one for subsequent calls
            let path = std::env::temp_dir().join(format!("socket-{}", uuid::Uuid::new_v4()));
            std::fs::remove_file(&path).unwrap_or(());
            let old_listener = std::mem::replace(handle, UnixListener::bind(&path).unwrap());

            Box::pin(async move {
                let (socket, _) = old_listener.accept().await.unwrap();
                socket
            })
        }

        fn connect_client(path: PathBuf) -> Self::ConnectFuture {
            Box::pin(async move { IpcTransport::new(&path).await })
        }
    }

    #[tokio::test]
    async fn test_ipc_transport_connection() {
        test_utils::test_ipc_transport_connection::<UnixIpcTestSetup>().await;
    }

    #[tokio::test]
    async fn test_transport_sender_send() {
        test_utils::test_transport_sender_send::<UnixIpcTestSetup>().await;
    }

    #[tokio::test]
    async fn test_transport_receiver_receive() {
        test_utils::test_transport_receiver_receive::<UnixIpcTestSetup>().await;
    }
}

#[cfg(all(test, windows))]
mod tests_windows {
    use super::test_utils::*;
    use super::*;
    use std::future::Future;
    use std::pin::Pin;
    use tempfile::NamedTempFile;
    use tokio::net::windows::named_pipe::{ClientOptions, ServerOptions};
    use uuid::Uuid;

    struct WindowsIpcTestSetup;

    // Define concrete future types
    type AcceptConnectionFuture =
        Pin<Box<dyn Future<Output = tokio::net::windows::named_pipe::NamedPipeServer> + Send>>;
    type ConnectClientFuture =
        Pin<Box<dyn Future<Output = Result<IpcTransport, anyhow::Error>> + Send>>;

    impl IpcTestSetup for WindowsIpcTestSetup {
        type ServerHandle = (ServerOptions, PathBuf);
        type ServerSocket = tokio::net::windows::named_pipe::NamedPipeServer;
        type AcceptFuture = AcceptConnectionFuture;
        type ConnectFuture = ConnectClientFuture;

        fn create_connection_path() -> (PathBuf, PathBuf) {
            let pipe_name = format!(r"\\.\pipe\test-{}", Uuid::new_v4());
            (pipe_name.clone().into(), pipe_name.into())
        }

        fn create_server(path: &PathBuf) -> Self::ServerHandle {
            (ServerOptions::new().first_pipe_instance(true), path.clone())
        }

        fn accept_connection(handle: &mut Self::ServerHandle) -> Self::AcceptFuture {
            let (options, path) = handle;
            let path_clone = path.clone();
            Box::pin(async move {
                let path_str = path_clone.to_str().unwrap();
                let server = options.create(path_str).unwrap();
                server.connect().await.unwrap();
                server
            })
        }

        fn connect_client(path: PathBuf) -> Self::ConnectFuture {
            Box::pin(async move { IpcTransport::new(path).await })
        }
    }

    #[tokio::test]
    async fn test_ipc_transport_connection() {
        test_utils::test_ipc_transport_connection::<WindowsIpcTestSetup>().await;
    }

    #[tokio::test]
    async fn test_transport_sender_send() {
        test_utils::test_transport_sender_send::<WindowsIpcTestSetup>().await;
    }

    #[tokio::test]
    async fn test_transport_receiver_receive() {
        test_utils::test_transport_receiver_receive::<WindowsIpcTestSetup>().await;
    }
}
