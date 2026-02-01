"""
Cognitive CLI - Main entry point for the cog command.

Commands:
    cog list                      List installed modules
    cog run <module> <input>      Run a module
    cog validate <module>         Validate module structure
    cog add <url> --module <name> Add module from GitHub (recommended)
    cog update <module>           Update module to latest version
    cog versions <url>            List available versions for a repo
    cog install <source>          Install module from git/local/registry
    cog remove <module>           Remove an installed module
    cog uninstall <module>        Remove an installed module (alias)
    cog init <name>               Create a new module from template
    cog search <query>            Search the public registry
    cog doctor                    Check environment setup
    cog info <module>             Show module details
"""

import json
import sys
from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table

from . import __version__
from .registry import (
    list_modules,
    find_module,
    install_module,
    uninstall_module,
    search_registry,
    fetch_registry,
    install_from_github_url,
    update_module,
    get_installed_module_info,
    get_module_version,
    list_github_tags,
    USER_MODULES_DIR,
)
from .loader import load_module, detect_format
from .runner import run_module
from .subagent import run_with_subagents
from .validator import validate_module
from .templates import create_module
from .providers import check_provider_status

app = typer.Typer(
    name="cog",
    help="Cognitive Modules CLI - Structured LLM task runner",
    add_completion=False,
)
console = Console()


@app.command("list")
def list_cmd(
    format: str = typer.Option("table", "--format", "-f", help="Output format: table, json"),
):
    """List all installed cognitive modules."""
    modules = list_modules()
    
    if not modules:
        rprint("[yellow]No modules found.[/yellow]")
        rprint(f"\nInstall modules with:")
        rprint(f"  [cyan]cog install <source>[/cyan]")
        rprint(f"  [cyan]cog init <name>[/cyan]")
        return
    
    if format == "json":
        print(json.dumps([{"name": m["name"], "location": m["location"], "format": m["format"]} for m in modules], indent=2))
        return
    
    table = Table(title="Installed Modules")
    table.add_column("Name", style="cyan")
    table.add_column("Location", style="green")
    table.add_column("Format", style="dim")
    table.add_column("Path")
    
    for m in modules:
        table.add_row(m["name"], m["location"], m["format"], str(m["path"]))
    
    console.print(table)


