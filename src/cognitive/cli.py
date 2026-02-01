"""
Cognitive CLI - Main entry point for the cog command.

Commands:
    cog list                      List installed modules
    cog run <module> <input>      Run a module
    cog validate <module>         Validate module structure
    cog install <source>          Install module from git/local
    cog uninstall <module>        Remove an installed module
    cog doctor                    Check environment setup
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
    USER_MODULES_DIR,
)
from .runner import run_module, load_module
from .validator import validate_module
from .providers import check_provider_status

app = typer.Typer(
    name="cog",
    help="Cognitive Modules CLI - Structured LLM task runner",
    add_completion=False,
)
console = Console()


@app.command("list")
def list_cmd():
    """List all installed cognitive modules."""
    modules = list_modules()
    
    if not modules:
        rprint("[yellow]No modules found.[/yellow]")
        rprint(f"\nInstall modules with: [cyan]cog install <source>[/cyan]")
        rprint(f"Modules are searched in:")
        rprint(f"  1. ./cognitive/modules (project-local)")
        rprint(f"  2. ~/.cognitive/modules (user-global)")
        return
    
    table = Table(title="Installed Modules")
    table.add_column("Name", style="cyan")
    table.add_column("Location", style="green")
    table.add_column("Path")
    
    for m in modules:
        table.add_row(m["name"], m["location"], str(m["path"]))
    
    console.print(table)


@app.command("run")
def run_cmd(
    module: str = typer.Argument(..., help="Module name or path"),
    input_file: Path = typer.Argument(..., help="Input JSON file"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Output file"),
    pretty: bool = typer.Option(False, "--pretty", help="Pretty-print JSON output"),
    no_validate: bool = typer.Option(False, "--no-validate", help="Skip validation"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="LLM model override"),
):
    """Run a cognitive module with input data."""
    # Load input
    if not input_file.exists():
        rprint(f"[red]Error: Input file not found: {input_file}[/red]")
        raise typer.Exit(1)
    
    with open(input_file, 'r', encoding='utf-8') as f:
        input_data = json.load(f)
    
    rprint(f"[cyan]→[/cyan] Running module: [bold]{module}[/bold]")
    
    try:
        result = run_module(
            module,
            input_data,
            validate_input=not no_validate,
            validate_output=not no_validate,
            model=model,
        )
        
        # Format output
        indent = 2 if pretty else None
        output_json = json.dumps(result, indent=indent, ensure_ascii=False)
        
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(output_json)
            rprint(f"[green]✓[/green] Output saved to: {output}")
        else:
            print(output_json)
        
        # Show confidence if present
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
    source: str = typer.Argument(..., help="Source: github:org/repo/path, git+https://..., or local path"),
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Override module name"),
):
    """Install a cognitive module from git or local path."""
    rprint(f"[cyan]→[/cyan] Installing from: {source}")
    
    try:
        target = install_module(source, name)
        
        # Validate after install
        is_valid, errors, warnings = validate_module(str(target))
        
        if not is_valid:
            rprint(f"[red]✗ Installed module failed validation:[/red]")
            for e in errors:
                rprint(f"  - {e}")
            # Rollback
            uninstall_module(target.name)
            raise typer.Exit(1)
        
        rprint(f"[green]✓ Installed: {target.name}[/green]")
        rprint(f"  Location: {target}")
        
        if warnings:
            rprint(f"[yellow]  Warnings: {len(warnings)}[/yellow]")
        
    except Exception as e:
        rprint(f"[red]✗ Install failed: {e}[/red]")
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


@app.command("doctor")
def doctor_cmd():
    """Check environment setup and provider availability."""
    rprint("[cyan]Cognitive Modules - Environment Check[/cyan]\n")
    
    status = check_provider_status()
    
    # Provider table
    table = Table(title="LLM Providers")
    table.add_column("Provider", style="cyan")
    table.add_column("Installed")
    table.add_column("Configured")
    
    for provider in ["openai", "anthropic", "ollama"]:
        info = status[provider]
        installed = "[green]✓[/green]" if info["installed"] else "[red]✗[/red]"
        configured = "[green]✓[/green]" if info["configured"] else "[yellow]–[/yellow]"
        table.add_row(provider, installed, configured)
    
    console.print(table)
    
    rprint(f"\nCurrent provider: [cyan]{status['current_provider']}[/cyan]")
    rprint(f"Current model: [cyan]{status['current_model']}[/cyan]")
    
    # Module locations
    rprint("\n[cyan]Module Search Paths:[/cyan]")
    rprint(f"  1. ./cognitive/modules (project-local)")
    rprint(f"  2. ~/.cognitive/modules (user-global)")
    
    # Installed modules count
    modules = list_modules()
    rprint(f"\n[cyan]Installed Modules:[/cyan] {len(modules)}")
    
    # Recommendations
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
    try:
        m = load_module(module)
    except FileNotFoundError:
        rprint(f"[red]Module not found: {module}[/red]")
        raise typer.Exit(1)
    
    meta = m["metadata"]
    
    rprint(f"[bold cyan]{meta.get('name', module)}[/bold cyan] v{meta.get('version', '?')}")
    rprint(f"\n[bold]Responsibility:[/bold]")
    rprint(f"  {meta.get('responsibility', 'Not specified')}")
    
    if 'excludes' in meta:
        rprint(f"\n[bold]Excludes:[/bold]")
        for exc in meta['excludes']:
            rprint(f"  - {exc}")
    
    rprint(f"\n[bold]Path:[/bold] {m['path']}")
    rprint(f"[bold]Prompt size:[/bold] {len(m['prompt'])} chars")


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
