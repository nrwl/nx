extern crate napi_build;

fn main() {
    napi_build::setup();

    // Embed Windows resource metadata to establish binary legitimacy
    // and reduce false positive detections from security software
    #[cfg(windows)]
    {
        let mut res = winres::WindowsResource::new();
        res.set("ProductName", "Nx Build System")
            .set(
                "FileDescription",
                "Nx Native Module - High-performance build system operations",
            )
            .set("CompanyName", "Nrwl")
            .set("LegalCopyright", "Copyright (c) Nrwl. MIT License.")
            .set("OriginalFilename", "nx.node")
            .set("InternalName", "nx");

        if let Err(e) = res.compile() {
            // Don't fail the build if resource compilation fails
            // (e.g., when cross-compiling from non-Windows)
            eprintln!("cargo:warning=Failed to compile Windows resources: {}", e);
        }
    }
}
