#!/usr/bin/env python3
"""Compatibility runner for the Mirag City modular Downtown generator.

Keeps Blender-version-specific setup outside the main generator. In particular,
it enables glTF I/O when needed and patches collection membership handling so
headless Blender versions do not depend on string membership semantics.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

GENERATOR = Path(__file__).with_name("generate_mirage_downtown.py")
spec = importlib.util.spec_from_file_location("mirage_downtown_generator", GENERATOR)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not load generator: {GENERATOR}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    if collection not in obj.users_collection:
        collection.objects.link(obj)
    for current in list(obj.users_collection):
        if current != collection:
            current.objects.unlink(obj)


module.move_to_collection = move_to_collection

try:
    bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
except Exception:
    # Newer Blender distributions register glTF I/O without requiring this.
    pass

raise SystemExit(module.main())
