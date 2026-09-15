#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gc
import json
import os
import sys
import time
from pathlib import Path

import torch
from PIL import Image
from huggingface_hub import HfApi
from diffusers import AutoPipelineForText2Image


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--meshforge", required=True)
    p.add_argument("--manifest", required=True)
    p.add_argument("--output", default="/workspace/meshforge-out")
    p.add_argument("--repo", default="playdream99/mirage-city-meshforge-assets")
    p.add_argument("--resolution", type=int, default=192)
    p.add_argument("--ids", nargs="*", default=[])
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--image-model", default="stabilityai/sd-turbo")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU is not available in this job")

    print("GPU:", torch.cuda.get_device_name(0), flush=True)
    out = Path(args.output)
    concepts = out / "concepts"
    glbs = out / "glb"
    concepts.mkdir(parents=True, exist_ok=True)
    glbs.mkdir(parents=True, exist_ok=True)

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    assets = list(manifest["assets"])
    if args.ids:
        wanted = set(args.ids)
        assets = [a for a in assets if a["id"] in wanted]
    if args.limit > 0:
        assets = assets[: args.limit]
    print(f"Assets selected: {len(assets)}", flush=True)

    # Stage 1: prompt -> isolated reference images. This is deliberately separate
    # from MeshForge so its Free image->3D policy is not bypassed.
    print("Loading concept-image model...", flush=True)
    try:
        pipe = AutoPipelineForText2Image.from_pretrained(
            args.image_model, torch_dtype=torch.float16, variant="fp16"
        )
    except Exception:
        pipe = AutoPipelineForText2Image.from_pretrained(
            args.image_model, torch_dtype=torch.float16
        )
    pipe = pipe.to("cuda")
    pipe.set_progress_bar_config(disable=False)

    for i, asset in enumerate(assets, 1):
        prompt = (
            asset["prompt"]
            + ", single isolated building, entire object visible, centered, neutral white studio background, "
              "no ground plane, no surrounding city, no people, no vehicles, clean silhouette, architectural visualization"
        )
        concept_path = concepts / f"{asset['id']}.png"
        if concept_path.exists():
            continue
        gen = torch.Generator(device="cuda").manual_seed(7300 + i)
        image = pipe(
            prompt=prompt,
            num_inference_steps=2,
            guidance_scale=0.0,
            width=512,
            height=512,
            generator=gen,
        ).images[0].convert("RGB")
        image.save(concept_path)
        print(f"CONCEPT {i}/{len(assets)} {asset['id']} -> {concept_path}", flush=True)

    del pipe
    gc.collect()
    torch.cuda.empty_cache()

    # Stage 2: run MeshForge's image preprocessing + TSREngine in Free geometry mode.
    mf = Path(args.meshforge).resolve()
    sys.path.insert(0, str(mf / "app"))
    sys.path.insert(0, str(mf / "tsr_sdk"))
    from core.image_preprocessor import ImagePreprocessor
    from core.mesh_processor import MeshProcessor
    from core.tsr_engine import TSREngine

    prep = ImagePreprocessor()
    processor = MeshProcessor()
    engine = TSREngine(str(mf / "app" / "models"))
    engine.load("auto")

    results = []
    started = time.time()
    for i, asset in enumerate(assets, 1):
        asset_id = asset["id"]
        target = glbs / asset["file"]
        try:
            source = Image.open(concepts / f"{asset_id}.png").convert("RGB")
            # Concept images intentionally have uniform backgrounds, so the MeshForge
            # preprocessor can isolate them without invoking rembg.
            model_input, preview = prep.process_for_model(source, foreground_ratio=0.86, remove_bg=False)
            preview.save(concepts / f"{asset_id}_cutout.png")
            mesh, bake_output, elapsed = engine.generate(
                model_input,
                resolution=min(args.resolution, 256),
                texture_mode="none",
                bake_uv_texture=False,
                chunk_size=8192,
            )
            processor.export_glb(mesh, str(target), bake_output=None)
            stats = processor.get_mesh_stats(mesh)
            results.append({"id": asset_id, "file": asset["file"], "success": True, "seconds": round(elapsed, 2), "stats": stats})
            print(f"GLB {i}/{len(assets)} {asset_id} {stats} -> {target}", flush=True)
        except Exception as exc:
            results.append({"id": asset_id, "file": asset["file"], "success": False, "error": repr(exc)})
            print(f"FAILED {asset_id}: {exc!r}", flush=True)

    summary = {
        "generator": "MeshForge3D TSREngine",
        "gpu": torch.cuda.get_device_name(0),
        "resolution": min(args.resolution, 256),
        "elapsed_seconds": round(time.time() - started, 1),
        "results": results,
    }
    (out / "generation-status.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Persist output on the Hub so the web world can stream the GLBs directly.
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN not available to job")
    api = HfApi(token=token)
    api.create_repo(repo_id=args.repo, repo_type="dataset", private=False, exist_ok=True)
    api.upload_folder(folder_path=str(glbs), repo_id=args.repo, repo_type="dataset", path_in_repo="glb")
    api.upload_folder(folder_path=str(concepts), repo_id=args.repo, repo_type="dataset", path_in_repo="concepts")
    api.upload_file(path_or_fileobj=str(out / "generation-status.json"), path_in_repo="generation-status.json", repo_id=args.repo, repo_type="dataset")
    print(f"UPLOADED hf://datasets/{args.repo}", flush=True)

    failed = [r for r in results if not r["success"]]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