@app.command("run")
def run_cmd(
    module: str = typer.Argument(..., help="Module name or path"),
    input_file: Optional[Path] = typer.Argument(None, help="Input JSON file (optional if using --args)"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Output file"),
    args: Optional[str] = typer.Option(None, "--args", "-a", help="Direct text input (replaces $ARGUMENTS in prompt)"),
    pretty: bool = typer.Option(False, "--pretty", help="Pretty-print JSON output"),
    no_validate: bool = typer.Option(False, "--no-validate", help="Skip validation"),
    subagent: bool = typer.Option(False, "--subagent", "-s", help="Enable subagent mode (@call support)"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="LLM model override"),
):
    """Run a cognitive module with input data or direct arguments."""
    # Determine input source
    skip_input_validation = False
    if args:
        # Direct text input via --args (skip input schema validation)
        input_data = {"$ARGUMENTS": args, "query": args}
        skip_input_validation = True
    elif input_file:
        if not input_file.exists():
            rprint(f"[red]Error: Input file not found: {input_file}[/red]")
            raise typer.Exit(1)
        with open(input_file, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
    else:
        rprint("[red]Error: Provide either input file or --args[/red]")
        raise typer.Exit(1)
    
    mode_str = " [dim](subagent mode)[/dim]" if subagent else ""
    rprint(f"[cyan]→[/cyan] Running module: [bold]{module}[/bold]{mode_str}")
    
    try:
        if subagent:
            # Use subagent orchestrator for @call support
            result = run_with_subagents(
                module,
                input_data,
                model=model,
                validate_input=not no_validate and not skip_input_validation,
                validate_output=not no_validate,
            )
        else:
            result = run_module(
                module,
                input_data,
                validate_input=not no_validate and not skip_input_validation,
                validate_output=not no_validate,
                model=model,
            )
        
        indent = 2 if pretty else None
        output_json = json.dumps(result, indent=indent, ensure_ascii=False)
        
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(output_json)
            rprint(f"[green]✓[/green] Output saved to: {output}")
        else:
            print(output_json)
        
        if "confidence" in result:
            conf = result["confidence"]
            color = "green" if conf >= 0.8 else "yellow" if conf >= 0.6 else "red"
            rprint(f"[{color}]Confidence: {conf:.2f}[/{color}]")
        
    except Exception as e:
        rprint(f"[red]✗ Error: {e}[/red]")
        raise typer.Exit(1)


@app.command("validate")
def validate_cmd(
    module: str = typer.Argument(..., help="Module name or path"),
):
    """Validate a cognitive module's structure and examples."""
    rprint(f"[cyan]→[/cyan] Validating module: [bold]{module}[/bold]\n")
    
    is_valid, errors, warnings = validate_module(module)
    
    if warnings:
        rprint(f"[yellow]⚠ Warnings ({len(warnings)}):[/yellow]")
        for w in warnings:
            rprint(f"  - {w}")
        print()
    
    if is_valid:
        rprint(f"[green]✓ Module '{module}' is valid[/green]")
    else:
        rprint(f"[red]✗ Validation failed ({len(errors)} errors):[/red]")
        for e in errors:
            rprint(f"  - {e}")
        raise typer.Exit(1)


@app.command("install")
def install_cmd(
    source: str = typer.Argument(..., help="Source: github:org/repo/path, registry:name, or local path"),
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Override module name"),
):
    """Install a cognitive module from git, registry, or local path."""
    rprint(f"[cyan]→[/cyan] Installing from: {source}")
    
    try:
        target = install_module(source, name)
        
        is_valid, errors, warnings = validate_module(str(target))
        
        if not is_valid:
            rprint(f"[red]✗ Installed module failed validation:[/red]")
            for e in errors:
                rprint(f"  - {e}")
            uninstall_module(target.name)
            raise typer.Exit(1)
        
        rprint(f"[green]✓ Installed: {target.name}[/green]")
        rprint(f"  Location: {target}")
        
        if warnings:
            rprint(f"[yellow]  Warnings: {len(warnings)}[/yellow]")
        
    except Exception as e:
        rprint(f"[red]✗ Install failed: {e}[/red]")
        raise typer.Exit(1)


@app.command("add")
def add_cmd(
    url: str = typer.Argument(..., help="GitHub URL or org/repo shorthand"),
    module: str = typer.Option(None, "--module", "-m", help="Module path within repo"),
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Override module name"),
    branch: str = typer.Option("main", "--branch", "-b", help="Git branch"),
    tag: Optional[str] = typer.Option(None, "--tag", "-t", help="Git tag/version (e.g., v1.0.0)"),
):
    """
    Add a cognitive module from GitHub.
    
    Examples:
    
        cog add https://github.com/ziel-io/cognitive-modules --module code-simplifier
        
        cog add ziel-io/cognitive-modules -m code-reviewer
        
        cog add org/repo -m my-module --tag v1.0.0
        
        cog add org/repo -m path/to/module --name my-module
    """
    rprint(f"[cyan]→[/cyan] Adding module from: {url}")
    if module:
        rprint(f"  Module path: {module}")
    if tag:
        rprint(f"  Version: {tag}")
    
    try:
        target = install_from_github_url(
            url=url,
            module_path=module,
            name=name,
            branch=branch,
            tag=tag,
        )
        
        # Validate installed module
        is_valid, errors, warnings = validate_module(str(target))
        
        if not is_valid:
            rprint(f"[red]✗ Installed module failed validation:[/red]")
            for e in errors:
                rprint(f"  - {e}")
            uninstall_module(target.name)
            raise typer.Exit(1)
        
        # Get version info
        version = get_module_version(target)
        version_str = f" v{version}" if version else ""
        
        rprint(f"[green]✓ Added: {target.name}{version_str}[/green]")
        rprint(f"  Location: {target}")
        
        if warnings:
            rprint(f"[yellow]  Warnings: {len(warnings)}[/yellow]")
        
        rprint(f"\nRun with:")
        rprint(f"  [cyan]cog run {target.name} --args \"your input\"[/cyan]")
        
    except Exception as e:
        rprint(f"[red]✗ Failed to add module: {e}[/red]")
        raise typer.Exit(1)


@app.command("remove")
def remove_cmd(
    module: str = typer.Argument(..., help="Module name to remove"),
):
    """Remove an installed cognitive module (alias for uninstall)."""
    uninstall_cmd(module)


@app.command("update")
def update_cmd(
    module: str = typer.Argument(..., help="Module name to update"),
    tag: Optional[str] = typer.Option(None, "--tag", "-t", help="Update to specific tag/version"),
):
    """
    Update an installed module to the latest version.
    
    Examples:
    
        cog update code-simplifier
        
        cog update code-simplifier --tag v2.0.0
    """
    rprint(f"[cyan]→[/cyan] Updating module: {module}")
    
    # Check if module is installed
    info = get_installed_module_info(module)
    if not info:
        rprint(f"[red]✗ Module not found or not installed from GitHub: {module}[/red]")
        rprint(f"  Only modules installed with 'cog add' can be updated.")
        raise typer.Exit(1)
    
    github_url = info.get("github_url")
    if not github_url:
        rprint(f"[red]✗ Module was not installed from GitHub: {module}[/red]")
        raise typer.Exit(1)
    
    # Get current version
    current_path = USER_MODULES_DIR / module
    old_version = get_module_version(current_path) if current_path.exists() else None
    
    if old_version:
        rprint(f"  Current version: {old_version}")
    
    try:
        # Re-install from source
        module_path = info.get("module_path")
        branch = info.get("branch", "main")
        
        # Use specified tag or keep using the same ref type
        use_tag = tag or info.get("tag")
        
        target = install_from_github_url(
            url=github_url,
            module_path=module_path,
            name=module,
            branch=branch if not use_tag else "main",
            tag=use_tag,
        )
        
        # Get new version
        new_version = get_module_version(target)
        
        if old_version and new_version:
            if old_version == new_version:
                rprint(f"[green]✓ Already up to date: {module} v{new_version}[/green]")
            else:
                rprint(f"[green]✓ Updated: {module} v{old_version} → v{new_version}[/green]")
        elif new_version:
            rprint(f"[green]✓ Updated: {module} to v{new_version}[/green]")
        else:
            rprint(f"[green]✓ Updated: {module}[/green]")
        
    except Exception as e:
        rprint(f"[red]✗ Failed to update module: {e}[/red]")
        raise typer.Exit(1)


@app.command("versions")
def versions_cmd(
    url: str = typer.Argument(..., help="GitHub URL or org/repo shorthand"),
    limit: int = typer.Option(10, "--limit", "-l", help="Max versions to show"),
):
    """
    List available versions (tags) for a GitHub repository.
    
    Examples:
    
        cog versions ziel-io/cognitive-modules
        
        cog versions https://github.com/org/repo
    """
    rprint(f"[cyan]→[/cyan] Fetching versions from: {url}\n")
    
    try:
        tags = list_github_tags(url, limit=limit)
        
        if not tags:
            rprint("[yellow]No tags/versions found.[/yellow]")
            return
        
        table = Table(title=f"Available Versions ({len(tags)})")
        table.add_column("Version", style="cyan")
        table.add_column("Install Command")
        
        for tag in tags:
            cmd = f"cog add {url} --tag {tag}"
            table.add_row(tag, f"[dim]{cmd}[/dim]")
        
        console.print(table)
        
    except Exception as e:
        rprint(f"[red]✗ Failed to fetch versions: {e}[/red]")
        raise typer.Exit(1)


@app.command("uninstall")
def uninstall_cmd(
    module: str = typer.Argument(..., help="Module name to uninstall"),
):
    """Uninstall a cognitive module."""
    target = USER_MODULES_DIR / module
    
    if not target.exists():
        rprint(f"[red]Module not found in global location: {module}[/red]")
        rprint(f"  (Only modules in ~/.cognitive/modules can be uninstalled)")
        raise typer.Exit(1)
    
    if uninstall_module(module):
        rprint(f"[green]✓ Uninstalled: {module}[/green]")
    else:
        rprint(f"[red]✗ Failed to uninstall: {module}[/red]")
        raise typer.Exit(1)


@app.command("init")
def init_cmd(
    name: str = typer.Argument(..., help="Module name (lowercase, hyphenated)"),
    responsibility: str = typer.Option("（描述模块职责）", "--desc", "-d", help="One-line description"),
    target: Path = typer.Option(Path("./cognitive/modules"), "--target", "-t", help="Target directory"),
    no_examples: bool = typer.Option(False, "--no-examples", help="Skip creating examples"),
):
    """Create a new cognitive module from template."""
    # Validate name
    if not name.replace("-", "").replace("_", "").isalnum():
        rprint(f"[red]Invalid module name: {name}[/red]")
        rprint("  Use lowercase letters, numbers, and hyphens only")
        raise typer.Exit(1)
    
    name = name.lower()
    
    rprint(f"[cyan]→[/cyan] Creating module: [bold]{name}[/bold]")
    
    try:
        module_path = create_module(
            name=name,
            target_dir=target,
            responsibility=responsibility,
            with_examples=not no_examples,
        )
        
        rprint(f"[green]✓ Created module at: {module_path}[/green]")
        rprint(f"\nFiles created:")
        rprint(f"  - MODULE.md (edit this)")
        rprint(f"  - schema.json")
        if not no_examples:
            rprint(f"  - examples/input.json")
            rprint(f"  - examples/output.json")
        rprint(f"\nNext steps:")
        rprint(f"  1. Edit [cyan]MODULE.md[/cyan] to add your instructions")
        rprint(f"  2. Edit [cyan]schema.json[/cyan] to define input/output")
        rprint(f"  3. Run [cyan]cog validate {name}[/cyan] to check")
        
    except Exception as e:
        rprint(f"[red]✗ Failed to create module: {e}[/red]")
        raise typer.Exit(1)


@app.command("search")
def search_cmd(
    query: str = typer.Argument(..., help="Search query"),
):
    """Search the public module registry."""
    rprint(f"[cyan]→[/cyan] Searching registry for: {query}\n")
    
    results = search_registry(query)
    
    if not results:
        rprint("[yellow]No modules found.[/yellow]")
        return
    
    table = Table(title=f"Search Results ({len(results)})")
    table.add_column("Name", style="cyan")
    table.add_column("Description")
    table.add_column("Version", style="dim")
    
    for r in results:
        table.add_row(r["name"], r["description"], r["version"])
    
    console.print(table)
    rprint(f"\nInstall with: [cyan]cog install registry:<name>[/cyan]")


@app.command("registry")
def registry_cmd(
    refresh: bool = typer.Option(False, "--refresh", "-r", help="Force refresh from remote"),
):
    """Show public registry status and modules."""
    rprint("[cyan]→[/cyan] Fetching registry...\n")
    
    registry = fetch_registry(use_cache=not refresh)
    
    if "error" in registry:
        rprint(f"[yellow]⚠ Registry fetch warning: {registry['error']}[/yellow]")
    
    modules = registry.get("modules", {})
    
    if not modules:
        rprint("[yellow]Registry is empty or unavailable.[/yellow]")
        return
    
    table = Table(title=f"Public Registry ({len(modules)} modules)")
    table.add_column("Name", style="cyan")
    table.add_column("Description")
    table.add_column("Version", style="dim")
    
    for name, info in modules.items():
        table.add_row(name, info.get("description", ""), info.get("version", ""))
    
    console.print(table)


@app.command("doctor")
def doctor_cmd():
    """Check environment setup and provider availability."""
    rprint("[cyan]Cognitive Modules - Environment Check[/cyan]\n")
    
    status = check_provider_status()
    
    table = Table(title="LLM Providers")
    table.add_column("Provider", style="cyan")
    table.add_column("Installed")
    table.add_column("Configured")
    
    for provider in ["openai", "anthropic", "minimax", "ollama"]:
        info = status[provider]
        installed = "[green]✓[/green]" if info["installed"] else "[red]✗[/red]"
        configured = "[green]✓[/green]" if info["configured"] else "[yellow]–[/yellow]"
        table.add_row(provider, installed, configured)
    
    console.print(table)
    
    rprint(f"\nCurrent provider: [cyan]{status['current_provider']}[/cyan]")
    rprint(f"Current model: [cyan]{status['current_model']}[/cyan]")
    
    rprint("\n[cyan]Module Search Paths:[/cyan]")
    rprint(f"  1. ./cognitive/modules (project-local)")
    rprint(f"  2. ~/.cognitive/modules (user-global)")
    
    modules = list_modules()
    rprint(f"\n[cyan]Installed Modules:[/cyan] {len(modules)}")
    
    if status["current_provider"] == "stub":
        rprint("\n[yellow]⚠ Using stub provider (no real LLM)[/yellow]")
        rprint("  Set LLM_PROVIDER and API key to use a real LLM:")
        rprint("  [dim]export LLM_PROVIDER=openai[/dim]")
        rprint("  [dim]export OPENAI_API_KEY=sk-...[/dim]")


@app.command("info")
def info_cmd(
    module: str = typer.Argument(..., help="Module name or path"),
):
    """Show detailed information about a module."""
    # Find module
    path = Path(module)
    if path.exists() and path.is_dir():
        module_path = path
    else:
        module_path = find_module(module)
        if not module_path:
            rprint(f"[red]Module not found: {module}[/red]")
            raise typer.Exit(1)
    
    try:
        m = load_module(module_path)
    except Exception as e:
        rprint(f"[red]Failed to load module: {e}[/red]")
        raise typer.Exit(1)
    
    meta = m["metadata"]
    
    rprint(f"[bold cyan]{meta.get('name', module)}[/bold cyan] v{meta.get('version', '?')}")
    rprint(f"[dim]Format: {m['format']}[/dim]")
    
    rprint(f"\n[bold]Responsibility:[/bold]")
    rprint(f"  {meta.get('responsibility', 'Not specified')}")
    
    if 'excludes' in meta:
        rprint(f"\n[bold]Excludes:[/bold]")
        for exc in meta['excludes']:
            rprint(f"  - {exc}")
    
    if 'context' in meta:
        ctx = meta['context']
        ctx_desc = "隔离执行" if ctx == "fork" else "共享执行"
        rprint(f"\n[bold]Context:[/bold] {ctx} ({ctx_desc})")
    
    if 'constraints' in meta:
        rprint(f"\n[bold]Constraints:[/bold]")
        for k, v in meta['constraints'].items():
            status = "[green]✓[/green]" if v else "[red]✗[/red]"
            rprint(f"  {status} {k}")
    
    rprint(f"\n[bold]Path:[/bold] {m['path']}")
    rprint(f"[bold]Prompt size:[/bold] {len(m['prompt'])} chars")
    
    # Show installation info if available
    install_info = get_installed_module_info(meta.get('name', module))
    if install_info:
        rprint(f"\n[bold]Installation:[/bold]")
        if install_info.get("github_url"):
            rprint(f"  Source: {install_info['github_url']}")
        if install_info.get("tag"):
            rprint(f"  Tag: {install_info['tag']}")
        elif install_info.get("branch"):
            rprint(f"  Branch: {install_info['branch']}")
        if install_info.get("installed_time"):
            rprint(f"  Installed: {install_info['installed_time'][:10]}")
        rprint(f"\n  Update with: [cyan]cog update {meta.get('name', module)}[/cyan]")


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    version: bool = typer.Option(False, "--version", "-v", help="Show version"),
):
    """Cognitive Modules CLI - Structured LLM task runner."""
    if version:
        rprint(f"cog version {__version__}")
        raise typer.Exit()
    
    if ctx.invoked_subcommand is None:
        rprint(ctx.get_help())


if __name__ == "__main__":
    app()
