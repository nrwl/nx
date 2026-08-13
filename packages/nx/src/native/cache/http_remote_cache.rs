use std::{
    env,
    fs::{self},
    io::Read,
    path::Path,
};

use super::{
    cache::CachedResult,
    errors::{HttpRemoteCacheErrors, convert_request_error, convert_response_to_error},
};
use flate2::Compression;
use reqwest::{Client, ClientBuilder, StatusCode, header};
use std::time::Duration;
use tar::{Archive, Builder};
use tracing::trace;

/// How long to wait for the TCP connect and TLS handshake.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Budget for a download, and not a total deadline. `read_timeout` runs flat
/// until response headers arrive, then resets on every body frame, so a large
/// artifact is bounded by its slowest gap rather than by its size. Sized for the
/// flat half: a server that buffers the whole artifact before writing a byte.
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(120);

/// Budget for an upload. Deliberately generous: until response headers arrive,
/// `read_timeout` has nothing to reset against, so for a PUT it behaves as a
/// deadline covering "send the whole body and hear back". Sizing it for the
/// largest realistic artifact is what keeps a slow-but-healthy upload alive.
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(600);

#[napi]
pub struct HttpRemoteCache {
    /// Separate clients because `read_timeout` is only configurable per-client,
    /// and uploads need a far larger budget than downloads.
    download_client: Client,
    upload_client: Client,
    url: String,
}

