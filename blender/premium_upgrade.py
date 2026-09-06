import bpy
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BLEND = REPO_ROOT / "blender" / "MiragCity_TokyoBangkok.blend"
OUT = REPO_ROOT / "public" / "assets" / "city-generated"

bpy.ops.wm.open_mainfile(filepath=str(BLEND))
scene = bpy.context.scene


def col(name):
    c=bpy.data.collections.get(name)
    if not c:
        c=bpy.data.collections.new(name); scene.collection.children.link(c)
    return c

DT=col("DISTRICT_central-downtown")
NQ=col("DISTRICT_neon-quarter")
COMMON=col("COMMON_INFRASTRUCTURE")


def mat(name,color,metallic=0,rough=.6,em=None,strength=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    if p:
        p.inputs["Base Color"].default_value=(*color,1); p.inputs["Metallic"].default_value=metallic; p.inputs["Roughness"].default_value=rough
        if em:
            if "Emission Color" in p.inputs:
                p.inputs["Emission Color"].default_value=(*em,1); p.inputs["Emission Strength"].default_value=strength
            elif "Emission" in p.inputs: p.inputs["Emission"].default_value=(*em,1)
    return m

M={
 "steel":mat("UP_Steel",(.07,.08,.10),.75,.32),
 "dark":mat("UP_Dark",(.05,.055,.065),.2,.55),
 "glass":mat("UP_Glass",(.02,.09,.13),.1,.16),
 "glass2":mat("UP_Glass2",(.025,.15,.19),.05,.18),
 "warm":mat("UP_Warm",(.12,.055,.018),0,.22,(1,.34,.08),2.2),
 "concrete":mat("UP_Concrete",(.22,.23,.25),0,.78),
 "sidewalk":mat("UP_Sidewalk",(.33,.34,.35),0,.84),
 "white":mat("UP_White",(.18,.18,.16),0,.24,(1,.92,.75),4),
 "cyan":mat("UP_Cyan",(.006,.045,.06),0,.22,(0,.86,1),8),
 "magenta":mat("UP_Magenta",(.08,.005,.045),0,.22,(1,.01,.44),7),
 "violet":mat("UP_Violet",(.04,.012,.09),0,.22,(.52,.06,1),7),
 "amber":mat("UP_Amber",(.09,.035,.004),0,.24,(1,.34,.03),5),
 "green":mat("UP_Green",(.025,.15,.06),0,.9),
}


def move(o,c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o)


def box(name,loc,dims,material,c,bevel=.0,rz=0):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=(0,0,rz)); o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new("SoftEdge","BEVEL"); b.width=bevel; b.segments=2
    move(o,c); return o


def cyl(name,loc,r,depth,material,c):
    bpy.ops.mesh.primitive_cylinder_add(vertices=14,radius=r,depth=depth,location=loc); o=bpy.context.object; o.name=name; o.data.materials.append(material); move(o,c); return o


def text(name,body,loc,size,material,c,rz=0):
    cu=bpy.data.curves.new(name+"_Curve","FONT"); cu.body=body; cu.align_x="CENTER"; cu.align_y="CENTER"; cu.size=size; cu.extrude=.05
    o=bpy.data.objects.new(name,cu); c.objects.link(o); o.location=loc; o.rotation_euler=(math.radians(90),0,rz); o.data.materials.append(material); return o


