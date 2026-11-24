"""
Headless Blender inspector for Z-Anatomy and Z-Biomechanics .blend files.
Uses bpy.data.libraries.load() to inspect data-blocks cleanly without loading
legacy Blender 3.x UI/drivers that could crash Blender 4.2 LTS.

Usage:
  blender --factory-startup --background --python tools/3d-anatomy/inspect_z_anatomy.py -- <path/to/Startup.blend>
"""
import sys
import bpy
from mathutils import Vector

argv = sys.argv
blend_path = argv[argv.index("--") + 1] if "--" in argv else None
if not blend_path:
    raise SystemExit("Pass -- <path/to/file.blend>")

print("=" * 72)
print("FILE:", blend_path)
print("BLENDER VERSION:", bpy.app.version_string)

with bpy.data.libraries.load(blend_path, link=False) as (data_from, data_to):
    print(f"AVAILABLE -> collections={len(data_from.collections)}, objects={len(data_from.objects)}, meshes={len(data_from.meshes)}, armatures={len(data_from.armatures)}, actions={len(data_from.actions)}")
    print("\n--- COLLECTIONS (first 60) ---")
    for c in data_from.collections[:60]:
        print("  [COL]", c)
    if len(data_from.collections) > 60:
        print(f"  ... +{len(data_from.collections) - 60} more collections")

    print("\n--- ARMATURES ---")
    for a in data_from.armatures:
        print("  [ARMATURE DATA]", a)

    print("\n--- ACTIONS ---")
    for act in data_from.actions[:30]:
        print("  [ACTION]", act)

    keywords = [
        "pectoral", "deltoid", "triceps", "biceps", "brachialis", "brachioradialis",
        "latissimus", "trapezius", "rectus abdominis", "external oblique", "serratus",
        "gluteus", "rectus femoris", "vastus", "gastrocnemius",
        "humerus", "radius", "ulna", "clavicle", "sternum", "scapula", "femur", "tibia",
        "female", "male", "breast", "mammary", "pelvis", "skin", "musc"
    ]
    matched = {kw: [] for kw in keywords}
    for name in data_from.objects:
        low = name.lower()
        for kw in keywords:
            if kw in low:
                matched[kw].append(name)

    print("\n--- OBJECT MATCHES ---")
    for kw, names in matched.items():
        if names:
            sample = ", ".join(names[:6])
            more = f" (+{len(names)-6} more)" if len(names) > 6 else ""
            print(f"  [{kw:18s}] count={len(names):3d} -> {sample}{more}")

    # Load armatures + key bench press muscle objects to inspect exact bounds & modifiers
    arm_objs = [n for n in data_from.objects if "armature" in n.lower() or "rig" in n.lower() or "skeleton" in n.lower()]
    key_objs = [n for n in data_from.objects if any(k in n.lower() for k in ["pectoralis major", "deltoid", "triceps brachii", "humerus", "femur", "tibia", "cranium"])]
    data_to.objects = list(dict.fromkeys(arm_objs + key_objs[:30]))

print("\n--- LOADED ARMATURE & KEY OBJECTS DETAIL ---")
for o in bpy.data.objects:
    if o.type == 'ARMATURE':
        bones = list(o.data.bones)
        print(f"  ARMATURE '{o.name}': {len(bones)} bones, loc={tuple(round(v,3) for v in o.location)}, scale={tuple(round(v,3) for v in o.scale)}")
        for b in bones[:35]:
            print(f"      bone: {b.name} (parent={b.parent.name if b.parent else None}) head={tuple(round(v,3) for v in b.head_local)} tail={tuple(round(v,3) for v in b.tail_local)}")
        if len(bones) > 35:
            print(f"      ... +{len(bones)-35} more bones")

for o in bpy.data.objects:
    if o.type == 'MESH':
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
        mods = [(m.type, m.name) for m in o.modifiers]
        vgs = [vg.name for vg in o.vertex_groups[:6]]
        print(f"  MESH '{o.name}': verts={len(o.data.vertices)}, X=[{min(xs):.2f},{max(xs):.2f}] Y=[{min(ys):.2f},{max(ys):.2f}] Z=[{min(zs):.2f},{max(zs):.2f}] mods={mods} vgs={vgs}")
