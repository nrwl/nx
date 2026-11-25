use std::{
    cell::Cell,
    env,
    fs::{self},
    io::{self, Read},
    path::{Component, Path},
};

use super::{
    cache::CachedResult,
    errors::{
        HttpRemoteCacheErrors, convert_request_error, convert_response_to_error,
        report_request_error,
    },
};
use flate2::Compression;
use reqwest::{Client, ClientBuilder, StatusCode, header};
use std::time::Duration;
use tar::{Archive, Builder};
use tracing::{Instrument, trace};

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
        Self::with_read_timeouts(
            env::var("NX_SELF_HOSTED_REMOTE_CACHE_SERVER")
                .expect("NX_REMOTE_CACHE_URL must be set"),
            DOWNLOAD_TIMEOUT,
            UPLOAD_TIMEOUT,
        )
    }

    fn with_read_timeouts(
        url: String,
        download_timeout: Duration,
        upload_timeout: Duration,
    ) -> Self {
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
            download_client: build_client(download_timeout),
            upload_client: build_client(upload_timeout),
            url,
        }
    }

    #[napi]
    pub async fn retrieve(
        &self,
        hash: String,
        cache_directory: String,
    ) -> napi::Result<Option<CachedResult>> {
        let span = tracing::trace_span!("retrieve", hash = %hash);
        self.retrieve_inner(hash, cache_directory)
            .instrument(span)
            .await
    }

    async fn retrieve_inner(
        &self,
        hash: String,
        cache_directory: String,
    ) -> napi::Result<Option<CachedResult>> {
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
        self.store_inner(hash, cache_directory, terminal_output, code)
            .instrument(span)
            .await
    }

    async fn store_inner(
        &self,
        hash: String,
        cache_directory: String,
        terminal_output: String,
        code: u32,
    ) -> napi::Result<bool> {
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
    /// not something to silently work around. A disk that refuses a write is
    /// `LocalCacheError`, which also stops the run but blames the machine.
    fn extract_tarball(
        content: &[u8],
        cache_directory: &str,
        hash: &str,
    ) -> Result<CachedResult, HttpRemoteCacheErrors> {
        let stream_ended = Cell::new(false);
        let tar = WatchedStream {
            inner: flate2::read::GzDecoder::new(content),
            ended: &stream_ended,
        };
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
                let link_target = if entry.header().entry_type().is_hard_link() {
                    entry
                        .link_name()
                        .map_err(|e| {
                            HttpRemoteCacheErrors::CorruptArtifact(format!(
                                "invalid link target for entry {}: {}",
                                entry_path, e
                            ))
                        })?
                        .map(|target| output_dir.join(target))
                } else {
                    None
                };
                let unpacked = entry.unpack_in(&output_dir).map_err(|e| {
                    classify_unpack_error(
                        &output_dir,
                        &entry_path,
                        link_target.as_deref(),
                        stream_ended.get(),
                        e,
                    )
                })?;
                // `unpack_in` skips `..` entries instead of failing on them.
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

/// Flags when the archive stream errors or runs dry. An entry body is read
/// through a length limit, so either one during an unpack means the artifact
/// was cut short.
struct WatchedStream<'a, R> {
    inner: R,
    ended: &'a Cell<bool>,
}

impl<R: Read> Read for WatchedStream<'_, R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let result = self.inner.read(buf);
        if result.is_err() || matches!(result, Ok(0) if !buf.is_empty()) {
            self.ended.set(true);
        }
        result
    }
}

