def _collect_es5_sources_impl(target, ctx):
  result = set()
  if hasattr(ctx.rule.attr, "srcs"):
    for dep in ctx.rule.attr.srcs:
      if hasattr(dep, "es5_sources"):
        result += dep.es5_sources
  if hasattr(target, "typescript"):
    result += target.typescript.es5_sources
  return struct(es5_sources = result)

_collect_es5_sources = aspect(
    _collect_es5_sources_impl,
    attr_aspects = ["deps", "srcs"],
)

def _webpack_bundle_impl(ctx):
  inputs = set()
  for s in ctx.attr.srcs:
    if hasattr(s, "es5_sources"):
      inputs += s.es5_sources

  config = ctx.attr.config.files.to_list()[0]

  if ctx.attr.mode == 'prod':
    main = ctx.new_file('bundles/main.bundle.prod.js')
    polyfills = ctx.new_file('bundles/polyfills.bundle.prod.js')
    vendor = ctx.new_file('bundles/vendor.bundle.prod.js')
    styles = ctx.new_file('bundles/styles.bundle.prod.js')
  else:
    main = ctx.new_file('bundles/main.bundle.js')
    polyfills = ctx.new_file('bundles/polyfills.bundle.js')
    vendor = ctx.new_file('bundles/vendor.bundle.js')
    styles = ctx.new_file('bundles/styles.bundle.js')

  inputs += [config]
  args = []

  if ctx.attr.mode == 'prod':
    args += ['-p']

  args += ['--config', config.path]
  args += ['--env.bin_dir', ctx.configuration.bin_dir.path]
  args += ['--env.package', ctx.label.package]
  args += ['--env.mode', ctx.attr.mode]

  ctx.action(
      progress_message = "Webpack bundling %s" % ctx.label,
      inputs = inputs.to_list(),
      outputs = [main, polyfills, vendor, styles],
      executable = ctx.executable._webpack,
      arguments = args,
  )
  return DefaultInfo(files=depset([main, polyfills, vendor, styles]))

webpack_bundle = rule(implementation = _webpack_bundle_impl,
    attrs = {
        "srcs": attr.label_list(allow_files=True, aspects=[_collect_es5_sources]),
        "config": attr.label(allow_single_file=True, mandatory=True),
        "mode": attr.string(default="dev"),
        "_webpack": attr.label(default=Label("@nrwl//:webpack"), executable=True, cfg="host")
    }
)
