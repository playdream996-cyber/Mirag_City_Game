import bpy
import math
from pathlib import Path
from mathutils import Vector

REPO_ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = REPO_ROOT / "blender" / "MiragCity_TokyoBangkok.blend"
PREVIEW_DIR = REPO_ROOT / "blender" / "previews"
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
scene = bpy.context.scene

# Clean previous preview-only cameras/lights.
for obj in list(scene.objects):
    if obj.name.startswith("PREVIEW_"):
        bpy.data.objects.remove(obj, do_unlink=True)

# Ubuntu 24.04 currently ships Blender 4.0, whose Eevee id is BLENDER_EEVEE.
# Newer Blender builds renamed it to BLENDER_EEVEE_NEXT, so choose whichever exists.
engine_items = {item.identifier for item in scene.bl_rna.properties['render'].fixed_type.properties['engine'].enum_items}
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engine_items else 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False

# Neutral daylight so geometry/readability matters more than effects.
scene.world.color = (0.055, 0.075, 0.11)

sun_data = bpy.data.lights.new("PREVIEW_Sun", type='SUN')
sun_data.energy = 3.2
sun_data.angle = math.radians(18)
sun = bpy.data.objects.new("PREVIEW_Sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-32))

fill_data = bpy.data.lights.new("PREVIEW_Fill", type='AREA')
fill_data.energy = 2200
fill_data.shape = 'DISK'
fill_data.size = 900
fill = bpy.data.objects.new("PREVIEW_Fill", fill_data)
scene.collection.objects.link(fill)
fill.location = (-180, -120, 650)


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

# 1) Full map review view.
render("01_full_city_aerial", (980, -1180, 1180), (0, -40, 0), 50)
# 2) Downtown / Neon / river direction.
render("02_downtown_neon", (520, -520, 300), (40, 80, 50), 55)
# 3) Canal Town -> Riverside / skyline direction.
render("03_canal_riverside", (-650, -500, 245), (-70, -150, 35), 58)
# 4) Marina / industrial waterfront.
render("04_marina_docks", (720, -820, 250), (250, -420, 25), 58)

print(f"[PREVIEW] Rendered review images to {PREVIEW_DIR}")