/// `tar` reports a path escape, a truncated body and a full disk as the same
/// `io::Error`, so the cause is read off the filesystem and the stream instead.
fn classify_unpack_error(
    output_dir: &Path,
    entry_path: &str,
    link_target: Option<&Path>,
    stream_ended: bool,
    err: io::Error,
) -> HttpRemoteCacheErrors {
    let mut destination = output_dir.to_path_buf();
    for component in Path::new(entry_path).components() {
        if let Component::Normal(part) = component {
            destination.push(part);
        }
    }
    let cause = report_request_error(&err);

    if resolves_outside(output_dir, &destination)
        || link_target.is_some_and(|target| resolves_outside(output_dir, target))
    {
        return HttpRemoteCacheErrors::UnsafeArtifact(format!(
            "refusing to extract cache entry {} outside the cache directory: {}",
            entry_path, cause
        ));
    }

    // `tar` raises `Other` only for archive contents it refuses. Errors from the
    // OS carry a specific kind.
    let link_target_missing = link_target.is_some_and(|target| target.symlink_metadata().is_err());
    if stream_ended || link_target_missing || err.kind() == io::ErrorKind::Other {
        return HttpRemoteCacheErrors::CorruptArtifact(format!(
            "failed to unpack entry {}: {}",
            entry_path, cause
        ));
    }

    HttpRemoteCacheErrors::LocalCacheError(format!(
        "failed to write entry {} into {}: {}",
        entry_path,
        output_dir.display(),
        cause
    ))
}

