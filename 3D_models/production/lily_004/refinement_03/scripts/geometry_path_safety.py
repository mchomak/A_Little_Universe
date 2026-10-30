"""Path guards shared by the geometry author and verifier CLIs."""

from pathlib import Path


def is_within(path, root):
    try:
        Path(path).resolve().relative_to(Path(root).resolve())
        return True
    except ValueError:
        return False


def resolve_output_root(script_path, requested_root):
    package_root = Path(script_path).resolve().parent.parent
    root = Path(requested_root).resolve()
    if not is_within(root, package_root):
        raise RuntimeError(f"Refusing output root outside geometry package: {root}")
    baseline_root = package_root / "baseline"
    if is_within(root, baseline_root):
        raise RuntimeError(f"Refusing output root inside read-only baseline tree: {root}")
    return package_root, root


def paths_overlap(first, second):
    first = Path(first).resolve()
    second = Path(second).resolve()
    return is_within(first, second) or is_within(second, first)


def validate_output_paths(output_root, outputs, inputs=(), protected_roots=()):
    root = Path(output_root).resolve()
    resolved_outputs = {name: Path(path).resolve() for name, path in outputs.items()}
    for name, path in resolved_outputs.items():
        if not is_within(path, root):
            raise RuntimeError(f"Refusing {name} output outside output root: {path}")
        for protected in protected_roots:
            if paths_overlap(path, protected):
                raise RuntimeError(f"Refusing {name} output overlapping protected read-only tree: {protected}")
        for label, input_path in inputs:
            if input_path is not None and paths_overlap(path, input_path):
                raise RuntimeError(f"Refusing {name} output overlapping input {label}: {input_path}")

    items = list(resolved_outputs.items())
    for index, (name, path) in enumerate(items):
        for other_name, other_path in items[index + 1:]:
            if paths_overlap(path, other_path):
                raise RuntimeError(f"Refusing overlapping geometry outputs: {name} and {other_name}")
    return resolved_outputs
