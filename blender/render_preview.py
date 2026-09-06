import bpy
from pathlib import Path
from mathutils import Vector

REPO_ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = REPO_ROOT / "blender" / "MiragCity_TokyoBangkok.blend"
PREVIEW_DIR = REPO_ROOT / "blender" / "previews"
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
scene = bpy.context.scene

# Fast structural review renderer: show the actual Blender geometry/material colors
# without spending CI time on final lighting.
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 1024
scene.render.resolution_y = 576
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'WORLD'
scene.display.shading.show_specular_highlight = True
scene.display.shading.background_type = 'WORLD_THEME'

for obj in list(scene.objects):
    if obj.name.startswith("PREVIEW_"):
        bpy.data.objects.remove(obj, do_unlink=True)


def make_camera(name, location, target, lens=42):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_start = 1.0
    data.clip_end = 5000.0
    cam = bpy.data.objects.new(name, data)
    scene.collection.objects.link(cam)
    cam.location = Vector(location)
    direction = Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return cam


def render(name, location, target, lens=42):
    cam = make_camera(f"PREVIEW_Camera_{name}", location, target, lens)
    scene.camera = cam
    scene.render.filepath = str(PREVIEW_DIR / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[PREVIEW] {scene.render.filepath}")

render("01_full_city_aerial", (980, -1180, 1180), (0, -40, 0), 50)
render("02_downtown_neon", (520, -520, 300), (40, 80, 50), 55)
render("03_canal_riverside", (-650, -500, 245), (-70, -150, 35), 58)
render("04_marina_docks", (720, -820, 250), (250, -420, 25), 58)

print(f"[PREVIEW] Rendered structural review images to {PREVIEW_DIR}")