/// Whether `path` lands outside `root` once the symlinks already on disk are
/// followed, matching `tar`'s own containment check. A symlink that does not
/// resolve counts as outside.
fn resolves_outside(root: &Path, path: &Path) -> bool {
    let Ok(root) = dunce::canonicalize(root) else {
        return false;
    };
    let mut existing = path;
    while existing.symlink_metadata().is_err() {
        match existing.parent() {
            Some(parent) => existing = parent,
            None => return false,
        }
    }
    dunce::canonicalize(existing).map_or(true, |resolved| !resolved.starts_with(&root))
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::TempDir;
    use flate2::Compression;
    use flate2::write::GzEncoder;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
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
        for (name, entry_type, data) in [
            ("evil/pwned.txt", EntryType::Regular, b"PWNED".as_slice()),
            ("evil", EntryType::Directory, b"".as_slice()),
        ] {
            let temp = TempDir::new().unwrap();
            let cache_dir = temp.join("cache");
            let outside = temp.join("outside");
            std::fs::create_dir_all(&outside).unwrap();
            std::fs::set_permissions(&outside, fs::Permissions::from_mode(0o700)).unwrap();

            let (mut header, data) = raw_entry(name, entry_type, None, data);
            header.set_mode(0o755);
            header.set_cksum();
            let tar = build_tar_gz(vec![
                raw_entry(
                    "evil",
                    EntryType::Symlink,
                    Some(outside.to_str().unwrap()),
                    b"",
                ),
                (header, data),
                code_entry(0),
                terminal_output_entry("done"),
            ]);

            let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

            assert_eq!(
                outside.metadata().unwrap().permissions().mode() & 0o777,
                0o700,
                "extraction must not change permissions outside the cache directory"
            );
            assert!(
                matches!(result, Err(HttpRemoteCacheErrors::UnsafeArtifact(_))),
                "a symlink escape must be rejected as unsafe: {:?}",
                result.err()
            );
            assert!(
                !outside.join("pwned.txt").exists(),
                "extraction must not write through a symlink out of the cache directory"
            );
        }
    }

    #[test]
    fn extract_unpacks_legitimate_tarball() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let (mut directory_header, directory_data) =
            raw_entry("dist", EntryType::Directory, None, b"");
        directory_header.set_mode(0o755);
        directory_header.set_cksum();
        let entries = vec![
            (directory_header, directory_data),
            raw_entry("dist/main.js", EntryType::Regular, None, b"console.log(1)"),
            code_entry(0),
            terminal_output_entry("build complete"),
        ];
        #[cfg(unix)]
        let entries = {
            let mut entries = entries;
            entries.push(raw_entry(
                "dist/main-link.js",
                EntryType::Symlink,
                Some("main.js"),
                b"",
            ));
            entries
        };
        let tar = build_tar_gz(entries);

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
        #[cfg(unix)]
        {
            assert_eq!(
                extracted
                    .parent()
                    .unwrap()
                    .metadata()
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o777,
                0o755
            );
            let symlink = extracted.with_file_name("main-link.js");
            assert!(symlink.symlink_metadata().unwrap().is_symlink());
            assert_eq!(std::fs::read_to_string(symlink).unwrap(), "console.log(1)");
        }
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
            HttpRemoteCacheErrors::ServerUnavailable("429".into()),
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

    /// Answer one request with a bare `status`, so the classifier runs against a
    /// real `reqwest::Response` instead of a hand-built one.
    async fn classify_response_status(status: u16) -> HttpRemoteCacheErrors {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            use std::io::{BufRead, Write};
            let Some(mut stream) = listener.incoming().flatten().next() else {
                return;
            };
            // Drain the request line and headers before replying, so the client
            // reads the status under test rather than a connection reset.
            let mut reader = std::io::BufReader::new(stream.try_clone().unwrap());
            let mut line = String::new();
            while reader.read_line(&mut line).unwrap_or(0) > 0 {
                if line == "\r\n" {
                    break;
                }
                line.clear();
            }
            let _ = stream.write_all(
                format!("HTTP/1.1 {} Stub\r\nContent-Length: 0\r\n\r\n", status).as_bytes(),
            );
        });

        let response = ClientBuilder::new()
            .connect_timeout(CONNECT_TIMEOUT)
            .build()
            .unwrap()
            .get(format!("http://{}/v1/cache/abc", addr))
            .send()
            .await
            .expect("the stub server should answer");

        convert_response_to_error(response).await
    }

    /// The #36107 502 and the 429 a rate-limited cache answers with both arrive
    /// as a status rather than a transport failure, so the status has to decide
    /// the fatal/recoverable split as well.
    #[tokio::test]
    async fn temporary_statuses_degrade_and_other_client_errors_stay_fatal() {
        for status in [408, 429, 500, 502, 503, 504] {
            let err = classify_response_status(status).await;
            assert!(
                matches!(err, HttpRemoteCacheErrors::ServerUnavailable(_)) && !err.is_fatal(),
                "{} should degrade to a cache miss, got {:?}",
                status,
                err
            );
        }

        // Nothing about a 400 or a 404 gets better on a retry, so they keep
        // pointing at the endpoint being wrong.
        for status in [400, 404] {
            let err = classify_response_status(status).await;
            assert!(
                matches!(err, HttpRemoteCacheErrors::Misconfigured(_)) && err.is_fatal(),
                "{} should stop the run, got {:?}",
                status,
                err
            );
        }
    }

    /// A stalled server is the failure mode behind #36640: it accepts the
    /// connection and then goes silent. Without a read timeout this blocks
    /// forever; with one it must come back as a recoverable timeout.
    #[tokio::test]
    async fn retrieve_and_store_time_out_against_a_stalled_server() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        // Accept and hold both connections open without ever writing a response.
        std::thread::spawn(move || {
            let held: Vec<_> = listener.incoming().filter_map(Result::ok).take(2).collect();
            std::thread::sleep(Duration::from_secs(30));
            drop(held);
        });

        let cache = HttpRemoteCache::with_read_timeouts(
            format!("http://{}", addr),
            Duration::from_millis(250),
            Duration::from_millis(250),
        );
        let temp = TempDir::new().unwrap();
        std::fs::create_dir_all(temp.join("123")).unwrap();
        let cache_dir = temp.to_str().unwrap().to_string();
        let bounded = Duration::from_secs(5);

        let err = tokio::time::timeout(bounded, cache.retrieve("123".into(), cache_dir.clone()))
            .await
            .expect("retrieve must not block on a silent server")
            .expect_err("a silent server is not a cache hit");
        assert_eq!(err.status, napi::Status::GenericFailure, "{}", err.reason);
        assert!(
            err.reason.starts_with("Timed out downloading"),
            "{}",
            err.reason
        );

        let err = tokio::time::timeout(
            bounded,
            cache.store("123".into(), cache_dir, String::new(), 0),
        )
        .await
        .expect("store must not block on a silent server")
        .expect_err("a silent server did not acknowledge the upload");
        assert_eq!(err.status, napi::Status::GenericFailure, "{}", err.reason);
        assert!(
            err.reason.starts_with("Timed out uploading"),
            "{}",
            err.reason
        );
    }

    #[test]
    fn extract_reports_a_truncated_body_as_damage() {
        let mut state: u32 = 0x9e37_79b9;
        let body: Vec<u8> = (0..64 * 1024)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;
                state as u8
            })
            .collect();
        let mut tar = Builder::new(Vec::new());
        let (header, data) = raw_entry("dist/main.js", EntryType::Regular, None, &body);
        tar.append(&header, data.as_slice()).unwrap();
        let tar = tar.into_inner().unwrap();
        let gzip = |bytes: &[u8]| {
            let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
            std::io::Write::write_all(&mut encoder, bytes).unwrap();
            encoder.finish().unwrap()
        };

        // Gzip cut mid-body, so the decoder errors.
        let full = gzip(&tar);
        let cut_gzip = full[..full.len() / 2].to_vec();
        // Tar cut mid-body inside a complete gzip, so the stream ends cleanly.
        let cut_tar = gzip(&tar[..512 + body.len() / 2]);

        for artifact in [cut_gzip, cut_tar] {
            let temp = TempDir::new().unwrap();
            let cache_dir = temp.join("cache");

            let result =
                HttpRemoteCache::extract_tarball(&artifact, cache_dir.to_str().unwrap(), "123");

            assert!(
                matches!(result, Err(HttpRemoteCacheErrors::CorruptArtifact(_))),
                "a body that ends early is damage, so the run can still fall back: {:?}",
                result.err()
            );
        }
    }

    #[test]
    fn extract_reports_a_blocked_destination_as_local() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        // A file where the artifact needs a directory, so the write fails locally.
        std::fs::create_dir_all(cache_dir.join("123")).unwrap();
        std::fs::write(cache_dir.join("123").join("dist"), b"").unwrap();
        let tar = build_tar_gz(vec![
            raw_entry("dist/main.js", EntryType::Regular, None, b"console.log(1)"),
            code_entry(0),
        ]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            matches!(result, Err(HttpRemoteCacheErrors::LocalCacheError(_))),
            "a local write failure must not be blamed on the server: {:?}",
            result.err()
        );
    }

    #[test]
    fn pending_requests_leave_no_span_entered_on_the_polling_thread() {
        use std::future::Future;
        use std::task::{Context, Waker};

        // The runtime is never driven, so each request stops at its first await (the TCP
        // connect); the listener only has to exist so the connect is not refused.
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let cache = HttpRemoteCache {
            download_client: Client::new(),
            upload_client: Client::new(),
            url: format!("http://{}", listener.local_addr().unwrap()),
        };
        let temp = TempDir::new().unwrap();
        std::fs::create_dir_all(temp.join("123")).unwrap();
        let cache_dir = temp.to_str().unwrap().to_string();

        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let _runtime = runtime.enter();

        // A bare registry keeps `trace` spans alive, as the TUI layer does in production.
        tracing::subscriber::with_default(tracing_subscriber::registry(), || {
            assert!(
                !tracing::trace_span!("probe").is_disabled(),
                "trace spans must be enabled or this test proves nothing"
            );
            let mut cx = Context::from_waker(Waker::noop());
            let current = || tracing::Span::current().metadata().map(|m| m.name());

            let mut retrieve = Box::pin(cache.retrieve("123".into(), cache_dir.clone()));
            assert!(retrieve.as_mut().poll(&mut cx).is_pending());
            assert_eq!(
                current(),
                None,
                "retrieve left its span entered while pending"
            );

            let mut store =
                Box::pin(cache.store("123".into(), cache_dir.clone(), String::new(), 0));
            assert!(store.as_mut().poll(&mut cx).is_pending());
            assert_eq!(current(), None, "store left its span entered while pending");
        });
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
