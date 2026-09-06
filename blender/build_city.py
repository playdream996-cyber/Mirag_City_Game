import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

REPO_ROOT = Path(__file__).resolve().parents[1]
CITY_KIT = REPO_ROOT / "public" / "assets" / "city-kit"
NEON_KIT = REPO_ROOT / "public" / "assets" / "neon-tech"
OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "city-generated"
BLEND_PATH = REPO_ROOT / "blender" / "MiragCity_TokyoBangkok.blend"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DISTRICTS = {
    "hills-vip": {"label": "Hills / VIP District"},
    "old-market": {"label": "Old Market"},
    "central-downtown": {"label": "Central Downtown"},
    "tech-port": {"label": "Tech / Port"},
    "neon-quarter": {"label": "Neon Quarter"},
    "canal-town": {"label": "Canal Town"},
    "riverside": {"label": "Riverside"},
    "industrial-docks": {"label": "Industrial Docks"},
    "beach-marina": {"label": "Beach / Marina"},
}

BUILDING_FILES = ["Building_Small_1.gltf","Building_Medium_2_001.gltf","Building_Large_2.gltf"]
NEON_FILES = ["floorplain.glb","floorsquare.glb","lightplain.glb","lightsquare.glb",
              "pillar1a.glb","pillar2a.glb","stairs.glb","stairslight.glb",
              "ramp.glb","controlpanel.glb","crate.glb"]

def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    base = bpy.data.collections.get("Collection")
    if base:
        base.name = "CITY_ROOT"
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0

def ensure_collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c

def move_to_collection(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)

def mat(name, color, metallic=0.0, roughness=0.6, emission=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color,1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color,1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emission,1.0)
                bsdf.inputs["Emission Strength"].default_value = strength
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = (*emission,1.0)
    return m

def setup_materials():
    return {
        "ground": mat("M_Ground",(0.075,0.085,0.08),roughness=0.95),
        "road": mat("M_Road",(0.018,0.022,0.028),roughness=0.82),
        "sidewalk": mat("M_Sidewalk",(0.34,0.35,0.36),roughness=0.88),
        "concrete": mat("M_Concrete",(0.28,0.30,0.33),roughness=0.82),
        "concrete_light": mat("M_ConcreteLight",(0.52,0.54,0.57),roughness=0.78),
        "metal": mat("M_Metal",(0.10,0.12,0.14),metallic=0.75,roughness=0.34),
        "glass": mat("M_Glass",(0.035,0.09,0.13),metallic=0.15,roughness=0.18),
        "darkglass": mat("M_DarkGlass",(0.018,0.035,0.055),metallic=0.2,roughness=0.16),
        "warmglass": mat("M_WarmGlass",(0.12,0.07,0.035),roughness=0.24,emission=(1.0,0.48,0.16),strength=1.8),
        "water": mat("M_Water",(0.01,0.10,0.17),metallic=0.1,roughness=0.16),
        "sand": mat("M_Sand",(0.55,0.47,0.30),roughness=0.95),
        "green": mat("M_Green",(0.04,0.16,0.07),roughness=0.9),
        "red": mat("M_Red",(0.34,0.035,0.035),roughness=0.62),
        "cyan": mat("M_NeonCyan",(0.01,0.08,0.10),roughness=0.28,emission=(0.0,0.9,1.0),strength=6.5),
        "magenta": mat("M_NeonMagenta",(0.10,0.01,0.065),roughness=0.28,emission=(1.0,0.02,0.42),strength=6.0),
        "violet": mat("M_NeonViolet",(0.055,0.02,0.11),roughness=0.28,emission=(0.52,0.08,1.0),strength=5.5),
        "amber": mat("M_Amber",(0.12,0.06,0.01),roughness=0.3,emission=(1.0,0.42,0.05),strength=4.0),
        "white_emissive": mat("M_WhiteEmissive",(0.16,0.16,0.16),roughness=0.28,emission=(1.0,0.95,0.82),strength=3.2),
    }