#[napi]
impl HttpRemoteCache {
    #[napi(constructor)]
    pub fn new() -> Self {
        let mut headers = header::HeaderMap::new();
        let auth_token = env::var("NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN");
        if let Ok(token) = auth_token {
            headers.insert(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&format!("Bearer {}", token))
                    .expect("from_str should not throw here."),
            );
        }

        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/octet-stream"),
        );

        // Opt-out for servers whose legitimate transfers outrun our budgets.
        // Without timeouts a server that accepts a connection and never replies
        // parks the request forever, which stalls the whole run after every
        // task has already finished.
        let timeouts_disabled = env::var("NX_SELF_HOSTED_REMOTE_CACHE_NO_TIMEOUTS").is_ok();

        let build_client = |read_timeout: Duration| {
            // Keep the system resolver here. Enabling reqwest's `hickory-dns`
            // feature for the telemetry client flips the default for every
            // client in the crate, and this URL is user-supplied: it may
            // resolve through NSS rather than plain DNS (mDNS, LDAP,
            // split-horizon corporate setups) which hickory does not consult.
            // Only the telemetry endpoint is a fixed public hostname where
            // that trade is safe.
            let mut client_builder = ClientBuilder::new()
                .no_hickory_dns()
                .default_headers(headers.clone());

            if !timeouts_disabled {
                client_builder = client_builder
                    .connect_timeout(CONNECT_TIMEOUT)
                    .read_timeout(read_timeout);
            }

            let env_accept_unauthorized = env::var("NODE_TLS_REJECT_UNAUTHORIZED");
            if let Ok(env_accept_unauthorized) = env_accept_unauthorized {
                if env_accept_unauthorized == "0" {
                    client_builder = client_builder.danger_accept_invalid_certs(true);
                }
            }

            client_builder
                .build()
                .expect("Failed to create HTTP client")
        };

        HttpRemoteCache {
            download_client: build_client(DOWNLOAD_TIMEOUT),
            upload_client: build_client(UPLOAD_TIMEOUT),
            url: env::var("NX_SELF_HOSTED_REMOTE_CACHE_SERVER")
                .expect("NX_REMOTE_CACHE_URL must be set"),
        }
    }

    #[napi]
    pub async fn retrieve(
        &self,
        hash: String,
        cache_directory: String,
    ) -> napi::Result<Option<CachedResult>> {
        let span = tracing::trace_span!("retrieve", hash = %hash);
        let _guard = span.enter();

        let url: String = format!("{}/v1/cache/{}", self.url, hash);
        let response = self
            .download_client
            .get(&url)
            .header("Accept", "application/octet-stream")
            .send()
            .await;
        match response {
            Ok(resp) => {
                trace!("HTTP response status: {}", resp.status());
                let status = resp.status();

                match status {
                    StatusCode::OK => {
                        Ok(Some(
                            // response is an application/octet-stream containing a tarball
                            // we need to extract the tarball and return the path to the extracted files
                            Self::download_and_extract_from_result(resp, cache_directory, hash)
                                .await?,
                        ))
                    }
                    StatusCode::NOT_FOUND => Ok(None),
                    _ => Err(convert_response_to_error(resp).await.into()),
                }
            }
            Err(e) => Err(convert_request_error(&e, false).into()),
        }
    }

    #[napi]
    pub async fn store(
        &self,
        hash: String,
        cache_directory: String,
        terminal_output: String,
        code: u32,
    ) -> napi::Result<bool> {
        let span = tracing::trace_span!("store", hash = %hash);
        let _guard = span.enter();

        // We can change the creation of the tar in a future version without
        // worrying about breaking existing user cache's, because when the
        // user updates their task's hashes will be changed... so users
        // retrieving old hashes will not be affected, and new entries
        // will have distinct hashes.

        // create a tarball in memory from the cache dir
        let tar_gz: Vec<u8> = Vec::new();
        let enc = flate2::write::GzEncoder::new(tar_gz, Compression::default());
        let mut archive = Builder::new(enc);
        archive.follow_symlinks(false);
        trace!("Created tar file for writing");

        let cache_path = Path::new(&cache_directory);
        let outputs_path = cache_path.join(&hash);

        trace!("Adding cache artifacts to tarball");
        archive.append_dir_all("", &outputs_path)?;
        trace!("Added cache directory to tarball");

        trace!("Adding terminal output to tarball");
        let mut terminal_output_header = tar::Header::new_old();
        let terminal_output_bytes = terminal_output.as_bytes();
        terminal_output_header.set_size(terminal_output_bytes.len() as u64);
        terminal_output_header.set_cksum(); // Ensure the checksum is set correctly
        archive.append_data(
            &mut terminal_output_header,
            "terminalOutput",
            terminal_output_bytes,
        )?;
        trace!("Added terminal output to tarball");

        trace!("Adding code to tarball");
        let mut code_header = tar::Header::new_old();
        code_header.set_size(4);
        code_header.set_cksum(); // Ensure the checksum is set correctly
        archive.append_data(&mut code_header, "code", &code.to_be_bytes()[..])?;
        trace!("Added code to tarball");

        trace!("Finishing tarball");
        archive
            .finish() // Finish the archive to get the inner bytes
            .map_err(|e| anyhow::anyhow!(format!("Failed to finish tarball: {}", e)))?;
        trace!("Finished tarball");

        trace!("Reading tarball into memory");
        let archive_bytes = archive.into_inner()?;
        let buffer = archive_bytes.finish()?;
        trace!("read tarball into memory");

        let url: String = format!("{}/v1/cache/{}", self.url, hash);
        let response = self
            .upload_client
            .put(&url)
            .body(buffer) // Convert the bytes to a Vec<u8> for the request body
            .send()
            .await
            .map_err(|e| napi::Error::from(convert_request_error(&e, true)))?;

        match response.status() {
            StatusCode::OK => Ok(true),
            // Cache entry already exists, silently do not store new data
            StatusCode::CONFLICT => Ok(false),
            // User is authorized but server does not allow
            // cache storage for whatever reason (e.g. read-only token.)
            StatusCode::FORBIDDEN => Ok(false),
            _ => Err(convert_response_to_error(response).await.into()),
        }
    }

    async fn download_and_extract_from_result(
        response: reqwest::Response,
        cache_directory: String,
        hash: String,
    ) -> Result<CachedResult, HttpRemoteCacheErrors> {
        let content = response.bytes().await.map_err(|e| {
            // The response body stopped mid-stream. Attributable to the server,
            // and safe to rebuild from, so it reads as damage rather than malice.
            convert_request_error(&e, false)
        })?;
        trace!("Downloaded {} bytes from remote cache", content.len());
        Self::extract_tarball(content.as_ref(), &cache_directory, &hash)
    }

    /// Extract a gzipped cache tarball into `<cache_directory>/<hash>`.
    ///
    /// Uses `tar`'s `unpack_in` so a malicious cache server can't escape
    /// `output_dir` via `..`, absolute paths, or symlinks.
    ///
    /// Failures are split by what they imply about the server. An archive we
    /// cannot parse is `CorruptArtifact` — most often a partial upload the
    /// server committed anyway — and the caller may fall back to rebuilding.
    /// An archive that tries to write outside `output_dir` is `UnsafeArtifact`
    /// and always stops the run, because a cache server behaving that way is
    /// not something to silently work around.
    fn extract_tarball(
        content: &[u8],
        cache_directory: &str,
        hash: &str,
    ) -> Result<CachedResult, HttpRemoteCacheErrors> {
        let tar = flate2::read::GzDecoder::new(content);
        let mut archive = Archive::new(tar);
        let entries = archive.entries().map_err(|e| {
            HttpRemoteCacheErrors::CorruptArtifact(format!(
                "failed to read entries from tarball: {}",
                e
            ))
        })?;

        let mut code: Option<i16> = None;
        let mut terminal_output: Option<String> = None;
        let mut size: i64 = 0;

        let output_dir = Path::new(cache_directory).join(hash);
        // `unpack_in` canonicalizes `output_dir`, so it must exist beforehand.
        fs::create_dir_all(&output_dir).map_err(|e| {
            HttpRemoteCacheErrors::LocalCacheError(format!(
                "failed to create {}: {}",
                output_dir.display(),
                e
            ))
        })?;

        // Extract the archive to the specified cache directory
        for entry in entries {
            let mut entry = entry.map_err(|e| {
                HttpRemoteCacheErrors::CorruptArtifact(format!(
                    "failed to read entry from tarball: {}",
                    e
                ))
            })?;

            let entry_path = entry
                .path()
                .map_err(|e| {
                    HttpRemoteCacheErrors::CorruptArtifact(format!(
                        "invalid entry path in cache artifact: {}",
                        e
                    ))
                })?
                .to_string_lossy()
                .into_owned();

            if entry_path == "code" {
                let code_file_bytes =
                    entry.bytes().collect::<Result<Vec<u8>, _>>().map_err(|e| {
                        HttpRemoteCacheErrors::CorruptArtifact(format!(
                            "failed to read exit code from cache artifact: {}",
                            e
                        ))
                    })?;
                // The exit code is stored as a 4-byte big-endian integer (see `store`).
                let code_bytes: [u8; 4] = code_file_bytes.as_slice().try_into().map_err(|_| {
                    HttpRemoteCacheErrors::CorruptArtifact(
                        "invalid exit code in cache artifact".to_string(),
                    )
                })?;
                code = Some(u32::from_be_bytes(code_bytes) as i16);
                trace!("Retrieved exit code from cache: {}", code.unwrap());
            } else if entry_path == "terminalOutput" {
                let terminal_output_bytes =
                    entry.bytes().collect::<Result<Vec<u8>, _>>().map_err(|e| {
                        HttpRemoteCacheErrors::CorruptArtifact(format!(
                            "failed to read terminal output from cache artifact: {}",
                            e
                        ))
                    })?;
                let terminal_output_size = terminal_output_bytes.len();

                terminal_output = Some(String::from_utf8(terminal_output_bytes).map_err(|e| {
                    HttpRemoteCacheErrors::CorruptArtifact(format!(
                        "terminal output in cache artifact is not valid UTF-8: {}",
                        e
                    ))
                })?);
                size += terminal_output_size as i64;

                trace!(
                    "Retrieved terminal output from cache: {} bytes",
                    terminal_output_size
                );
            } else {
                trace!(
                    "Extracting entry {} into {}",
                    entry_path,
                    output_dir.display()
                );
                let is_file = entry.header().entry_type().is_file();
                let entry_size = entry.size();
                // Reject entries `unpack_in` skips (`..`) or refuses (symlink escape).
                let unpacked = entry.unpack_in(&output_dir).map_err(|e| {
                    HttpRemoteCacheErrors::UnsafeArtifact(format!(
                        "failed to unpack entry {}: {}",
                        entry_path, e
                    ))
                })?;
                if !unpacked {
                    return Err(HttpRemoteCacheErrors::UnsafeArtifact(format!(
                        "refusing to extract cache entry with unsafe path: {}",
                        entry_path
                    )));
                }
                if is_file {
                    size += entry_size as i64;
                }
            }
        }

        trace!("Extracted tarball to {}", output_dir.display());

        let code = code.ok_or_else(|| {
            HttpRemoteCacheErrors::CorruptArtifact(
                "exit code not found in cache artifact".to_string(),
            )
        })?;
        Ok(CachedResult {
            terminal_output,
            code,
            outputs_path: output_dir.to_string_lossy().into_owned(),
            size: Some(size),
        })
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::TempDir;
    use flate2::Compression;
    use flate2::write::GzEncoder;
    use tar::{Builder, EntryType, Header};

    /// Forge a tar entry, writing `name` straight into the header to bypass the
    /// `tar` Builder's `..`/absolute-path validation, like a hostile server.
    fn raw_entry(name: &str, ty: EntryType, link: Option<&str>, data: &[u8]) -> (Header, Vec<u8>) {
        let mut header = Header::new_ustar();
        header.set_size(data.len() as u64);
        header.set_entry_type(ty);
        header.set_mode(0o644);
        header.set_mtime(0);
        if let Some(target) = link {
            header.set_link_name(target).unwrap();
        }
        let name_bytes = name.as_bytes();
        header.as_mut_bytes()[..name_bytes.len()].copy_from_slice(name_bytes);
        header.set_cksum();
        (header, data.to_vec())
    }

    fn code_entry(code: u32) -> (Header, Vec<u8>) {
        raw_entry("code", EntryType::Regular, None, &code.to_be_bytes())
    }

    fn terminal_output_entry(output: &str) -> (Header, Vec<u8>) {
        raw_entry(
            "terminalOutput",
            EntryType::Regular,
            None,
            output.as_bytes(),
        )
    }

    fn build_tar_gz(entries: Vec<(Header, Vec<u8>)>) -> Vec<u8> {
        let mut builder = Builder::new(GzEncoder::new(Vec::new(), Compression::default()));
        for (header, data) in &entries {
            builder.append(header, data.as_slice()).unwrap();
        }
        builder.into_inner().unwrap().finish().unwrap()
    }

    #[test]
    fn extract_rejects_parent_dir_traversal() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        // `../../escape.txt` from <cache>/123 resolves to <temp>/escape.txt.
        let tar = build_tar_gz(vec![raw_entry(
            "../../escape.txt",
            EntryType::Regular,
            None,
            b"PWNED",
        )]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            matches!(result, Err(HttpRemoteCacheErrors::UnsafeArtifact(_))),
            "a `..` entry must be rejected as unsafe, not treated as damage: {:?}",
            result.err()
        );
        assert!(
            !temp.join("escape.txt").exists(),
            "extraction must not write outside the cache directory"
        );
    }

    #[test]
    fn extract_contains_absolute_paths() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let abs_target = temp.join("outside").join("pwned.txt");
        let tar = build_tar_gz(vec![
            raw_entry(
                abs_target.to_str().unwrap(),
                EntryType::Regular,
                None,
                b"PWNED",
            ),
            code_entry(0),
            terminal_output_entry("done"),
        ]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        // Absolute paths are stripped to relative, so extraction is contained, not rejected.
        assert!(
            result.is_ok(),
            "absolute paths should be contained, not error: {:?}",
            result.err()
        );
        assert!(
            !abs_target.exists(),
            "an absolute entry must not escape the cache directory"
        );
    }

    #[cfg(unix)]
    #[test]
    fn extract_rejects_symlink_escape() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let outside = temp.join("outside");
        std::fs::create_dir_all(&outside).unwrap();

        // `evil` -> <temp>/outside, then `evil/pwned.txt` would escape if followed.
        let tar = build_tar_gz(vec![
            raw_entry(
                "evil",
                EntryType::Symlink,
                Some(outside.to_str().unwrap()),
                b"",
            ),
            raw_entry("evil/pwned.txt", EntryType::Regular, None, b"PWNED"),
        ]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            matches!(result, Err(HttpRemoteCacheErrors::UnsafeArtifact(_))),
            "writing through a symlink must be rejected as unsafe: {:?}",
            result.err()
        );
        assert!(
            !outside.join("pwned.txt").exists(),
            "extraction must not write through a symlink out of the cache directory"
        );
    }

    #[test]
    fn extract_unpacks_legitimate_tarball() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let tar = build_tar_gz(vec![
            raw_entry("dist/main.js", EntryType::Regular, None, b"console.log(1)"),
            code_entry(0),
            terminal_output_entry("build complete"),
        ]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123")
            .expect("legitimate tarball should extract");

        assert_eq!(result.code, 0);
        assert_eq!(result.terminal_output.as_deref(), Some("build complete"));
        let extracted = cache_dir.join("123").join("dist").join("main.js");
        assert!(extracted.exists(), "expected extracted output file");
        assert_eq!(
            std::fs::read_to_string(&extracted).unwrap(),
            "console.log(1)"
        );
        assert_eq!(
            result.size,
            Some(("build complete".len() + "console.log(1)".len()) as i64)
        );
    }

    #[cfg(unix)]
    #[test]
    fn extract_rejects_hardlink_escape() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        // A file outside the cache dir the hardlink entry tries to reach.
        let outside = temp.join("outside.txt");
        std::fs::write(&outside, b"secret").unwrap();

        // A hard link entry whose target points outside output_dir.
        let tar = build_tar_gz(vec![raw_entry(
            "evil",
            EntryType::Link,
            Some(outside.to_str().unwrap()),
            b"",
        )]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            matches!(result, Err(HttpRemoteCacheErrors::UnsafeArtifact(_))),
            "a hardlink escaping the cache dir must be rejected as unsafe: {:?}",
            result.err()
        );
    }

    #[test]
    fn extract_rejects_short_code_entry() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let tar = build_tar_gz(vec![raw_entry("code", EntryType::Regular, None, b"\0")]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            matches!(result, Err(HttpRemoteCacheErrors::CorruptArtifact(_))),
            "a short code entry is damage, so the run can still fall back: {:?}",
            result.err()
        );
    }

    #[test]
    fn extract_rejects_missing_code_entry() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let tar = build_tar_gz(vec![terminal_output_entry("done")]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            matches!(result, Err(HttpRemoteCacheErrors::CorruptArtifact(_))),
            "a missing code entry is damage, so the run can still fall back: {:?}",
            result.err()
        );
    }

    /// The fatal/recoverable split is what `cache.ts` keys off, so assert it
    /// directly rather than only through the extraction tests above.
    #[test]
    fn damage_is_recoverable_and_malice_is_fatal() {
        let recoverable = [
            HttpRemoteCacheErrors::RequestError("reset".into()),
            HttpRemoteCacheErrors::DownloadTimeout("stalled".into()),
            HttpRemoteCacheErrors::UploadTimeout("stalled".into()),
            HttpRemoteCacheErrors::CorruptArtifact("truncated".into()),
        ];
        for err in recoverable {
            assert!(
                !err.is_fatal(),
                "{} should degrade to a cache miss",
                err.as_ref()
            );
        }

        let fatal = [
            HttpRemoteCacheErrors::Unauthorized("bad token".into()),
            HttpRemoteCacheErrors::Misconfigured("wrong endpoint".into()),
            HttpRemoteCacheErrors::UnsafeArtifact("../escape".into()),
            HttpRemoteCacheErrors::LocalCacheError("disk full".into()),
        ];
        for err in fatal {
            assert!(err.is_fatal(), "{} should stop the run", err.as_ref());
        }
    }

    /// A stalled server is the failure mode behind #36640: it accepts the
    /// connection and then goes silent. Without a read timeout this blocks
    /// forever; with one it must come back as a recoverable timeout.
    #[tokio::test]
    async fn retrieve_times_out_against_a_stalled_server() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        // Accept and hold the connection open without ever writing a response.
        std::thread::spawn(move || {
            let held: Vec<_> = listener.incoming().filter_map(Result::ok).take(1).collect();
            std::thread::sleep(Duration::from_secs(30));
            drop(held);
        });

        let client = ClientBuilder::new()
            .connect_timeout(CONNECT_TIMEOUT)
            .read_timeout(Duration::from_millis(250))
            .build()
            .unwrap();

        let err = client
            .get(format!("http://{}/v1/cache/abc", addr))
            .send()
            .await
            .expect_err("a silent server must not block indefinitely");

        assert!(err.is_timeout(), "expected a timeout, got {:?}", err);
        assert!(
            !convert_request_error(&err, false).is_fatal(),
            "a stalled cache server should degrade to a miss, not fail the run"
        );
    }

    #[test]
    fn extract_reads_full_exit_code() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        // The code is stored as a 4-byte big-endian int; the reader must consume
        // all 4 bytes rather than truncating a nonzero code to 0.
        let tar = build_tar_gz(vec![code_entry(1)]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123")
            .expect("a valid code entry should extract");

        assert_eq!(
            result.code, 1,
            "exit code must round-trip, not truncate to 0"
        );
    }
}
