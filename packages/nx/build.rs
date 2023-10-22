extern crate napi_build;

fn main() {
    static_vcruntime::metabuild();
    napi_build::setup();
}