def add_box(name, loc, dims, material, col, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material: o.data.materials.append(material)
    if bevel > 0:
        mod = o.modifiers.new("Bevel","BEVEL")
        mod.width = bevel
        mod.segments = 2
    move_to_collection(o,col)
    return o

def add_cylinder(name, loc, radius, depth, material, col, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object
    o.name=name
    if material: o.data.materials.append(material)
    move_to_collection(o,col)
    return o

def add_text(name, body, loc, rotation, size, material, col):
    curve = bpy.data.curves.new(name+"_Curve","FONT")
    curve.body = body
    curve.align_x='CENTER'
    curve.align_y='CENTER'
    curve.size=size
    curve.extrude=0.08
    obj=bpy.data.objects.new(name,curve)
    col.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=rotation
    if material: obj.data.materials.append(material)
    return obj

def make_tower(name, loc, base, height, mats, col, style=0):
    w,d=base
    if style==0:
        add_box(name+"_Core",(loc[0],loc[1],height/2),(w,d,height),mats["darkglass"],col,1.2)
        add_box(name+"_Crown",(loc[0],loc[1],height+4),(w*0.72,d*0.72,8),mats["metal"],col,0.8)
        for z in range(12,int(height),10):
            add_box(f"{name}_Band_{z}",(loc[0],loc[1]-d/2-0.25,z),(w*0.92,0.3,0.45),mats["white_emissive"],col)
    elif style==1:
        add_box(name+"_Base",(loc[0],loc[1],height*0.34),(w,d,height*0.68),mats["concrete"],col,1.0)
        add_box(name+"_Upper",(loc[0]+w*0.08,loc[1],height*0.74),(w*0.78,d*0.82,height*0.52),mats["glass"],col,1.1)
        add_box(name+"_Fin",(loc[0]-w*0.27,loc[1],height*0.76),(3,d*0.9,height*0.48),mats["metal"],col,0.4)
    else:
        add_box(name+"_Podium",(loc[0],loc[1],7),(w*1.1,d*1.08,14),mats["concrete_light"],col,1.0)
        add_box(name+"_ShaftA",(loc[0]-w*0.18,loc[1],height*0.55),(w*0.52,d*0.8,height*0.9),mats["glass"],col,1.1)
        add_box(name+"_ShaftB",(loc[0]+w*0.20,loc[1]+d*0.04,height*0.48),(w*0.38,d*0.68,height*0.72),mats["darkglass"],col,1.0)

def make_midrise(name, loc, w, d, h, mats, col, accent=None):
    add_box(name+"_Body",(loc[0],loc[1],h/2),(w,d,h),mats["concrete"],col,0.75)
    add_box(name+"_Glass",(loc[0],loc[1]-d/2-0.2,h*0.55),(w*0.78,0.35,h*0.58),mats["glass"],col,0.1)
    add_box(name+"_Roof",(loc[0],loc[1],h+1.0),(w*0.72,d*0.72,2.0),mats["metal"],col,0.4)
    if accent:
        add_box(name+"_Accent",(loc[0],loc[1]-d/2-0.4,h*0.35),(w*0.9,0.35,0.8),accent,col,0.08)

def make_bank(loc,mats,col):
    x,y=loc
    add_box("BANK_Podium",(x,y,5),(68,50,10),mats["concrete_light"],col,1.2)
    add_box("BANK_Tower",(x,y+4,32),(42,34,54),mats["glass"],col,1.3)
    for ix in (-24,-12,0,12,24):
        add_box(f"BANK_Column_{ix}",(x+ix,y-26,5),(3,3,10),mats["metal"],col,0.3)
    add_text("BANK_Sign","MIRAG BANK",(x,y-26.8,10.2),(math.radians(90),0,0),3.5,mats["white_emissive"],col)

def make_police_hq(loc,mats,col):
    x,y=loc
    add_box("POLICE_Base",(x,y,8),(72,52,16),mats["concrete"],col,1.2)
    add_box("POLICE_Tower",(x+8,y+2,30),(38,38,44),mats["darkglass"],col,1.0)
    add_box("POLICE_RoofPad",(x+8,y+2,53),(24,24,1.0),mats["concrete_light"],col,0.4)
    add_box("POLICE_BlueBar",(x,y-26.5,11),(48,0.5,1.2),mats["cyan"],col,0.1)
    add_text("POLICE_Sign","POLICE HQ",(x,y-27,14),(math.radians(90),0,0),2.8,mats["white_emissive"],col)

def make_casino(loc,mats,col):
    x,y=loc
    add_box("CASINO_Base",(x,y,7),(74,48,14),mats["metal"],col,1.5)
    add_box("CASINO_Tower",(x+12,y+3,27),(38,34,40),mats["darkglass"],col,1.4)
    add_box("CASINO_Canopy",(x,y-27,5),(58,10,3),mats["magenta"],col,0.9)
    add_text("CASINO_Sign","NEON PALACE",(x,y-33,11),(math.radians(90),0,0),3.2,mats["magenta"],col)
    for dx in (-24,-12,0,12,24):
        add_box(f"CASINO_Vert_{dx}",(x+dx,y-24,15),(1.0,0.45,18),mats["cyan" if dx%24==0 else "violet"],col,0.1)

def make_garage(loc,mats,col):
    x,y=loc
    add_box("GARAGE_Main",(x,y,5),(68,46,10),mats["concrete"],col,0.8)
    add_box("GARAGE_Door",(x,y-23.4,4),(34,0.5,7.5),mats["metal"],col,0.15)
    add_box("GARAGE_Header",(x,y-24,10),(50,1.0,2.0),mats["cyan"],col,0.2)
    add_text("GARAGE_Sign","PLAYER GARAGE",(x,y-24.8,13),(math.radians(90),0,0),2.8,mats["cyan"],col)

def street_lamp(name,x,y,mats,col,rot=0):
    add_cylinder(name+"_Pole",(x,y,4),0.16,8,mats["metal"],col,12)
    head=add_box(name+"_Head",(x,y,8.1),(2.2,0.7,0.4),mats["white_emissive"],col,0.15)
    head.rotation_euler[2]=rot

def add_bollard_row(prefix,start,count,step,mats,col):
    sx,sy=start
    for i in range(count):
        add_cylinder(f"{prefix}_{i}",(sx+i*step,sy,0.55),0.22,1.1,mats["metal"],col,12)

def build_map_base(cols,mats):
    common=ensure_collection("COMMON_INFRASTRUCTURE")
    add_box("CityGround",(0,0,-0.4),(1500,1500,0.8),mats["ground"],common)
    add_box("SouthSea",(0,-650,0),(1500,220,0.3),mats["water"],cols["beach-marina"])
    add_box("Beach",(-90,-520,0.08),(850,95,0.18),mats["sand"],cols["beach-marina"])
    add_box("MarinaWater",(315,-515,0.02),(310,125,0.2),mats["water"],cols["beach-marina"])
    add_box("RiverSouth",(0,-260,0.02),(92,330,0.2),mats["water"],cols["riverside"])
    add_box("RiverNorth",(-20,-30,0.02),(60,150,0.2),mats["water"],cols["riverside"])
    for z in (-225,-165,-105):
        add_box(f"Canal_{z}",(-300,z,0.02),(360,22,0.2),mats["water"],cols["canal-town"])
    for i,(loc,dims) in enumerate([
        ((0,165,0.12),(1180,36,0.24)),((0,95,0.12),(1100,24,0.24)),((0,245,0.12),(1100,24,0.24)),
        ((0,315,0.12),(1100,24,0.24)),((0,35,0.12),(1100,24,0.24)),((0,-455,0.12),(980,28,0.24)),
        ((0,170,0.12),(36,780,0.24)),((-185,150,0.12),(26,760,0.24)),((190,140,0.12),(26,800,0.24)),
    ]):
        add_box(f"Road_{i}",loc,dims,mats["road"],common)
    for x in (-164,-206,-24,24,164,206):
        add_box(f"DT_SidewalkV_{x}",(x,150,0.27),(8,360,0.3),mats["sidewalk"],common)
    for y in (78,112,148,182,228,262,298,332,18,52,-8,-42,-72,-106):
        add_box(f"DT_SidewalkH_{y}",(20,y,0.27),(430,7,0.3),mats["sidewalk"],common)
    for x in range(-500,501,38):
        add_box(f"LaneEW_{x}",(x,165,0.27),(14,0.45,0.05),mats["concrete_light"],common)
    for y in range(-120,401,34):
        add_box(f"LaneNS_{y}",(0,y,0.27),(0.45,12,0.05),mats["concrete_light"],common)
    add_box("ExpresswayEW",(150,285,8.0),(680,16,0.8),mats["road"],common)
    for x in range(-140,441,72):
        add_box(f"ExpressPillar_{x}",(x,285,3.8),(2.6,2.6,7.6),mats["concrete"],common)
    for z in (-225,-165,-105):
        for x in (-365,-235):
            add_box(f"CanalBridge_{x}_{z}",(x,z,0.65),(24,36,1.1),mats["road"],cols["canal-town"])
    for z in (-55,-195,-455):
        target="beach-marina" if z==-455 else "riverside"
        add_box(f"RiverBridge_{z}",(0,z,0.68),(132,28,1.1),mats["road"],cols[target])

def build_premium_downtown(cols,mats):
    c=cols["central-downtown"]
    make_tower("DT_Apex",(-105,215,0),(52,52),112,mats,c,0)
    make_tower("DT_Arcology",(85,225,0),(58,50),96,mats,c,1)
    make_tower("DT_Twin",(-85,305,0),(56,52),86,mats,c,2)
    make_tower("DT_Skyline",(95,315,0),(50,48),78,mats,c,0)
    make_tower("DT_MetroTower",(145,125,0),(42,42),70,mats,c,1)
    positions=[(-145,120),(-80,120),(-15,120),(65,120),(-145,185),(-25,185),(145,190),(-145,255),(-20,255),(145,255),(-145,335),(-20,335),(145,335)]
    for i,(x,y) in enumerate(positions):
        if abs(x)<35 and 150<y<285: continue
        make_midrise(f"DT_Mid_{i}",(x,y,0),38+(i%3)*4,36+(i%2)*6,28+(i%4)*7,mats,c,mats["amber"] if i%4==0 else None)
    make_bank((-110,55),mats,c)
    make_police_hq((105,55),mats,c)
    add_box("DT_CivicPlaza",(0,105,0.18),(105,58,0.25),mats["sidewalk"],c)
    for i,x in enumerate(range(-40,41,20)):
        add_box(f"PlazaBench_{i}",(x,112,0.7),(7,1.4,1.0),mats["metal"],c,0.2)
    for x in range(-160,181,40):
        street_lamp(f"DTLampN_{x}",x,145,mats,c)
        street_lamp(f"DTLampS_{x}",x,185,mats,c)
    add_bollard_row("BankBollard",(-136,28),7,9,mats,c)
    for i,(x,y) in enumerate([(-145,120),(-15,120),(65,120),(-25,185),(145,190),(-20,255),(145,255)]):
        add_box(f"DT_HVAC_{i}",(x,y,36+(i%3)*4),(8,5,3),mats["metal"],c,0.4)

def import_template(filepath, source_collection):
    before=set(bpy.context.scene.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=str(filepath))
    except Exception as exc:
        print(f"[WARN] Could not import {filepath.name}: {exc}")
        return []
    imported=[o for o in bpy.context.scene.objects if o not in before]
    roots=[o for o in imported if o.parent is None]
    for o in imported:
        move_to_collection(o,source_collection); o.hide_render=True; o.hide_viewport=True
    return roots

def duplicate_hierarchy(root, collection, name, loc, scale=1.0, rotation_z=0.0):
    mapping={}
    stack=[root]; all_nodes=[]
    while stack:
        cur=stack.pop(); all_nodes.append(cur); stack.extend(list(cur.children))
    for old in all_nodes:
        new=old.copy()
        if old.data: new.data=old.data.copy()
        new.hide_render=False; new.hide_viewport=False
        collection.objects.link(new); mapping[old]=new
    for old,new in mapping.items():
        if old.parent in mapping: new.parent=mapping[old.parent]
    nr=mapping[root]; nr.name=name; nr.location=Vector(loc); nr.scale=(scale,scale,scale); nr.rotation_euler[2]=rotation_z
    return nr

def build_premium_neon(cols,mats,neon_templates):
    c=cols["neon-quarter"]
    blocks=[(-110,-70,34,30,34),(-55,-70,32,30,40),(5,-70,30,30,46),(65,-70,34,30,36),(125,-70,34,30,42),(-105,-10,36,34,42),(-40,-10,34,34,32),(35,-10,34,34,38),(105,-10,40,34,44),(-95,50,40,32,32),(-25,50,34,32,38),(55,50,36,32,46),(125,50,38,32,36)]
    for i,(x,y,w,d,h) in enumerate(blocks):
        make_midrise(f"NQ_Block_{i}",(x,y,0),w,d,h,mats,c,[mats["cyan"],mats["magenta"],mats["violet"]][i%3])
        signmat=[mats["cyan"],mats["magenta"],mats["violet"]][(i+1)%3]
        add_box(f"NQ_Blade_{i}",(x+w/2+0.6,y-d/2-0.5,h*0.62),(1.5,0.6,10+(i%3)*4),signmat,c,0.18)
    make_casino((-105,-125),mats,c)
    make_garage((95,-125),mats,c)
    add_box("NQ_AlleyFloor",(0,-115,0.3),(125,18,0.35),mats["road"],c)
    for i,x in enumerate(range(-50,51,20)):
        add_box(f"NQ_OverSign_{i}",(x,-115,9+(i%2)*3),(12,1.0,3.0),[mats["cyan"],mats["magenta"],mats["violet"]][i%3],c,0.2)
    tech_positions=[(-35,-118,0),(0,-118,0),(35,-118,0),(-75,-95,0),(75,-95,0),(0,-78,0)]
    for i,pos in enumerate(tech_positions):
        fname=NEON_FILES[i%len(NEON_FILES)]
        roots=neon_templates.get(fname,[])
        if roots:
            duplicate_hierarchy(roots[0],c,f"NQ_Tech_{i}",pos,1.6,(i%4)*math.pi/2)
    for x in (-120,-60,0,60,120):
        street_lamp(f"NQLamp_{x}",x,-42,mats,c)
        street_lamp(f"NQLamp2_{x}",x,20,mats,c)
    for i,x in enumerate((-90,-30,30,90)):
        add_box(f"NQ_FramePoleL_{i}",(x-6,-45,5),(0.6,0.6,10),mats["metal"],c)
        add_box(f"NQ_FramePoleR_{i}",(x+6,-45,5),(0.6,0.6,10),mats["metal"],c)
        add_box(f"NQ_FrameTop_{i}",(x,-45,9.5),(13,0.6,0.7),[mats["cyan"],mats["magenta"]][i%2],c,0.12)

def build_secondary_districts(cols,mats):
    configs={
        "old-market":((-520,-455,-390,-325,-260),(90,160,235,305),22),
        "tech-port":((260,340,420,500),(95,185,275),36),
        "canal-town":((-510,-430,-350,-270),(-300,-260,-205,-145,-80),18),
        "riverside":((-150,-95,95,150),(-340,-270,-130),26),
        "industrial-docks":((260,340,420,500),(-330,-245,-155,-70),16),
        "beach-marina":((-360,-250,-140,-30,80,190),(-470,),24),
        "hills-vip":((-260,-130,0,130,260),(455,535,615),14),
    }
    count=0
    for d,(xs,ys,baseh) in configs.items():
        c=cols[d]
        for yi,y in enumerate(ys):
            for xi,x in enumerate(xs):
                if d=="riverside" and abs(x)<70: continue
                if d=="canal-town" and any(abs(y-cz)<18 for cz in (-225,-165,-105)): continue
                h=baseh+(xi+yi)%4*4
                make_midrise(f"{d}_Context_{count}",(x,y,0),34,30,h,mats,c,None)
                count+=1
    c=cols["industrial-docks"]
    for i in range(28):
        x=260+(i%7)*34; y=-360+(i//7)*26
        add_box(f"Cargo_{i}",(x,y,1.6),(28,11,3.2),[mats["metal"],mats["red"],mats["concrete"]][i%3],c,0.15)
    c=cols["beach-marina"]
    for x in (245,295,345,395): add_box(f"Pier_{x}",(x,-540,0.35),(8,95,0.6),mats["sidewalk"],c)
    c=cols["hills-vip"]
    for i in range(20):
        x=-300+(i%5)*140; y=470+(i//5)*60
        add_cylinder(f"TreeTrunk_{i}",(x,y,2.5),0.45,5,mats["metal"],c,12)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=2.8,location=(x,y,6))
        crown=bpy.context.object; crown.name=f"TreeCrown_{i}"; crown.data.materials.append(mats["green"]); move_to_collection(crown,c)

def add_world_lighting():
    world=bpy.context.scene.world; world.use_nodes=True
    bg=world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value=(0.025,0.04,0.075,1.0); bg.inputs["Strength"].default_value=0.30
    bpy.ops.object.light_add(type='SUN', location=(220,-160,300))
    sun=bpy.context.object; sun.name="Sun_Warm"; sun.rotation_euler=(math.radians(32),0,math.radians(138)); sun.data.energy=2.2; sun.data.color=(1.0,0.68,0.45)
    bpy.ops.object.light_add(type='AREA', location=(0,0,260))
    fill=bpy.context.object; fill.name="SkyFill_Blue"; fill.data.energy=900; fill.data.shape='DISK'; fill.data.size=650; fill.data.color=(0.22,0.34,0.9)
    for i,(x,y,z,color) in enumerate([
        (-90,-105,16,(1.0,0.02,0.35)),(0,-105,18,(0.0,0.7,1.0)),(90,-105,16,(0.45,0.08,1.0)),(-60,-20,14,(0.0,0.65,1.0)),(60,-20,14,(1.0,0.02,0.42)),
    ]):
        bpy.ops.object.light_add(type='AREA',location=(x,y,z))
        l=bpy.context.object; l.name=f"NeonArea_{i}"; l.data.energy=450; l.data.shape='RECTANGLE'; l.data.size=12; l.data.color=color; l.rotation_euler=(math.radians(90),0,0)

def collect_objects_recursive(collection):
    out=list(collection.objects)
    for ch in collection.children: out.extend(collect_objects_recursive(ch))
    return out

def export_collection(collection,filepath):
    bpy.ops.object.select_all(action='DESELECT')
    objs=[o for o in collect_objects_recursive(collection) if not o.hide_render]
    for o in objs: o.select_set(True)
    if not objs: return 0
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.export_scene.gltf(filepath=str(filepath),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_materials='EXPORT')
    return len(objs)

def main():
    reset_scene()
    mats=setup_materials()
    source=ensure_collection("SOURCE_ASSETS"); source.hide_render=True; source.hide_viewport=True
    cols={k:ensure_collection(f"DISTRICT_{k}") for k in DISTRICTS}
    neon_templates={}
    for fname in NEON_FILES:
        p=NEON_KIT/fname
        neon_templates[fname]=import_template(p,source) if p.exists() else []
    build_map_base(cols,mats)
    build_premium_downtown(cols,mats)
    build_premium_neon(cols,mats,neon_templates)
    build_secondary_districts(cols,mats)
    add_world_lighting()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    manifest={"generated":True,"generator":"blender/build_city.py","sourceBlend":"blender/MiragCity_TokyoBangkok.blend","qualityStage":"premium-downtown-neon-benchmark","districts":[]}
    for key,info in DISTRICTS.items():
        out=OUTPUT_DIR/f"{key}.glb"
        count=export_collection(cols[key],out)
        manifest["districts"].append({"id":key,"label":info["label"],"file":f"{key}.glb","objects":count})
    common=ensure_collection("COMMON_INFRASTRUCTURE")
    common_count=export_collection(common,OUTPUT_DIR/"common-infrastructure.glb")
    manifest["common"]={"file":"common-infrastructure.glb","objects":common_count}
    with open(OUTPUT_DIR/"manifest.json","w",encoding="utf-8") as f: json.dump(manifest,f,indent=2)
    print("[Mirag City] Premium Downtown + Neon benchmark built and exported")

if __name__=="__main__":
    main()
