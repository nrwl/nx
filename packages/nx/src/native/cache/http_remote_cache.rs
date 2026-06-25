use std::{
    env,
    fs::{self},
    io::Read,
    path::Path,
};

use super::{
    cache::CachedResult,
    errors::{HttpRemoteCacheErrors, convert_response_to_error, report_request_error},
};
use flate2::Compression;
use reqwest::{Client, ClientBuilder, StatusCode, header};
use tar::{Archive, Builder};
use tracing::trace;

#[napi]
pub struct HttpRemoteCache {
    client: Client,
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

        let mut client_builder = ClientBuilder::new().default_headers(headers);

        let env_accept_unauthorized = env::var("NODE_TLS_REJECT_UNAUTHORIZED");
        if let Ok(env_accept_unauthorized) = env_accept_unauthorized {
            if env_accept_unauthorized == "0" {
                client_builder = client_builder.danger_accept_invalid_certs(true);
            }
        }

        HttpRemoteCache {
            client: client_builder
                .build()
                .expect("Failed to create HTTP client"),
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
            .client
            .get(&url)
            .header("Accept", "application/octet-stream")
            .send()
            .await;
        if let Ok(resp) = response {
            trace!("HTTP response status: {}", resp.status());
            let status = resp.status();

            match status {
                StatusCode::OK => {
                    Ok(Some(
                        // response is an application/octet-stream containing a tarball
                        // we need to extract the tarball and return the path to the extracted files
                        Self::download_and_extract_from_result(resp, cache_directory, hash).await?,
                    ))
                }
                StatusCode::NOT_FOUND => Ok(None),
                _ => Err(convert_response_to_error(resp).await.into()),
            }
        } else {
            Err(HttpRemoteCacheErrors::RequestError(response.unwrap_err().to_string()).into())
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
            .client
            .put(&url)
            .body(buffer) // Convert the bytes to a Vec<u8> for the request body
            .send()
            .await
            .map_err(|e| {
                napi::Error::from(HttpRemoteCacheErrors::RequestError(report_request_error(
                    &e,
                )))
            })?;

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
    ) -> anyhow::Result<CachedResult> {
        let content = response
            .bytes()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read remote cache response body: {}", e))?;
        trace!("Downloaded {} bytes from remote cache", content.len());
        Self::extract_tarball(content.as_ref(), &cache_directory, &hash)
    }

    /// Extract a gzipped cache tarball into `<cache_directory>/<hash>`.
    ///
    /// Uses `tar`'s `unpack_in` so a malicious cache server can't escape
    /// `output_dir` via `..`, absolute paths, or symlinks.
    fn extract_tarball(
        content: &[u8],
        cache_directory: &str,
        hash: &str,
    ) -> anyhow::Result<CachedResult> {
        let tar = flate2::read::GzDecoder::new(content);
        let mut archive = Archive::new(tar);
        let entries = archive
            .entries() // Get the entries in the archive
            .map_err(|_| anyhow::anyhow!("Failed to read entries from tarball"))?;

        let mut code: Option<i16> = None;
        let mut terminal_output: Option<String> = None;
        let mut size: i64 = 0;

        let output_dir = Path::new(cache_directory).join(hash);
        // `unpack_in` canonicalizes `output_dir`, so it must exist beforehand.
        fs::create_dir_all(&output_dir)?;

        // Extract the archive to the specified cache directory
        for entry in entries {
            let mut entry =
                entry.map_err(|_| anyhow::anyhow!("Failed to read entry from tarball"))?;

            let entry_path = entry
                .path()
                .map_err(|e| anyhow::anyhow!("Invalid entry path in cache artifact: {}", e))?
                .to_string_lossy()
                .into_owned();

            if entry_path == "code" {
                let code_file_bytes = entry.bytes().collect::<Result<Vec<u8>, _>>()?;
                // A short/empty `code` entry must not panic on the indexing below.
                if code_file_bytes.len() < 2 {
                    return Err(anyhow::anyhow!("Invalid exit code in cache artifact"));
                }
                code = Some(i16::from_be_bytes([code_file_bytes[0], code_file_bytes[1]]));
                trace!("Retrieved exit code from cache: {}", code.unwrap());
            } else if entry_path == "terminalOutput" {
                let terminal_output_bytes = entry.bytes().collect::<Result<Vec<u8>, _>>()?;
                let terminal_output_size = terminal_output_bytes.len();

                terminal_output = Some(String::from_utf8(terminal_output_bytes)?);
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
                let unpacked = entry
                    .unpack_in(&output_dir)
                    .map_err(|e| anyhow::anyhow!("Failed to unpack entry: {}", e))?;
                if !unpacked {
                    return Err(anyhow::anyhow!(
                        "Refusing to extract cache entry with unsafe path: {}",
                        entry_path
                    ));
                }
                if is_file {
                    size += entry_size as i64;
                }
            }
        }

        trace!("Extracted tarball to {}", output_dir.display());

        let code = code.ok_or_else(|| anyhow::anyhow!("Exit code not found in cache artifact"))?;
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

        assert!(result.is_err(), "a `..` entry must be rejected");
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
            result.is_err(),
            "writing through a symlink must be rejected"
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
            result.is_err(),
            "a hardlink escaping the cache dir must be rejected"
        );
    }

    #[test]
    fn extract_rejects_short_code_entry() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let tar = build_tar_gz(vec![raw_entry("code", EntryType::Regular, None, b"\0")]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            result.is_err(),
            "a short code entry must be rejected, not panic"
        );
    }

    #[test]
    fn extract_rejects_missing_code_entry() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.join("cache");
        let tar = build_tar_gz(vec![terminal_output_entry("done")]);

        let result = HttpRemoteCache::extract_tarball(&tar, cache_dir.to_str().unwrap(), "123");

        assert!(
            result.is_err(),
            "a missing code entry must be rejected, not panic"
        );
    }
}
