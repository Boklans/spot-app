"""
Catalogs all real 3D muscle & skeletal meshes in Z-Anatomy, verifies exact
coordinate bounds (meters), and prints all Pectoralis, Deltoid, and Triceps
Brachii heads + landmark bone positions for exact skeletal rig placement.
"""
import bpy
from mathutils import Vector

BLEND_PATH = r"D:\work\VanzaLabs\spot-app\spot-app\.anatomy-assets\z-anatomy\Z-Anatomy\Startup.blend"

with bpy.data.libraries.load(BLEND_PATH, link=False) as (df, dt):
    top_cols = [
        c for c in df.collections
        if any(k in c.lower() for k in ("muscular", "skeletal", "skin", "fascia", "ligament", "joint", "female", "male", "integument", "cardio"))
    ]
    print("KEY COLLECTIONS:", sorted(top_cols)[:45])
    dt.collections = [c for c in df.collections if c in ("Muscular system", "Skeletal system", "Joints")]

for col in bpy.data.collections:
    if col.name in ("Muscular system", "Skeletal system", "Joints"):
        bpy.context.scene.collection.children.link(col)

bpy.context.view_layer.update()

IGNORE_SUFFIXES = (
    ".j", ".g", ".i", ".t", ".s",
    ".or", ".ol", ".er", ".el",
    ".e1l", ".e1r", ".e2l", ".e2r", ".e3l", ".e3r",
    ".o1l", ".o1r", ".o2l", ".o2r", ".o3l", ".o3r",
)

def is_real_mesh(obj):
    if obj.type != 'MESH' or len(obj.data.vertices) < 20:
        return False
    low = obj.name.lower()
    if any(low.endswith(s) for s in IGNORE_SUFFIXES):
        return False
    if "bursa" in low or "sheath" in low or "line" in low:
        return False
    return True

def collect_meshes(col, out):
    for o in col.objects:
        if is_real_mesh(o):
            out.append(o)
    for ch in col.children:
        collect_meshes(ch, out)

musc_real, skel_real = [], []
if "Muscular system" in bpy.data.collections:
    collect_meshes(bpy.data.collections["Muscular system"], musc_real)
if "Skeletal system" in bpy.data.collections:
    collect_meshes(bpy.data.collections["Skeletal system"], skel_real)

musc_real = list({o.name: o for o in musc_real}.values())
skel_real = list({o.name: o for o in skel_real}.values())
print(f"\nMUSCULAR SYSTEM real meshes: {len(musc_real)}")
print(f"SKELETAL SYSTEM real meshes: {len(skel_real)}")

print("\n--- BENCH PRESS TARGET MUSCLES (Pectoralis / Deltoid / Triceps Brachii) ---")
for o in sorted(musc_real, key=lambda x: x.name):
    low = o.name.lower()
    if any(k in low for k in ("pectoralis", "deltoid", "triceps brachii")):
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        cx = sum(v.x for v in bb) / 8
        cy = sum(v.y for v in bb) / 8
        cz = sum(v.z for v in bb) / 8
        print(f"  {o.name:58s} verts={len(o.data.vertices):5d} center=({cx:+.3f}, {cy:+.3f}, {cz:+.3f})")

print("\n--- KEY SKELETAL LANDMARKS (for exact Joint/Bone placement) ---")
landmarks = [
    "Humerus.l", "Humerus.r", "Ulna.l", "Ulna.r", "Radius.l", "Radius.r",
    "Clavicle.l", "Clavicle.r", "Scapula.l", "Scapula.r",
    "Femur.l", "Femur.r", "Tibia.l", "Tibia.r",
    "Hip bone.l", "Hip bone.r", "Sacrum", "Manubrium of sternum", "Body of sternum",
    "Frontal bone", "Mandible", "Calcaneus.l", "Calcaneus.r",
    "Third metacarpal bone.l", "Third metacarpal bone.r",
]
for name in landmarks:
    o = bpy.data.objects.get(name)
    if o and o.type == 'MESH':
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
        print(f"  {name:26s} X=[{min(xs):+.3f},{max(xs):+.3f}] Y=[{min(ys):+.3f},{max(ys):+.3f}] Z=[{min(zs):+.3f},{max(zs):+.3f}]")

min_v = Vector((1e9, 1e9, 1e9))
max_v = Vector((-1e9, -1e9, -1e9))
for o in musc_real + skel_real:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        min_v.x = min(min_v.x, w.x); min_v.y = min(min_v.y, w.y); min_v.z = min(min_v.z, w.z)
        max_v.x = max(max_v.x, w.x); max_v.y = max(max_v.y, w.y); max_v.z = max(max_v.z, w.z)

print(f"\nFULL BODY BOUNDS: X=[{min_v.x:.3f}, {max_v.x:.3f}] Y=[{min_v.y:.3f}, {max_v.y:.3f}] Z=[{min_v.z:.3f}, {max_v.z:.3f}]")
print(f"FULL BODY SIZE:   W={max_v.x-min_v.x:.3f}m, D={max_v.y-min_v.y:.3f}m, H={max_v.z-min_v.z:.3f}m")
