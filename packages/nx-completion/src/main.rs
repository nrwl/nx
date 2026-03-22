//! Nx CLI shell completion binary.
//!
//! Uses clap to define the command tree as the source of truth.
//! The shell calls this binary on every TAB press — it walks the clap tree
//! for static completions (commands, subcommands) and reads the cached
//! project graph for dynamic ones (project names, target names).

mod graph;

use clap::{Arg, ArgAction, Command};
use std::env;
use std::process;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    // Strip script name if present (fish passes 'nx show project')
    let args: Vec<&str> = if args.first().is_some_and(|a| a == "nx") {
        args[1..].iter().map(|s| s.as_str()).collect()
    } else {
        args.iter().map(|s| s.as_str()).collect()
    };

    let current = args.last().copied().unwrap_or("");

    let completions = get_completions(current, &args);
    if !completions.is_empty() {
        println!("{}", completions.join("\n"));
    }
    process::exit(0);
}

fn get_completions(current: &str, args: &[&str]) -> Vec<String> {
    // Try dynamic completions first (project names, targets from graph)
    if let Some(dynamic) = get_dynamic_completions(current, args) {
        return dynamic;
    }

    // Static completions from the clap command tree
    let mut completions = get_static_completions(current, args);

    // At top level, also include workspace target names (build, serve, etc.)
    // so infix commands like `nx build` show up in completion.
    if args.len() <= 1 {
        let targets = graph::get_target_completions(current, None);
        for t in targets {
            if !completions.contains(&t) {
                completions.push(t);
            }
        }
    }

    completions
}

/// Walk the clap command tree to find matching subcommands at the current depth.
fn get_static_completions(current: &str, args: &[&str]) -> Vec<String> {
    let cli = build_cli();

    // Walk down the command tree following the args the user has typed
    let mut cmd = &cli;
    for (i, arg) in args.iter().enumerate() {
        // Last arg is what we're completing — don't descend into it
        if i == args.len() - 1 {
            break;
        }
        // Try to find a matching subcommand to descend into
        match cmd.find_subcommand(arg) {
            Some(sub) => cmd = sub,
            None => break,
        }
    }

    // Return subcommands of the current command that match the prefix
    cmd.get_subcommands()
        .filter(|sub| {
            let name = sub.get_name();
            current.is_empty() || name.starts_with(current)
        })
        .map(|sub| sub.get_name().to_string())
        .collect()
}

/// Dynamic completions that need the project graph.
fn get_dynamic_completions(current: &str, args: &[&str]) -> Option<Vec<String>> {
    if args.is_empty() {
        return None;
    }

    let command = args[0];

    // nx show project <TAB>
    if command == "show" && args.len() >= 3 && args[1] == "project" {
        return Some(graph::get_project_completions(current));
    }

    // nx show target <TAB> — project:target format
    if command == "show" && args.len() >= 3 && args[1] == "target" {
        return Some(graph::get_project_target_completions(current));
    }

    // nx run <project:target>
    if command == "run" && args.len() >= 2 {
        return Some(graph::get_project_target_completions(current));
    }

    // nx run-many -t <TAB> / nx affected -t <TAB>
    if (command == "run-many" || command == "affected") && args.len() >= 3 {
        let prev = args[args.len() - 2];
        if prev == "-t" || prev == "--target" || prev == "--targets" {
            return Some(graph::get_target_completions(current, None));
        }
        if prev == "-p" || prev == "--projects" {
            return Some(graph::get_project_completions(current));
        }
        return None;
    }

    // Infix target commands: any unknown command is likely a target name (nx build, nx serve, etc.)
    // If it's not a known clap subcommand, treat it as a target and show only projects that have it.
    if args.len() >= 2 {
        let cli = build_cli();
        if cli.find_subcommand(command).is_none() {
            return Some(graph::get_projects_with_target(current, command));
        }
    }

    None
}