def windows(prefix,x,y,w,d,h,c,side=True):
    floors=max(5,int(h/5)); cols=max(4,int(w/6)); dz=(h-8)/max(floors-1,1)
    for f in range(floors):
        z=5+f*dz
        for i in range(cols):
            xx=x-w*.38+i*(w*.76/max(cols-1,1)); mm=M["warm"] if (f*cols+i)%7==0 else M["glass2"]
            box(f"{prefix}_F_{f}_{i}",(xx,y-d/2-.12,z),(max(1.6,w*.095),.18,max(1.6,dz*.42)),mm,c,.04)
        if side:
            for i in range(max(2,cols//2)):
                yy=y-d*.30+i*(d*.60/max(max(2,cols//2)-1,1)); mm=M["warm"] if (f+i)%8==0 else M["glass"]
                box(f"{prefix}_S_{f}_{i}",(x+w/2+.12,yy,z),(.18,max(1.5,d*.12),max(1.6,dz*.42)),mm,c,.04)


def podium(prefix,x,y,w,d,c,accent=None):
    box(prefix+"_Podium",(x,y,3),(w*1.05,d*1.08,6),M["concrete"],c,.55)
    box(prefix+"_Storefront",(x,y-d*.55,3),(w*.78,.45,4.7),M["glass"],c,.1)
    if accent: box(prefix+"_Awning",(x,y-d*.59,6.2),(w*.84,1.4,.55),accent,c,.12)


def roof(prefix,x,y,z,w,d,c):
    box(prefix+"_Roof",(x,y,z),(w*.72,d*.72,.9),M["steel"],c,.25)
    for i,(dx,dy) in enumerate([(-.18,-.12),(.15,-.12),(-.1,.15),(.16,.13)]): box(f"{prefix}_HVAC_{i}",(x+w*dx,y+d*dy,z+1.8),(max(3,w*.13),max(2.4,d*.12),2.6),M["dark"],c,.3)
    cyl(prefix+"_Antenna",(x,y,z+6),.13,10,M["steel"],c)


def decorate_existing(prefix_filter,c,accent_cycle):
    targets=[]
    for o in list(c.objects):
        if o.type!="MESH" or prefix_filter not in o.name: continue
        if o.dimensions.z<18 or o.dimensions.x<18 or o.dimensions.y<15: continue
        targets.append(o)
    targets=targets[:26]
    for n,o in enumerate(targets):
        x,y,z=o.location; w=max(18,o.dimensions.x); d=max(15,o.dimensions.y); h=max(18,o.dimensions.z)
        windows("UP_"+o.name,x,y,w,d,h,c,n%3!=0)
        podium("UP_"+o.name,x,y,w,d,c,accent_cycle[n%len(accent_cycle)])
        roof("UP_"+o.name,x,y,z+h/2+1,w,d,c)


def street_lamp(prefix,x,y,c,rz=0):
    cyl(prefix+"_Pole",(x,y,3.7),.13,7.4,M["steel"],c)
    box(prefix+"_Arm",(x,y,7.3),(2.8,.22,.22),M["steel"],c,.06,rz)
    box(prefix+"_Glow",(x+math.cos(rz)*1.2,y+math.sin(rz)*1.2,7.15),(1.0,.45,.22),M["white"],c,.08,rz)


def tree(prefix,x,y,c):
    cyl(prefix+"_Trunk",(x,y,1.9),.3,3.8,M["steel"],c)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=2.0,location=(x,y,4.9)); o=bpy.context.object; o.name=prefix+"_Crown"; o.data.materials.append(M["green"]); move(o,c)

# Facade/detail pass over the actual benchmark buildings
decorate_existing("DT_",DT,[M["amber"],M["white"],M["cyan"]])
decorate_existing("NQ_",NQ,[M["cyan"],M["magenta"],M["violet"]])

# Downtown street-level density: bus shelters, kiosks, planters, median, signage
for i,x in enumerate(range(-190,191,38)):
    street_lamp(f"UP_DTLampA_{i}",x,143,DT,0); street_lamp(f"UP_DTLampB_{i}",x,188,DT,math.pi)
for i,x in enumerate((-165,-90,90,165)):
    box(f"UP_DTKiosk_{i}",(x,74,2.2),(11,6,4.4),M["dark"],DT,.4); box(f"UP_DTKioskGlass_{i}",(x,70.8,2.5),(8,.3,3),M["glass"],DT,.08)
for i,x in enumerate((-145,-75,0,75,145)):
    box(f"UP_DTPlanter_{i}",(x,112,.7),(7,7,1.4),M["concrete"],DT,.25); tree(f"UP_DTTree_{i}",x,112,DT)
for i,x in enumerate((-115,115)):
    box(f"UP_DTBus_{i}",(x,134,2.7),(19,3,5.4),M["glass"],DT,.25); box(f"UP_DTBusRoof_{i}",(x,134,5.6),(20,4,.45),M["steel"],DT,.15)

# Stronger skyline silhouettes: crowns, fins, spires and rooftop billboards
for i,(x,y,h) in enumerate([(-82,218,124),(82,225,111),(-78,310,99),(78,320,93),(-182,245,83),(182,235,79)]):
    box(f"UP_DTCrown_{i}",(x,y,h),(22-i%3*3,18-i%2*2,5),M["steel"],DT,.45)
    cyl(f"UP_DTSpire_{i}",(x,y,h+10),.18,18,M["white" if i<2 else "steel"],DT)
for i,(x,y,z) in enumerate([(-118,115,42),(118,115,42),(-20,205,48),(185,205,54),(-20,290,48)]):
    box(f"UP_DTBill_{i}",(x,y-16,z),(18,.5,8),[M["cyan"],M["amber"],M["magenta"]][i%3],DT,.14)

# Neon Quarter: layered signs, shop names, vending, AC, cables, alley clutter
names=["RAMEN","ARCADE","KTV","NOVA","24H","SUSHI","CLUB","CYBER"]
for i,(x,y) in enumerate([(-142,-78),(-90,-78),(-35,-78),(35,-78),(90,-78),(142,-78),(-142,-8),(-90,-8),(90,-8),(142,-8)]):
    mm=[M["cyan"],M["magenta"],M["violet"]][i%3]
    box(f"UP_NQBlade_{i}",(x+18,y-16,18+i%4*3),(1.4,.5,12+i%3*3),mm,NQ,.12)
    text(f"UP_NQText_{i}",names[i%len(names)],(x+19,y-16.4,18+i%4*3),1.25,mm,NQ,math.radians(90))
for i,x in enumerate(range(-150,151,30)):
    street_lamp(f"UP_NQLamp_{i}",x,-54,NQ,0)
    if i%2==0:
        box(f"UP_NQVend_{i}",(x,34,1.7),(2.2,1.4,3.4),M["steel"],NQ,.22); box(f"UP_NQVendGlow_{i}",(x,33.2,1.9),(1.5,.18,2.5),[M["cyan"],M["magenta"],M["violet"]][i%3],NQ,.05)
for i,x in enumerate(range(-55,56,10)):
    box(f"UP_NQAC_{i}",(x,-111,3.0),(4,2.3,2.3),M["dark"],NQ,.28)
for i,x in enumerate((-120,-60,0,60,120)):
    box(f"UP_NQArchL_{i}",(x-8,-42,5),(.55,.55,10),M["steel"],NQ)
    box(f"UP_NQArchR_{i}",(x+8,-42,5),(.55,.55,10),M["steel"],NQ)
    box(f"UP_NQArchT_{i}",(x,-42,9.5),(17,.55,.65),[M["cyan"],M["magenta"],M["violet"]][i%3],NQ,.1)
for i,x in enumerate(range(-60,61,20)):
    box(f"UP_NQOver_{i}",(x,-122,8+i%2*3),(13,.7,3),[M["cyan"],M["magenta"],M["violet"]][i%3],NQ,.14)

# localized neon light pools for actual Eevee review
for i,(x,y,z,color) in enumerate([(-120,-120,12,(1,.01,.3)),(-45,-120,12,(0,.75,1)),(35,-120,12,(.5,.05,1)),(115,-120,12,(0,.75,1)),(-80,-30,11,(1,.01,.4)),(0,-30,11,(0,.7,1)),(80,-30,11,(.45,.05,1))]):
    bpy.ops.object.light_add(type='AREA',location=(x,y,z)); l=bpy.context.object; l.name=f"UP_NeonArea_{i}"; l.data.energy=260; l.data.shape='RECTANGLE'; l.data.size=8; l.data.color=color; l.rotation_euler=(math.radians(90),0,0)

# Re-export upgraded benchmark districts
def export_collection(c,path):
    bpy.ops.object.select_all(action='DESELECT'); objs=list(c.objects)
    for o in objs:
        if not o.hide_render: o.select_set(True)
    objs=[o for o in objs if not o.hide_render]
    if not objs: return
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_materials='EXPORT')

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
export_collection(DT,OUT/"central-downtown.glb")
export_collection(NQ,OUT/"neon-quarter.glb")
print("[Mirag City] Premium upgrade pass applied to Downtown + Neon Quarter")
