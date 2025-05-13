use std::{
    env,
    fs::{self},
    io::Read,
    path::Path,
};

use super::{
    cache::CachedResult,
    errors::{convert_response_to_error, report_request_error, HttpRemoteCacheErrors},
};
use flate2::Compression;
use reqwest::{header, Client, ClientBuilder, StatusCode};
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
        let response = self.client.get(&url).send().await;
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
        let content = response.bytes().await.unwrap();
        trace!("Downloaded {} bytes from remote cache", content.len());
        let tar = flate2::read::GzDecoder::new(content.as_ref());
        let mut archive = Archive::new(tar);
        let entries = archive
            .entries() // Get the entries in the archive
            .map_err(|_| anyhow::anyhow!("Failed to read entries from tarball"))?;

        let mut code: Option<i16> = None;
        let mut terminal_output: Option<String> = None;
        let mut size: i64 = 0;

        let output_dir = Path::new(&cache_directory).join(&hash);

        // Extract the archive to the specified cache directory
        for entry in entries {
            let mut entry =
                entry.map_err(|_| anyhow::anyhow!("Failed to read entry from tarball"))?;

            let entry_path = entry
                .path()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap();

            if entry_path == "code" {
                let code_file_bytes = entry.bytes().collect::<Result<Vec<u8>, _>>()?;
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
                let path_on_disk = output_dir.join(entry_path);
                trace!("Extracting entry to {}", path_on_disk.display());
                fs::create_dir_all(path_on_disk.parent().expect("This will have a parent, we just joined it above so there is at least one dir."))?;
                // Ensure the directory exists before extracting
                match entry.unpack(&path_on_disk) {
                    Err(e) => {
                        return Err(anyhow::anyhow!("Failed to unpack entry: {}", e));
                    }
                    Ok(f) => match f {
                        tar::Unpacked::File(f) => size += f.metadata()?.len() as i64,
                        _ => (),
                    },
                }
            }
        }

        trace!("Extracted tarball to {}", output_dir.display());

        Ok(CachedResult {
            terminal_output,
            code: code.expect("Exit code not found in cache"),
            outputs_path: output_dir.to_string_lossy().into_owned(),
            size: Some(size),
        })
    }
}