/// The Nx CLI command tree defined in clap.
/// This is the source of truth for static completions (commands, subcommands).
/// Mirrors the yargs definitions in nx-commands.ts.
fn build_cli() -> Command {
    Command::new("nx")
        .about("Smart Monorepos · Fast Builds")
        .subcommand_required(false)
        // Core execution
        .subcommand(
            Command::new("run")
                .about("Run a target for a project")
                .arg(Arg::new("target").help("project:target")),
        )
        .subcommand(
            Command::new("run-many")
                .about("Run target for multiple projects")
                .arg(
                    Arg::new("targets")
                        .short('t')
                        .long("targets")
                        .action(ArgAction::Set),
                )
                .arg(
                    Arg::new("projects")
                        .short('p')
                        .long("projects")
                        .action(ArgAction::Set),
                ),
        )
        .subcommand(
            Command::new("affected")
                .about("Run target for affected projects")
                .arg(
                    Arg::new("targets")
                        .short('t')
                        .long("targets")
                        .action(ArgAction::Set),
                )
                .arg(
                    Arg::new("projects")
                        .short('p')
                        .long("projects")
                        .action(ArgAction::Set),
                ),
        )
        // Show
        .subcommand(
            Command::new("show")
                .about("Show information about the workspace")
                .subcommand(Command::new("project").about("Show resolved project configuration"))
                .subcommand(Command::new("projects").about("Show a list of projects"))
                .subcommand(
                    Command::new("target")
                        .about("Show resolved target configuration")
                        .subcommand(Command::new("inputs").about("List resolved input files"))
                        .subcommand(Command::new("outputs").about("List resolved output paths")),
                ),
        )
        // Release
        .subcommand(
            Command::new("release")
                .about("Orchestrate versioning and publishing")
                .subcommand(Command::new("version").about("Create a version and release"))
                .subcommand(Command::new("changelog").about("Generate a changelog"))
                .subcommand(Command::new("publish").about("Publish to a registry"))
                .subcommand(Command::new("plan").about("Create a version plan file"))
                .subcommand(
                    Command::new("plan:check")
                        .about("Ensure all touched projects have version plan"),
                ),
        )
        // Generation & config
        .subcommand(Command::new("generate").about("Generate or update source code"))
        .subcommand(Command::new("add").about("Install a plugin and initialize it"))
        .subcommand(Command::new("init").about("Add Nx to any workspace"))
        .subcommand(Command::new("new").about("Create a new workspace"))
        .subcommand(Command::new("import").about("Import code from another repository"))
        .subcommand(Command::new("migrate").about("Create or run migrations"))
        // Code quality
        .subcommand(
            Command::new("format")
                .about("Format source files")
                .subcommand(Command::new("check").about("Check for un-formatted files"))
                .subcommand(Command::new("write").about("Overwrite un-formatted files")),
        )
        .subcommand(Command::new("repair").about("Repair configuration"))
        .subcommand(
            Command::new("sync")
                .about("Sync workspace files")
                .subcommand(Command::new("check").about("Check that no sync changes are needed")),
        )
        // Workspace info
        .subcommand(Command::new("graph").about("Graph dependencies within workspace"))
        .subcommand(Command::new("list").about("List installed plugins"))
        .subcommand(Command::new("report").about("Report useful version numbers"))
        .subcommand(Command::new("daemon").about("Nx Daemon information"))
        .subcommand(Command::new("reset").about("Clear cache and daemon"))
        .subcommand(Command::new("watch").about("Watch for changes and execute commands"))
        .subcommand(Command::new("exec").about("Execute any command as a target"))
        .subcommand(Command::new("register").about("Register an Nx key"))
        .subcommand(Command::new("configure-ai-agents").about("Configure AI agent settings"))
        .subcommand(Command::new("mcp").about("Start the Nx MCP server"))
        // Completion
        .subcommand(
            Command::new("completion")
                .about("Output shell completion script")
                .subcommand(Command::new("bash").about("Output bash completion script"))
                .subcommand(Command::new("zsh").about("Output zsh completion script"))
                .subcommand(Command::new("fish").about("Output fish completion script")),
        )
        // Nx Cloud
        .subcommand(Command::new("connect").about("Connect to Nx Cloud"))
        .subcommand(Command::new("login").about("Login to Nx Cloud"))
        .subcommand(Command::new("logout").about("Logout from Nx Cloud"))
        .subcommand(Command::new("view-logs").about("View Nx Cloud logs"))
        .subcommand(Command::new("record").about("Record for distributed execution"))
        .subcommand(Command::new("start-ci-run").about("Start distributed CI run"))
        .subcommand(Command::new("start-agent").about("Start distributed agent"))
        .subcommand(Command::new("stop-all-agents").about("Stop all agents"))
        .subcommand(Command::new("fix-ci").about("Fix CI failures"))
        .subcommand(Command::new("apply-locally").about("Apply CI fix locally"))
        .subcommand(Command::new("polygraph").about("Coordinate cross-repo changes"))
}
