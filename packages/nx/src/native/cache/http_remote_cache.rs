use std::{
    env,
    fs::{self},
    io::Read,
    path::Path,
};

use super::cache::CachedResult;
use flate2::Compression;
use napi::bindgen_prelude::{Buffer, Promise};
use tar::{Archive, Builder};
use tracing::trace;

type JsRetrieveCallbackArgs = (String, String);

type JsRetrieveCallbackResponse = (i16, Option<Buffer>);

pub type JsHttpRetrieveCallbackAsync = napi::threadsafe_function::ThreadsafeFunction<
    JsRetrieveCallbackArgs,
    Promise<JsRetrieveCallbackResponse>,
    JsRetrieveCallbackArgs,
    false,
>;

type JsStoreCallbackArgs = (String, String, Buffer);

type JsStoreCallbackResponse = i16;

pub type JsHttpStoreCallbackAsync = napi::threadsafe_function::ThreadsafeFunction<
    JsStoreCallbackArgs,
    Promise<JsStoreCallbackResponse>,
    JsStoreCallbackArgs,
    false,
>;

#[napi]
pub struct HttpRemoteCache {
    url: String,
    store_fetch_callback: JsHttpStoreCallbackAsync,
    retrieve_fetch_callback: JsHttpRetrieveCallbackAsync,
}

#[napi]
impl HttpRemoteCache {
    #[napi(constructor)]
    pub fn new(
        retrieve_fetch_callback: JsHttpRetrieveCallbackAsync,
        store_fetch_callback: JsHttpStoreCallbackAsync,
    ) -> Self {
        Self {
            url: env::var("NX_SELF_HOSTED_REMOTE_CACHE_URL")
                .expect("NX_SELF_HOSTED_REMOTE_CACHE_URL must be set"),
            store_fetch_callback,
            retrieve_fetch_callback,
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
        let (status, bytes) = self
            .retrieve_fetch_callback
            .call_async((url, hash.clone()))
            .await?
            .await?;

        trace!("HTTP response status: {}", status);
        if status == 200 {
            // response is an application/octet-stream containing a tarball
            // we need to extract the tarball and return the path to the extracted files
            Ok(Some(
                Self::extract_from_bytes(bytes.unwrap().into(), cache_directory, hash).await?,
            ))
        } else {
            if status == 404 {
                trace!("Cache not found for hash '{}'", hash);
                return Ok(None); // Return None if the cache was not found
            } else if status == 401 {
                return Err(anyhow::anyhow!("Unauthorized to retrieve cache. Provide NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN to set a valid authorization token.").into());
            }
            // Handle other HTTP errors
            Err(anyhow::anyhow!("Failed to retrieve cache: {}", status).into())
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

        // create a tarball in memory from the cache dir
        let tar_gz: Vec<u8> = Vec::new();
        let enc = flate2::write::GzEncoder::new(tar_gz, Compression::default());
        let mut archive = Builder::new(enc);
        trace!("Created tar file for writing");

        let cache_path = Path::new(&cache_directory);
        let outputs_path = cache_path.join(&hash);

        trace!("Adding cache directory to tarball");
        archive.append_dir_all("", &outputs_path)?;
        trace!("Added cache directory to tarball");

        trace!("Adding terminal output to tarball");
        let mut terminal_output_header = tar::Header::new_old();
        let terminal_output_bytes = terminal_output.as_bytes();
        terminal_output_header.set_size(terminal_output_bytes.len() as u64);
        terminal_output_header.set_cksum(); // Ensure the checksum is set correctly
        archive
            .append_data(
                &mut terminal_output_header,
                "terminalOutput",
                terminal_output_bytes,
            )
            .unwrap();
        trace!("Added terminal output to tarball");

        trace!("Adding code to tarball");
        let mut code_header = tar::Header::new_old();
        code_header.set_size(4);
        code_header.set_cksum(); // Ensure the checksum is set correctly
        archive
            .append_data(&mut code_header, "code", &code.to_be_bytes()[..])
            .unwrap();
        trace!("Added code to tarball");

        trace!("Finishing tarball");
        archive
            .finish() // Finish the archive to get the inner bytes
            .map_err(|e| anyhow::anyhow!(format!("Failed to finish tarball: {}", e)))?;
        trace!("Finished tarball");

        trace!("Reading tarball into memory");
        let archive_bytes = archive.into_inner().unwrap();
        let buffer = archive_bytes.finish()?;
        // let mut buffer = Vec::new();
        // // read the whole file
        // archive_bytes.read_to_end(&mut buffer)?;
        trace!("read tarball into memory");

        let url: String = format!("{}/v1/cache/{}", self.url, hash);

        let status = self
            .store_fetch_callback
            .call_async((url, hash.clone(), buffer.into()))
            .await?
            .await?;

        Ok(status == 200)
    }

    async fn extract_from_bytes(
        bytes: Vec<u8>,
        cache_directory: String,
        hash: String,
    ) -> anyhow::Result<CachedResult> {
        trace!("Downloaded {} bytes from remote cache", bytes.len());
        let tar = flate2::read::GzDecoder::new(std::io::Cursor::new(bytes));
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
                fs::create_dir_all(path_on_disk.parent().unwrap())?;
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
