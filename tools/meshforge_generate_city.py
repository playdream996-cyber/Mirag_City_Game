#!/usr/bin/env python3
"""Generate Mirage City GLB assets through a local MeshForge3D MCP server.

This script does not bypass MeshForge licensing. In free mode it uses the
image->3D tool with user-supplied reference images. Text->3D is only selected
when MeshForge reports a valid non-free tier.

Examples:
  python tools/meshforge_generate_city.py --meshforge C:/Tools/MeshForge3D --mode auto
  python tools/meshforge_generate_city.py --meshforge C:/Tools/MeshForge3D --mode image
  python tools/meshforge_generate_city.py --meshforge C:/Tools/MeshForge3D --mode text --ids apex_tower police_hq
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "public" / "assets" / "meshforge" / "manifest.json"
OUTPUT_DIR = MANIFEST_PATH.parent
REFS_DIR = ROOT / "tools" / "meshforge_refs"


class MCPClient:
    def __init__(self, python_exe: str, server_path: Path):
        self.proc = subprocess.Popen(
            [python_exe, str(server_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=None,
            text=True,
            bufsize=1,
        )
        self.next_id = 1
        self._request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "mirage-city-generator", "version": "1.0"},
        })
        self._notify("notifications/initialized", {})

    def close(self) -> None:
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()

    def _send(self, payload: dict[str, Any]) -> None:
        if not self.proc.stdin:
            raise RuntimeError("MeshForge MCP stdin is unavailable")
        self.proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
        self.proc.stdin.flush()

    def _read_for_id(self, request_id: int) -> dict[str, Any]:
        if not self.proc.stdout:
            raise RuntimeError("MeshForge MCP stdout is unavailable")
        while True:
            line = self.proc.stdout.readline()
            if not line:
                code = self.proc.poll()
                raise RuntimeError(f"MeshForge MCP stopped unexpectedly (exit={code})")
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == request_id:
                return msg

    def _request(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        request_id = self.next_id
        self.next_id += 1
        self._send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        response = self._read_for_id(request_id)
        if "error" in response:
            raise RuntimeError(response["error"])
        return response.get("result", {})

    def _notify(self, method: str, params: dict[str, Any]) -> None:
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        result = self._request("tools/call", {"name": name, "arguments": arguments})
        blocks = result.get("content", [])
        text = next((b.get("text") for b in blocks if b.get("type") == "text"), None)
        if text is None:
            raise RuntimeError(f"MeshForge returned no text payload for {name}")
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            raise RuntimeError(text)
        if result.get("isError") or data.get("success") is False:
            raise RuntimeError(data.get("error") or text)
        return data


def load_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def find_reference(asset_id: str) -> Path | None:
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        path = REFS_DIR / f"{asset_id}{ext}"
        if path.is_file():
            return path
    return None


def copy_generated(src: str, target_name: str) -> Path:
    source = Path(src).resolve()
    if not source.is_file():
        raise FileNotFoundError(f"MeshForge reported a GLB that does not exist: {source}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUTPUT_DIR / target_name
    shutil.copy2(source, target)
    return target


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Mirage City assets with MeshForge3D")
    parser.add_argument("--meshforge", required=True, help="Path to a local MeshForge3D checkout")
    parser.add_argument("--python", default=sys.executable, help="Python executable from the MeshForge environment")
    parser.add_argument("--mode", choices=("auto", "image", "text"), default="auto")
    parser.add_argument("--model-key", default="dreamshaper", choices=("dreamshaper", "sd15", "sd-turbo", "sdxl-turbo"))
    parser.add_argument("--resolution", type=int, default=256, choices=(128, 256, 384))
    parser.add_argument("--ids", nargs="*", default=[], help="Only generate these manifest asset ids")
    parser.add_argument("--force", action="store_true", help="Regenerate files that already exist")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    meshforge = Path(args.meshforge).expanduser().resolve()
    server = meshforge / "mcp_server" / "meshforge_mcp.py"
    if not server.is_file():
        print(f"ERROR: MCP server not found: {server}", file=sys.stderr)
        return 2

    manifest = load_manifest()
    assets = list(manifest.get("assets", []))
    if args.ids:
        wanted = set(args.ids)
        assets = [a for a in assets if a.get("id") in wanted]
        missing_ids = wanted - {a.get("id") for a in assets}
        if missing_ids:
            print("Unknown manifest ids:", ", ".join(sorted(missing_ids)), file=sys.stderr)
            return 2

    REFS_DIR.mkdir(parents=True, exist_ok=True)
    client = MCPClient(args.python, server)
    try:
        status = client.tool("get_status", {})
        tier = str(status.get("license_tier") or "free").lower()
        valid = bool(status.get("license_valid"))
        print("MeshForge status:", json.dumps(status, indent=2))

        mode = args.mode
        if mode == "auto":
            mode = "text" if valid and tier not in ("free", "none") else "image"

        if mode == "text" and (not valid or tier in ("free", "none")):
            print(
                "ERROR: MeshForge reports the Free tier. This pipeline will not bypass the tier policy.\n"
                "Use --mode image and place reference images in tools/meshforge_refs/<asset_id>.png,\n"
                "or activate a MeshForge tier that provides text-to-image/text-to-3D.",
                file=sys.stderr,
            )
            return 3

        generated = 0
        skipped = 0
        failed = 0
        started = time.time()

        for index, asset in enumerate(assets, start=1):
            asset_id = asset["id"]
            target = OUTPUT_DIR / asset["file"]
            if target.is_file() and not args.force:
                print(f"[{index}/{len(assets)}] SKIP {asset_id} -> {target.name}")
                skipped += 1
                continue

            print(f"[{index}/{len(assets)}] GENERATE {asset_id} ({mode})")
            try:
                if mode == "text":
                    result = client.tool("text_to_3d", {
                        "prompt": asset["prompt"],
                        "model_key": args.model_key,
                        "seed": 1000 + index,
                    })
                else:
                    reference = find_reference(asset_id)
                    if reference is None:
                        print(f"  MISSING reference: {REFS_DIR / (asset_id + '.png')}")
                        failed += 1
                        continue
                    result = client.tool("generate_model", {
                        "image_path": str(reference.resolve()),
                        "resolution": args.resolution,
                    })

                final_path = copy_generated(result["glb_path"], asset["file"])
                stats = result.get("stats", {})
                print(f"  OK -> {final_path.relative_to(ROOT)} | {stats}")
                generated += 1
            except Exception as exc:
                failed += 1
                print(f"  FAILED: {exc}")

        elapsed = time.time() - started
        print(f"Done in {elapsed:.1f}s | generated={generated} skipped={skipped} failed={failed}")
        print("Open the deployed /mirage-world.html page; it auto-loads any GLBs present in public/assets/meshforge/.")
        return 0 if failed == 0 else 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
