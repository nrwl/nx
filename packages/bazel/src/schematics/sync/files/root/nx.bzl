load("@build_bazel_rules_nodejs//:index.bzl", "nodejs_binary", "nodejs_test", "npm_package_bin")

# Generated helper macro to call ng
def nx(**kwargs):
    output_dir = kwargs.pop("output_dir", False)
    if "outs" in kwargs or output_dir:
        npm_package_bin(tool = "//:nx", output_dir = output_dir, **kwargs)
    else:
        nodejs_binary(
            entry_point = "//:node_modules/@nrwl/cli/bin/nx.js",
            install_source_map_support = False,
            data = ["//:node_modules"] + kwargs.pop("data", []),
            **kwargs
        )

# Just in case ng is a test runner, also make a test rule for it
def nx_test(**kwargs):
    nodejs_test(
        entry_point = "//:node_modules/@nrwl/cli/bin/nx.js",
        install_source_map_support = False,
        data = ["//:node_modules"] + kwargs.pop("data", []),
        **kwargs
    )
