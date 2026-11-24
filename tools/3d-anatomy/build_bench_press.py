"""
SPOT — Realistic 3D Human Muscular Anatomy Pipeline (Project 001: Barbell Bench Press)
Art Direction: SPOT Graphite Athletic Anatomy (v6)

Headless Blender 4.2 LTS production pipeline combining real Z-Anatomy (BodyParts3D)
superficial muscular geometry with sculpted athletic finishing (head, closed-grip
fists, compression shorts, lifting shoes, athletic muscle volume fill, and elevated
heroic 3/4 studio camera) so the result looks like a premium fitness anatomical atlas
with ZERO skeletal/cadaver artifacts.

  - Primary Active Muscle:    Pectoralis major (all 3 heads, L+R) -> Electric SPOT Lime (#C8FF3D)
  - Secondary Active Muscles: Anterior deltoid + Triceps brachii (L+R) -> Soft Emerald Green
  - Neutral Musculature:      Matte SPOT Graphite sculptural clay with deep AO muscle grooves
  - Models:                   Distinct Male (1.77m) & Female (1.64m) anatomical proportions
"""
import argparse
import math
import os
import sys
import time
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

_T0 = time.time()
def log_step(msg):
    print(f"[SPOT {time.time() - _T0:5.1f}s] {msg}", flush=True)


def parse_args():
    argv = sys.argv
    args_list = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--sex", choices=["male", "female"], default="male")
    parser.add_argument("--mode", choices=["preview", "mp4"], default="preview")
    parser.add_argument(
        "--blend",
        default=r"D:\work\VanzaLabs\spot-app\spot-app\.anatomy-assets\z-anatomy\Z-Anatomy\Startup.blend",
    )
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--width", type=int, default=864)
    parser.add_argument("--height", type=int, default=576)
    parser.add_argument("--samples", type=int, default=16)
    return parser.parse_args(args_list)


# ---------------------------------------------------------------------------
# Muscle & Mesh Filtering (Keep Superficial Muscles, Hide Cadaver/Skeleton Parts)
# ---------------------------------------------------------------------------
PRIMARY_PATTERNS = ("pectoralis major",)
SECONDARY_PATTERNS = ("clavicular part of deltoid", "triceps brachii")

IGNORE_SUFFIXES = (
    ".j", ".g", ".i", ".t", ".s",
    ".or", ".ol", ".er", ".el",
    ".e1l", ".e1r", ".e2l", ".e2r", ".e3l", ".e3r",
    ".o1l", ".o1r", ".o2l", ".o2r", ".o3l", ".o3r",
)

EXCLUDE_KEYWORDS = (
    "fascia", "bursa", "sheath", "retinaculum", "septum", "line",
    "cross section", "cube", "camera", "light", "aponeurosis of",
    "ligament", "capsule", "membrane", "disc", "meniscus",
    "synovial", "fat pad", "labrum", "cartilage",
    "eyeball", "eyelid", "ear", "tooth", "teeth", "gingiva",
    "palate", "tongue", "pharynx", "larynx", "diaphragm",
    "pelvic floor", "perine", "sphincter", "cremaster",
    "pectoralis minor", "subscapularis", "intercostal", "transversus thoracis",
    "sesamoid", "hyoid", "ossicle",
    # Exclude bare skeleton hands/feet/facial muscles — replaced by clean sculpted athletic forms!
    "carpal", "metacarpal", "phalan", "pisiform", "scaphoid", "lunate", "triquetr",
    "trapezi", "capitate", "hamate", "lumbrical", "interosse", "thenar", "hypothenar",
    "opponens", "abductor pollicis", "adductor pollicis", "flexor pollicis brevis",
    "abductor digiti", "flexor digiti", "palmaris brevis",
    "tarsal", "metatarsal", "calcaneus", "talus", "navicular", "cuboid", "cuneiform",
    "plantar", "dorsal inteross", "abductor hallucis", "flexor hallucis brevis",
    "quadratus plantae", "extensor digitorum brevis", "extensor hallucis brevis",
    # Exclude tiny skull/face muscles so sculpted matte athletic head stays sleek & clean
    "orbicularis", "zygomaticus", "buccinator", "risorius", "mentalis", "nasalis",
    "procerus", "corrugator", "depressor", "levator labii", "levator anguli",
    "frontalis", "occipitalis", "temporalis", "masseter", "pterygoid", "auricular",
    "epicranius", "galea", "platysma", "mylohyoid", "digastric", "stylohyoid",
    "geniohyoid", "omohyoid", "sternohyoid", "thyrohyoid", "sternothyroid",
    "skull", "cranium", "frontal bone", "parietal", "temporal bone", "occipital bone",
    "sphenoid", "ethmoid", "maxilla", "mandible", "nasal bone", "lacrimal", "vomer",
    "palatine", "zygomatic bone", "concha", "atlas", "axis", "cervical",
)


def is_valid_muscle_mesh(obj):
    if obj.type != "MESH" or not obj.data or len(obj.data.vertices) < 25:
        return False
    low = obj.name.lower()
    if any(low.endswith(s) for s in IGNORE_SUFFIXES):
        return False
    if any(k in low for k in EXCLUDE_KEYWORDS):
        return False
    return True


def classify_muscle_role(obj_name):
    low = obj_name.lower()
    if any(p in low for p in PRIMARY_PATTERNS):
        return "primary"
    if any(p in low for p in SECONDARY_PATTERNS):
        return "secondary"
    if "tendon" in low or "aponeurosis" in low or "tract" in low:
        return "tendon"
    return "neutral_muscle"


# ---------------------------------------------------------------------------
# SPOT Graphite Athletic Anatomy PBR Shader Library
# ---------------------------------------------------------------------------
def build_anatomical_material(
    name,
    base_rgba,
    crevice_rgba,
    roughness,
    emission_rgba=None,
    emission_strength=0.0,
    bump_strength=0.22,
    subsurface=0.10,
    coat_weight=0.18,
    metallic=0.0,
):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (620, 0)

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (260, 0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.48
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
    if "Subsurface Scale" in bsdf.inputs:
        bsdf.inputs["Subsurface Scale"].default_value = 0.010
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat_weight
        bsdf.inputs["Coat Roughness"].default_value = 0.28

    if emission_rgba and emission_strength > 0.0:
        bsdf.inputs["Emission Color"].default_value = emission_rgba
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    # Ambient Occlusion carves razor-crisp dark grooves between adjacent individual muscles
    ao = nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 0.065
    ao.location = (-360, 220)

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-140, 220)
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[1].position = 0.85

    mix_col = nodes.new("ShaderNodeMix")
    mix_col.data_type = "RGBA"
    mix_col.location = (40, 180)
    mix_col.inputs["A"].default_value = crevice_rgba
    mix_col.inputs["B"].default_value = base_rgba

    links.new(ao.outputs["AO"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], mix_col.inputs["Factor"])
    links.new(mix_col.outputs["Result"], bsdf.inputs["Base Color"])

    if bump_strength > 0.0:
        tex_coord = nodes.new("ShaderNodeTexCoord")
        tex_coord.location = (-640, -180)

        mapping = nodes.new("ShaderNodeMapping")
        mapping.location = (-440, -180)
        mapping.inputs["Scale"].default_value = (16.0, 16.0, 90.0)

        noise = nodes.new("ShaderNodeTexNoise")
        noise.location = (-220, -180)
        noise.inputs["Scale"].default_value = 7.0
        noise.inputs["Detail"].default_value = 6.0
        noise.inputs["Roughness"].default_value = 0.62

        bump = nodes.new("ShaderNodeBump")
        bump.location = (20, -180)
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.0022

        links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def create_spot_materials():
    return {
        # Primary Active Muscle: Pectoralis Major -> Vivid Electric SPOT Lime (#C8FF3D)
        "primary": build_anatomical_material(
            "SPOT_Primary_Muscle",
            base_rgba=(0.50, 1.00, 0.02, 1.0),
            crevice_rgba=(0.05, 0.18, 0.005, 1.0),
            roughness=0.34,
            emission_rgba=(0.52, 1.00, 0.04, 1.0),
            emission_strength=1.05,
            bump_strength=0.28,
            subsurface=0.18,
            coat_weight=0.24,
        ),
        # Secondary Active Muscles: Anterior Deltoid & Triceps Brachii -> Refined Soft Emerald-Green
        "secondary": build_anatomical_material(
            "SPOT_Secondary_Muscle",
            base_rgba=(0.07, 0.50, 0.22, 1.0),
            crevice_rgba=(0.012, 0.10, 0.04, 1.0),
            roughness=0.40,
            emission_rgba=(0.08, 0.52, 0.22, 1.0),
            emission_strength=0.42,
            bump_strength=0.26,
            subsurface=0.14,
            coat_weight=0.20,
        ),
        # Neutral Superficial Muscles: Sleek Matte SPOT Graphite Athletic Sculpture
        "neutral_muscle": build_anatomical_material(
            "SPOT_Graphite_Muscle",
            base_rgba=(0.095, 0.110, 0.135, 1.0),
            crevice_rgba=(0.012, 0.015, 0.022, 1.0),
            roughness=0.42,
            bump_strength=0.28,
            subsurface=0.06,
            coat_weight=0.18,
        ),
        # Tendons / Aponeuroses: Slightly lighter brushed graphite-silver
        "tendon": build_anatomical_material(
            "SPOT_Graphite_Tendon",
            base_rgba=(0.145, 0.160, 0.185, 1.0),
            crevice_rgba=(0.028, 0.032, 0.040, 1.0),
            roughness=0.38,
            bump_strength=0.08,
            subsurface=0.04,
            coat_weight=0.14,
        ),
        # Smooth Matte Athletic Sculpture (Head, Neck Base, Inner Core Fill, Closed Fists)
        "sculpture_matte": build_anatomical_material(
            "SPOT_Athletic_Sculpture",
            base_rgba=(0.075, 0.088, 0.108, 1.0),
            crevice_rgba=(0.012, 0.015, 0.020, 1.0),
            roughness=0.44,
            bump_strength=0.02,
            subsurface=0.04,
            coat_weight=0.16,
        ),
        # Athletic Compression Shorts (Deep matte carbon fabric)
        "shorts": build_anatomical_material(
            "SPOT_Compression_Shorts",
            base_rgba=(0.020, 0.024, 0.032, 1.0),
            crevice_rgba=(0.005, 0.006, 0.009, 1.0),
            roughness=0.62,
            bump_strength=0.04,
            subsurface=0.0,
            coat_weight=0.04,
        ),
        # Athletic Training Shoe Upper
        "shoe_upper": build_anatomical_material(
            "SPOT_Shoe_Upper",
            base_rgba=(0.028, 0.033, 0.042, 1.0),
            crevice_rgba=(0.008, 0.010, 0.014, 1.0),
            roughness=0.52,
            bump_strength=0.05,
            subsurface=0.0,
            coat_weight=0.08,
        ),
        # Shoe Sole Accent (SPOT Lime)
        "lime_accent": make_simple_pbr(
            "SPOT_Lime_Accent",
            (0.55, 0.98, 0.04, 1.0),
            roughness=0.35,
            emission=(0.55, 0.98, 0.04, 1.0),
            emission_strength=0.65,
        ),
    }


def make_simple_pbr(name, color, roughness=0.45, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission and emission_strength > 0:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


# ---------------------------------------------------------------------------
# Anatomical Sex Dimorphism + Athletic Muscle Hypertrophy Fullness
# ---------------------------------------------------------------------------
def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def apply_athletic_dimorphism_and_volume(objects, sex):
    """
    Transforms the lean medical Z-Anatomy base into an athletic Male (1.77m)
    or athletic Female (1.64m) build with cohesive, full muscle bellies.
    Snapshots vertex normals upfront via foreach_get so Blender 4.2 never
    triggers O(N^2) per-vertex normal recomputation!
    """
    import numpy as np

    normal_inflate = 0.0046 if sex == "male" else 0.0030

    for obj in objects:
        mesh = obj.data
        n_verts = len(mesh.vertices)
        if n_verts == 0:
            continue
        low = obj.name.lower()
        is_target_boost = any(
            k in low
            for k in ("pectoralis major", "deltoid", "triceps", "biceps", "quadriceps", "rectus femoris", "vastus", "gluteus")
        )
        inflate = normal_inflate * (1.35 if is_target_boost else 1.0)

        mesh.update()
        coords = np.empty(n_verts * 3, dtype=np.float32)
        normals = np.empty(n_verts * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", coords)
        mesh.vertices.foreach_get("normal", normals)
        pts = coords.reshape((n_verts, 3)) + normals.reshape((n_verts, 3)) * inflate

        x = pts[:, 0]
        y = pts[:, 1]
        z = pts[:, 2]

        def np_ss(e0, e1, arr):
            t = np.clip((arr - e0) / (e1 - e0), 0.0, 1.0)
            return t * t * (3.0 - 2.0 * t)

        if sex == "female":
            w_shoulder = np_ss(1.08, 1.36, z) * (1.0 - np_ss(1.44, 1.56, z))
            w_waist = np_ss(0.94, 1.07, z) * (1.0 - np_ss(1.12, 1.28, z))
            w_pelvis = np_ss(0.62, 0.86, z) * (1.0 - np_ss(0.96, 1.12, z))
            w_head = np_ss(1.45, 1.56, z)

            sx = 1.0 - 0.10 * w_shoulder - 0.09 * w_waist + 0.12 * w_pelvis - 0.04 * w_head
            sy = 1.0 - 0.05 * w_shoulder - 0.06 * w_waist + 0.09 * w_pelvis - 0.03 * w_head

            arm_mask = (np.abs(x) > 0.21) & (z < 1.25)
            x = np.where(arm_mask, x - 0.020 * np.sign(x), x * sx)
            y = np.where((y > 0.0) & (w_pelvis > 0.01), y * (1.0 + 0.13 * w_pelvis), y * sy)
            z = z * 0.965
        else:
            w_shoulder = np_ss(1.12, 1.36, z) * (1.0 - np_ss(1.45, 1.56, z))
            w_chest = np_ss(1.14, 1.30, z) * (1.0 - np_ss(1.38, 1.48, z))
            w_pelvis = np_ss(0.70, 0.90, z) * (1.0 - np_ss(0.98, 1.12, z))

            sx = 1.0 + 0.09 * w_shoulder - 0.03 * w_pelvis
            sy = 1.0 + 0.09 * w_chest

            arm_mask = (np.abs(x) > 0.21) & (z < 1.25)
            x = np.where(arm_mask, x + 0.018 * np.sign(x), x * sx)
            y = y * sy
            z = z * 1.04

        out = np.stack((x, y, z), axis=1).astype(np.float32).ravel()
        mesh.vertices.foreach_set("co", out)
        mesh.update()


# ---------------------------------------------------------------------------
# Sculpted Athletic Finishing Parts (Head, Core Fill, Compression Shorts, Shoes)
# ---------------------------------------------------------------------------
def add_smooth_mesh_to_col(obj, col, mat, subdiv=0):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)
    if subdiv > 0:
        sub = obj.modifiers.new("Subsurf", "SUBSURF")
        sub.levels = 1
        sub.render_levels = 1
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def trim_distal_tendons_and_head_muscles(objects, J):
    """
    Cleanly clips:
      1. Any muscle mesh residing in the head (orbital/jaw/ear muscles z > head_z) so the
         sculpted matte athletic head stays 100% smooth and free of eye-socket artifacts.
      2. Distal forearm finger tendons extending past the wrist (z < wr_z) so nothing
         pokes out past the sculpted closed fists on the barbell.
      3. Distal shin toe tendons extending into the shoe (z < an_z) so the lifting shoes
         look razor-clean with zero poking tendon strands.
    """
    z_s = J["z_s"]
    wr_z = J["wr_L"].z + 0.018
    an_z = J["an_L"].z - 0.028
    sh_x = abs(J["sh_L"].x)
    head_cut_z = J["chest_top"].z + 0.075 * z_s

    kept = []
    for obj in objects:
        bb = [Vector(c) for c in obj.bound_box]
        cz = sum(v.z for v in bb) / 8.0
        cx = sum(v.x for v in bb) / 8.0

        # Drop all head/orbital/jaw muscles completely
        if cz > head_cut_z:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue

        # Trim distal finger tendons on arm muscles & distal toe tendons on lower-leg muscles
        low = obj.name.lower()
        is_arm_distal = abs(cx) > sh_x * 0.92 and cz < J["el_L"].z + 0.04 and cz > 0.55 * z_s
        is_leg_distal = cz < J["kn_L"].z + 0.05

        if is_arm_distal or is_leg_distal:
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            cutoff = wr_z if is_arm_distal else an_z
            to_del = [v for v in bm.verts if v.co.z < cutoff]
            if len(to_del) == len(bm.verts):
                bm.free()
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            if to_del:
                bmesh.ops.delete(bm, geom=to_del, context="VERTS")
                bm.to_mesh(obj.data)
                obj.data.update()
            bm.free()

        kept.append(obj)
    return kept


def build_sculpted_athletic_parts(col, mats, J, sex):
    """
    Creates clean, cohesive sculpted anatomical parts (in standing rest pose)
    so there are ZERO skeleton hands, ZERO bare skull, ZERO pelvic cavity, and
    ZERO bare toe bones:
      1. Sculpted matte athletic head + smooth neck column
      2. Inner matte thoracic/abdominal core fill (prevents dark gaps between deep muscles)
      3. Fitted matte athletic compression shorts (covers hollow pelvic/groin zone cleanly)
      4. Sleek low-profile training shoes with subtle SPOT lime sole stripe
    Returns list of (obj, binding_mode) to bind seamlessly to the armature.
    """
    z_s = J["z_s"]
    parts = []

    # 1. Sculpted Matte Athletic Head (cranium + tapered jaw + smooth neck — zero skull look!)
    head_z = (J["neck_top"].z + J["head_top"].z) * 0.505
    head_sx = 0.074 if sex == "female" else 0.080
    head_sy = 0.094 if sex == "female" else 0.100
    head_sz = 0.106 if sex == "female" else 0.114
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1.0, location=(0.0, -0.008, head_z))
    head = bpy.context.active_object
    head.name = "Athletic_Head"
    # Sculpt subtle tapered athletic jawline & chin anteriorly (-Y) and inferiorly (-Z)
    for v in head.data.vertices:
        x, y, z = v.co.x * head_sx, v.co.y * head_sy, v.co.z * head_sz
        if z < 0.0:
            taper = max(0.58, 1.0 + z / (head_sz * 1.45))
            x *= taper
            if y < 0.0:
                y *= (0.94 + 0.12 * (1.0 - abs(z) / head_sz))  # subtle chin contour
        v.co = Vector((x, y, z))
    head.data.transform(head.matrix_world)
    head.matrix_world = Matrix.Identity(4)
    add_smooth_mesh_to_col(head, col, mats["sculpture_matte"], subdiv=1)
    parts.append((head, "head"))

    # Smooth athletic neck column bridging head to clavicles/traps
    neck_mid = (J["chest_top"] + J["neck_top"]) * 0.5
    neck_r = 0.048 if sex == "female" else 0.056
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=neck_r, depth=0.14 * z_s, location=(0.0, 0.012, neck_mid.z))
    neck = bpy.context.active_object
    neck.name = "Athletic_Neck"
    neck.data.transform(neck.matrix_world)
    neck.matrix_world = Matrix.Identity(4)
    add_smooth_mesh_to_col(neck, col, mats["sculpture_matte"], subdiv=1)
    parts.append((neck, "neck"))

    # 2. Inner Matte Torso Core Fill (sits just inside superficial muscles so no hollow gaps ever show!)
    torso_mid_z = (J["pelvis"].z + J["chest_top"].z) * 0.50
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=1.0, location=(0.0, 0.015, torso_mid_z))
    core = bpy.context.active_object
    core.name = "Athletic_Torso_Core"
    cx = 0.122 if sex == "female" else 0.140
    cy = 0.072 if sex == "female" else 0.082
    cz = 0.235 * z_s
    for v in core.data.vertices:
        vx, vy, vz = v.co.x * cx, v.co.y * cy, v.co.z * cz
        if vz < 0.0:
            # Slight waist taper
            waist_f = 0.88 if sex == "female" else 0.94
            vx *= waist_f
        v.co = Vector((vx, vy, vz))
    core.data.transform(core.matrix_world)
    core.matrix_world = Matrix.Identity(4)
    add_smooth_mesh_to_col(core, col, mats["sculpture_matte"], subdiv=1)
    parts.append((core, "torso"))

    # 3. Fitted Athletic Compression Shorts (cleanly tailored OVER pelvis & upper 1/3 of thighs!)
    hip_z = J["hip_L"].z
    sh_w = 0.186 if sex == "female" else 0.176
    sh_d = 0.122 if sex == "female" else 0.116
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1.0, location=(0.0, 0.016, hip_z + 0.036 * z_s))
    pelvis_shorts = bpy.context.active_object
    pelvis_shorts.name = "Athletic_Shorts_Pelvis"
    for v in pelvis_shorts.data.vertices:
        vx, vy, vz = v.co.x * sh_w, v.co.y * sh_d, v.co.z * (0.124 * z_s)
        if vz > 0.090 * z_s:
            vz = 0.090 * z_s
        v.co = Vector((vx, vy, vz))
    pelvis_shorts.data.transform(pelvis_shorts.matrix_world)
    pelvis_shorts.matrix_world = Matrix.Identity(4)
    add_smooth_mesh_to_col(pelvis_shorts, col, mats["shorts"], subdiv=1)
    parts.append((pelvis_shorts, "shorts"))

    # Upper thigh compression sleeves (left + right) cleanly enveloping upper quad/hamstring roots
    for side in ("L", "R"):
        hip_p = J[f"hip_{side}"]
        kn_p = J[f"kn_{side}"]
        thigh_dir = (kn_p - hip_p).normalized()
        sleeve_len = (kn_p - hip_p).length * 0.42
        sleeve_center = hip_p + thigh_dir * (sleeve_len * 0.44)
        r_top = 0.108 if sex == "female" else 0.105
        r_bot = 0.092 if sex == "female" else 0.090

        bpy.ops.mesh.primitive_cone_add(
            vertices=28,
            radius1=r_bot,
            radius2=r_top,
            depth=sleeve_len,
            location=sleeve_center,
        )
        slv = bpy.context.active_object
        slv.name = f"Athletic_Shorts_Thigh_{side}"
        slv.data.transform(slv.matrix_world)
        slv.matrix_world = Matrix.Identity(4)
        add_smooth_mesh_to_col(slv, col, mats["shorts"], subdiv=1)
        parts.append((slv, f"shorts_thigh_{side}"))

    # 4. Sleek Low-Profile Athletic Training Shoes + Seamless Ankle Collar (Left + Right)
    for side in ("L", "R"):
        an_p = J[f"an_{side}"]
        ft_p = J[f"ft_{side}"]
        shoe_mid = Vector((an_p.x, (an_p.y + ft_p.y) * 0.5 - 0.012, 0.044 * z_s))

        # Seamless matte ankle sock/collar bridging shin calves directly into shoe opening (zero gap!)
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.040 if sex == "female" else 0.045,
            depth=0.115 * z_s,
            location=(an_p.x, an_p.y - 0.006, an_p.z + 0.025 * z_s),
        )
        sock = bpy.context.active_object
        sock.name = f"Athletic_Ankle_Collar_{side}"
        sock.data.transform(sock.matrix_world)
        sock.matrix_world = Matrix.Identity(4)
        add_smooth_mesh_to_col(sock, col, mats["shoe_upper"], subdiv=1)
        parts.append((sock, f"ankle_{side}"))

        # Sculpted shoe upper
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=shoe_mid)
        shoe = bpy.context.active_object
        shoe.name = f"Athletic_Shoe_{side}"
        shoe_w = 0.092 if sex == "female" else 0.102
        shoe_l = 0.245 if sex == "female" else 0.272
        shoe_h = 0.082 * z_s
        shoe.scale = (shoe_w, shoe_l, shoe_h)
        bpy.ops.object.transform_apply(scale=True)
        # Taper toe box & slope instep smoothly
        for v in shoe.data.vertices:
            if v.co.y < shoe_mid.y - 0.02:
                v.co.z = min(v.co.z, shoe_mid.z + 0.012)
                dx = v.co.x - shoe_mid.x
                v.co.x = shoe_mid.x + dx * 0.84
        shoe.data.transform(shoe.matrix_world)
        shoe.matrix_world = Matrix.Identity(4)
        add_smooth_mesh_to_col(shoe, col, mats["shoe_upper"], subdiv=2)
        parts.append((shoe, f"foot_{side}"))

        # Thin SPOT Lime athletic midsole stripe
        sole_mid = Vector((an_p.x, shoe_mid.y, 0.011 * z_s))
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=sole_mid)
        sole = bpy.context.active_object
        sole.name = f"Athletic_Shoe_Sole_{side}"
        sole.scale = (shoe_w * 1.03, shoe_l * 1.01, 0.015 * z_s)
        bpy.ops.object.transform_apply(scale=True)
        sole.data.transform(sole.matrix_world)
        sole.matrix_world = Matrix.Identity(4)
        add_smooth_mesh_to_col(sole, col, mats["lime_accent"], subdiv=1)
        parts.append((sole, f"foot_{side}"))

    return parts


def build_sculpted_closed_fists_on_bar(bar_root, col, mats, grip_half_x, sex):
    """
    Builds anatomically sculpted, solid closed-grip athletic hands/fists wrapped
    tightly around the 29mm barbell shaft at `X = +-grip_half_x`.
    Parented directly to `bar_root` so grip lock is 100% physically airtight!
    """
    hand_scale = 0.90 if sex == "female" else 1.0
    mat_hand = mats["sculpture_matte"]

    for sign, tag in ((-1.0, "L"), (1.0, "R")):
        gx = sign * grip_half_x

        # 1. Palm + wrapped fingers block hugging the barbell shaft tightly
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.031 * hand_scale,
            depth=0.088 * hand_scale,
            location=(gx, 0.002, 0.001),
            rotation=(0, math.pi / 2, 0),
        )
        fist = bpy.context.active_object
        fist.name = f"Sculpted_Fist_{tag}"
        # Slightly oval cross-section matching curled fingers + metacarpal back of hand
        fist.scale = (1.0, 1.08, 0.96)
        bpy.ops.object.transform_apply(scale=True)
        add_smooth_mesh_to_col(fist, col, mat_hand, subdiv=2)
        fist.parent = bar_root

        # 2. Wrapped opposing thumb closing securely over the top-front of the barbell (closed grip!)
        bpy.ops.mesh.primitive_capsule_add if hasattr(bpy.ops.mesh, "primitive_capsule_add") else None
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=20,
            ring_count=12,
            radius=1.0,
            location=(gx - sign * 0.036 * hand_scale, 0.020 * hand_scale, 0.015 * hand_scale),
            rotation=(0.25, 0.0, sign * 0.35),
        )
        thumb = bpy.context.active_object
        thumb.name = f"Sculpted_Thumb_{tag}"
        thumb.scale = (0.026 * hand_scale, 0.015 * hand_scale, 0.014 * hand_scale)
        bpy.ops.object.transform_apply(scale=True)
        add_smooth_mesh_to_col(thumb, col, mat_hand, subdiv=1)
        thumb.parent = bar_root

        # 3. Sleek wrist transition cuff connecting palm seamlessly into forearm wrist
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.026 * hand_scale,
            depth=0.056 * hand_scale,
            location=(gx, 0.0, -0.028 * hand_scale),
        )
        wrist = bpy.context.active_object
        wrist.name = f"Sculpted_Wrist_{tag}"
        wrist.scale = (1.06, 0.86, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        add_smooth_mesh_to_col(wrist, col, mat_hand, subdiv=1)
        wrist.parent = bar_root


# ---------------------------------------------------------------------------
# Skeleton Calibration & Continuous Anatomical Skinning
# ---------------------------------------------------------------------------
def get_skeleton_joints(sex):
    z_s = 0.965 if sex == "female" else 1.04
    sh_x = 0.155 if sex == "female" else 0.186
    el_x = 0.208 if sex == "female" else 0.246
    wr_x = 0.242 if sex == "female" else 0.280
    hip_x = 0.104 if sex == "female" else 0.092
    kn_x = 0.076 if sex == "female" else 0.078
    an_x = 0.078 if sex == "female" else 0.080

    return {
        "pelvis": Vector((0.0, 0.025, 0.900 * z_s)),
        "lumbar": Vector((0.0, 0.032, 1.110 * z_s)),
        "chest_top": Vector((0.0, 0.024, 1.385 * z_s)),
        "neck_top": Vector((0.0, 0.015, 1.495 * z_s)),
        "head_top": Vector((0.0, 0.005, 1.690 * z_s)),
        "sh_L": Vector((+sh_x, 0.024, 1.368 * z_s)),
        "el_L": Vector((+el_x, 0.022, 1.095 * z_s)),
        "wr_L": Vector((+wr_x, -0.005, 0.858 * z_s)),
        "sh_R": Vector((-sh_x, 0.024, 1.368 * z_s)),
        "el_R": Vector((-el_x, 0.022, 1.095 * z_s)),
        "wr_R": Vector((-wr_x, -0.005, 0.858 * z_s)),
        "hip_L": Vector((+hip_x, 0.018, 0.865 * z_s)),
        "kn_L": Vector((+kn_x, 0.015, 0.438 * z_s)),
        "an_L": Vector((+an_x, 0.034, 0.082 * z_s)),
        "ft_L": Vector((+an_x, -0.105, 0.020 * z_s)),
        "hip_R": Vector((-hip_x, 0.018, 0.865 * z_s)),
        "kn_R": Vector((-kn_x, 0.015, 0.438 * z_s)),
        "an_R": Vector((-an_x, 0.034, 0.082 * z_s)),
        "ft_R": Vector((-an_x, -0.105, 0.020 * z_s)),
        "z_s": z_s,
    }


def create_armature(name, J):
    arm_data = bpy.data.armatures.new(name)
    arm_obj = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add_bone(bname, head, tail, parent=None, connected=False):
        b = eb.new(bname)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = eb[parent]
            b.use_connect = connected
        return b

    add_bone("Root", Vector((0, 0, 0)), Vector((0, 0, 0.25)))
    add_bone("Pelvis", J["pelvis"], J["lumbar"], "Root", False)
    add_bone("Spine", J["lumbar"], J["chest_top"], "Pelvis", True)
    add_bone("Neck", J["chest_top"], J["neck_top"], "Spine", True)
    add_bone("Head", J["neck_top"], J["head_top"], "Neck", True)

    for side in ("L", "R"):
        add_bone(f"UpperArm.{side}", J[f"sh_{side}"], J[f"el_{side}"], "Spine", False)
        add_bone(f"Forearm.{side}", J[f"el_{side}"], J[f"wr_{side}"], f"UpperArm.{side}", True)

        add_bone(f"Thigh.{side}", J[f"hip_{side}"], J[f"kn_{side}"], "Pelvis", False)
        add_bone(f"Shin.{side}", J[f"kn_{side}"], J[f"an_{side}"], f"Thigh.{side}", True)
        add_bone(f"Foot.{side}", J[f"an_{side}"], J[f"ft_{side}"], f"Shin.{side}", True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def point_to_segment_t(p, a, b):
    ab = b - a
    denom = ab.length_squared
    if denom < 1e-8:
        return 0.0, (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / denom))
    return t, (p - (a + ab * t)).length


def bind_sculpted_parts(parts, arm_obj, J):
    hip_z = J["hip_L"].z
    lumbar_z = J["lumbar"].z
    for obj, mode in parts:
        obj.parent = arm_obj
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.vertex_groups.clear()

        if mode == "head":
            vg = obj.vertex_groups.new(name="Head")
            vg.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
        elif mode == "neck":
            vg = obj.vertex_groups.new(name="Neck")
            vg.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
        elif mode == "torso":
            v_sp = obj.vertex_groups.new(name="Spine")
            v_pe = obj.vertex_groups.new(name="Pelvis")
            for v in obj.data.vertices:
                w_sp = smoothstep(lumbar_z - 0.07, lumbar_z + 0.07, v.co.z)
                v_sp.add([v.index], w_sp, "REPLACE")
                v_pe.add([v.index], 1.0 - w_sp, "REPLACE")
        elif mode == "shorts":
            v_pe = obj.vertex_groups.new(name="Pelvis")
            v_tl = obj.vertex_groups.new(name="Thigh.L")
            v_tr = obj.vertex_groups.new(name="Thigh.R")
            for v in obj.data.vertices:
                w_th = smoothstep(hip_z + 0.02, hip_z - 0.08, v.co.z)
                v_pe.add([v.index], 1.0 - w_th, "REPLACE")
                if v.co.x >= 0:
                    v_tl.add([v.index], w_th, "REPLACE")
                else:
                    v_tr.add([v.index], w_th, "REPLACE")
        elif mode.startswith("shorts_thigh_"):
            side = mode.split("_")[-1]
            v_pe = obj.vertex_groups.new(name="Pelvis")
            v_th = obj.vertex_groups.new(name=f"Thigh.{side}")
            for v in obj.data.vertices:
                w_th = smoothstep(hip_z + 0.04, hip_z - 0.06, v.co.z)
                v_pe.add([v.index], 1.0 - w_th, "REPLACE")
                v_th.add([v.index], w_th, "REPLACE")
        elif mode.startswith("ankle_"):
            side = mode.split("_")[-1]
            an_z = J[f"an_{side}"].z
            v_sh = obj.vertex_groups.new(name=f"Shin.{side}")
            v_ft = obj.vertex_groups.new(name=f"Foot.{side}")
            for v in obj.data.vertices:
                w_ft = smoothstep(an_z + 0.035, an_z - 0.025, v.co.z)
                v_sh.add([v.index], 1.0 - w_ft, "REPLACE")
                v_ft.add([v.index], w_ft, "REPLACE")
        elif mode.startswith("foot_"):
            side = mode.split("_")[-1]
            vg = obj.vertex_groups.new(name=f"Foot.{side}")
            vg.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")

        mod = obj.modifiers.new(name="Armature", type="ARMATURE")
        mod.object = arm_obj
        mod.use_deform_preserve_volume = True


def assign_muscle_weights(objects, arm_obj, J):
    z_s = J["z_s"]
    sh_x = abs(J["sh_L"].x)
    el_z = J["el_L"].z
    hip_z = J["hip_L"].z
    kn_z = J["kn_L"].z
    an_z = J["an_L"].z
    lumbar_z = J["lumbar"].z
    neck_z = J["chest_top"].z
    head_z = J["neck_top"].z

    for obj in objects:
        low = obj.name.lower()
        mesh = obj.data
        bb = [Vector(c) for c in obj.bound_box]
        center = sum(bb, Vector((0, 0, 0))) / 8.0

        obj.vertex_groups.clear()
        vgs = {}

        def add_w(bname, vidx, w):
            if w <= 1e-4:
                return
            vg = vgs.get(bname)
            if vg is None:
                vg = obj.vertex_groups.new(name=bname)
                vgs[bname] = vg
            vg.add([vidx], w, "REPLACE")

        is_pec = "pectoralis major" in low
        is_delt = "deltoid" in low
        is_lat = "latissimus dorsi" in low
        is_arm_musc = (
            any(
                k in low
                for k in (
                    "triceps brachii", "biceps brachii", "brachialis", "coracobrachialis",
                    "brachioradialis", "pronator", "supinator", "flexor carpi", "extensor carpi",
                    "flexor digitorum", "extensor digitorum", "palmaris", "extensor pollicis",
                    "flexor pollicis", "anconeus", "indicis", "digiti minimi"
                )
            )
            and center.z > 0.58 * z_s
        ) or (
            not is_pec and not is_delt and not is_lat
            and abs(center.x) > sh_x * 1.02
            and 0.62 * z_s < center.z < 1.38 * z_s
        )

        side = "L" if (low.endswith(".l") or center.x >= 0.0) else "R"

        for v in mesh.vertices:
            p = v.co
            x, y, z = p.x, p.y, p.z
            ax = abs(x)
            vside = "L" if x >= 0.0 else "R"

            if is_pec:
                w_arm = smoothstep(sh_x * 0.62, sh_x * 1.08, ax)
                add_w("Spine", v.index, 1.0 - w_arm)
                add_w(f"UpperArm.{side}", v.index, w_arm)
            elif is_delt:
                t_u, _ = point_to_segment_t(p, J[f"sh_{side}"], J[f"el_{side}"])
                w_arm = smoothstep(0.02, 0.36, t_u) * 0.85 + 0.15 * smoothstep(sh_x * 0.78, sh_x * 1.05, ax)
                w_arm = max(0.0, min(1.0, w_arm))
                add_w("Spine", v.index, 1.0 - w_arm)
                add_w(f"UpperArm.{side}", v.index, w_arm)
            elif is_lat:
                w_arm = smoothstep(sh_x * 0.75, sh_x * 1.08, ax) * smoothstep(1.18 * z_s, 1.34 * z_s, z)
                w_pelvis = 1.0 - smoothstep(lumbar_z - 0.08, lumbar_z + 0.10, z)
                w_spine = max(0.0, 1.0 - w_arm - w_pelvis)
                tot = w_arm + w_pelvis + w_spine
                add_w(f"UpperArm.{side}", v.index, w_arm / tot)
                add_w("Pelvis", v.index, w_pelvis / tot)
                add_w("Spine", v.index, w_spine / tot)
            elif is_arm_musc:
                if z >= el_z + 0.055:
                    w_sh = smoothstep(J[f"sh_{side}"].z - 0.02, J[f"sh_{side}"].z + 0.05, z) * (1.0 - smoothstep(sh_x * 0.85, sh_x * 1.15, ax))
                    add_w(f"UpperArm.{side}", v.index, 1.0 - 0.6 * w_sh)
                    add_w("Spine", v.index, 0.6 * w_sh)
                elif z >= el_z - 0.055:
                    w_fore = smoothstep(el_z + 0.055, el_z - 0.055, z)
                    add_w(f"UpperArm.{side}", v.index, 1.0 - w_fore)
                    add_w(f"Forearm.{side}", v.index, w_fore)
                else:
                    add_w(f"Forearm.{side}", v.index, 1.0)
            else:
                if z >= head_z:
                    w_h = smoothstep(head_z, head_z + 0.05, z)
                    add_w("Neck", v.index, 1.0 - w_h)
                    add_w("Head", v.index, w_h)
                elif z >= neck_z and ax < 0.085:
                    w_n = smoothstep(neck_z, neck_z + 0.06, z)
                    add_w("Spine", v.index, 1.0 - w_n)
                    add_w("Neck", v.index, w_n)
                elif z >= hip_z + 0.04:
                    w_sp = smoothstep(lumbar_z - 0.07, lumbar_z + 0.07, z)
                    add_w("Pelvis", v.index, 1.0 - w_sp)
                    add_w("Spine", v.index, w_sp)
                elif z >= hip_z - 0.08:
                    w_th = smoothstep(hip_z + 0.04, hip_z - 0.08, z)
                    add_w("Pelvis", v.index, 1.0 - w_th)
                    add_w(f"Thigh.{vside}", v.index, w_th)
                elif z >= kn_z + 0.055:
                    add_w(f"Thigh.{vside}", v.index, 1.0)
                elif z >= kn_z - 0.055:
                    w_sh = smoothstep(kn_z + 0.055, kn_z - 0.055, z)
                    add_w(f"Thigh.{vside}", v.index, 1.0 - w_sh)
                    add_w(f"Shin.{vside}", v.index, w_sh)
                elif z >= an_z + 0.035:
                    add_w(f"Shin.{vside}", v.index, 1.0)
                else:
                    add_w(f"Foot.{vside}", v.index, 1.0)

        mod = obj.modifiers.new(name="Armature", type="ARMATURE")
        mod.object = arm_obj
        mod.use_deform_preserve_volume = True


# ---------------------------------------------------------------------------
# Studio Gym Equipment (Flat Bench, Upright Rack, Olympic Barbell & Bumper Plates)
# ---------------------------------------------------------------------------
def add_beveled_box(name, loc, dims, mat, bevel_width=0.008, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = dims
    bpy.ops.object.transform_apply(scale=True)
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = bevel_width
    bev.segments = 3
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    return obj


def build_bench_and_barbell(mats, grip_half_x, sex, bench_top_z=0.45):
    col = bpy.data.collections.new("GymEquipment")
    bpy.context.scene.collection.children.link(col)

    mat_steel = make_simple_pbr("Bench_Steel", (0.025, 0.030, 0.038, 1.0), roughness=0.38, metallic=0.68)
    mat_pad = make_simple_pbr("Bench_Leather", (0.032, 0.038, 0.048, 1.0), roughness=0.58, metallic=0.04)
    mat_chrome = make_simple_pbr("Barbell_Chrome", (0.62, 0.66, 0.72, 1.0), roughness=0.22, metallic=0.92)
    mat_plate = make_simple_pbr("Plate_Rubber", (0.018, 0.021, 0.026, 1.0), roughness=0.64, metallic=0.06)
    mat_lime_trim = mats["lime_accent"]

    def link_only_to_col(obj):
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col.objects.link(obj)

    pad_h = 0.065
    pad = add_beveled_box(
        "Bench_Pad",
        loc=(0.0, -0.22, bench_top_z - pad_h * 0.5),
        dims=(0.30, 1.24, pad_h),
        mat=mat_pad,
        bevel_width=0.014,
    )
    link_only_to_col(pad)

    beam_z = bench_top_z - pad_h - 0.025
    for name, loc, dims in [
        ("Bench_Beam", (0.0, -0.22, beam_z), (0.07, 1.12, 0.05)),
        ("Bench_Leg_Rear", (0.0, -0.68, beam_z * 0.5), (0.065, 0.065, beam_z)),
        ("Bench_Leg_Front", (0.0, 0.24, beam_z * 0.5), (0.065, 0.065, beam_z)),
        ("Bench_Foot_Rear", (0.0, -0.68, 0.022), (0.46, 0.08, 0.044)),
        ("Bench_Foot_Front", (0.0, 0.24, 0.022), (0.42, 0.08, 0.044)),
        ("Bench_Crossbar", (0.0, -0.22, 0.14), (0.045, 0.92, 0.045)),
        ("Rack_Post_L", (0.56, -0.60, 0.54), (0.055, 0.055, 1.08)),
        ("Rack_Post_R", (-0.56, -0.60, 0.54), (0.055, 0.055, 1.08)),
        ("Rack_Base_L", (0.56, -0.60, 0.022), (0.08, 0.52, 0.044)),
        ("Rack_Base_R", (-0.56, -0.60, 0.022), (0.08, 0.52, 0.044)),
        ("Rack_Tie_Rear", (0.0, -0.82, 0.025), (1.20, 0.055, 0.045)),
        ("Rack_JCup_L", (0.56, -0.54, 0.95), (0.06, 0.09, 0.038)),
        ("Rack_JCup_R", (-0.56, -0.54, 0.95), (0.06, 0.09, 0.038)),
    ]:
        o = add_beveled_box(name, loc=loc, dims=dims, mat=mat_steel, bevel_width=0.006)
        link_only_to_col(o)

    bar_root = bpy.data.objects.new("Barbell_Root", None)
    bar_root.location = (0.0, -0.26, 1.05)
    col.objects.link(bar_root)

    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0145, depth=1.36, rotation=(0, math.pi / 2, 0))
    shaft = bpy.context.active_object
    shaft.name = "Barbell_Shaft"
    bpy.ops.object.shade_smooth()
    shaft.data.materials.append(mat_chrome)
    shaft.parent = bar_root
    link_only_to_col(shaft)

    for sign, tag in ((1, "L"), (-1, "R")):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.025, depth=0.38, location=(sign * 0.87, 0, 0), rotation=(0, math.pi / 2, 0))
        slv = bpy.context.active_object
        slv.name = f"Barbell_Sleeve_{tag}"
        bpy.ops.object.shade_smooth()
        slv.data.materials.append(mat_chrome)
        slv.parent = bar_root
        link_only_to_col(slv)

        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.036, depth=0.032, location=(sign * 0.695, 0, 0), rotation=(0, math.pi / 2, 0))
        col_obj = bpy.context.active_object
        col_obj.name = f"Barbell_Collar_{tag}"
        bpy.ops.object.shade_smooth()
        col_obj.data.materials.append(mat_chrome)
        col_obj.parent = bar_root
        link_only_to_col(col_obj)

        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.215, depth=0.050, location=(sign * 0.745, 0, 0), rotation=(0, math.pi / 2, 0))
        p20 = bpy.context.active_object
        p20.name = f"Plate_20kg_{tag}"
        bev = p20.modifiers.new("Bevel", "BEVEL")
        bev.width = 0.007
        bev.segments = 3
        bpy.ops.object.shade_smooth()
        p20.data.materials.append(mat_plate)
        p20.parent = bar_root
        link_only_to_col(p20)

        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.165, minor_radius=0.0038,
            location=(sign * 0.770, 0, 0),
            rotation=(0, math.pi / 2, 0),
        )
        ring = bpy.context.active_object
        ring.name = f"Plate_Trim_{tag}"
        bpy.ops.object.shade_smooth()
        ring.data.materials.append(mat_lime_trim)
        ring.parent = bar_root
        link_only_to_col(ring)

        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.168, depth=0.034, location=(sign * 0.794, 0, 0), rotation=(0, math.pi / 2, 0))
        p10 = bpy.context.active_object
        p10.name = f"Plate_10kg_{tag}"
        bev2 = p10.modifiers.new("Bevel", "BEVEL")
        bev2.width = 0.005
        bev2.segments = 2
        bpy.ops.object.shade_smooth()
        p10.data.materials.append(mat_plate)
        p10.parent = bar_root
        link_only_to_col(p10)

    # Attach solid, anatomically sculpted closed-grip fists directly to the barbell!
    build_sculpted_closed_fists_on_bar(bar_root, col, mats, grip_half_x, sex)
    return bar_root


# ---------------------------------------------------------------------------
# Studio Lighting, Obsidian Floor & Elevated Heroic 3/4 Camera
# ---------------------------------------------------------------------------
def build_studio_and_camera():
    scene = bpy.context.scene

    # Pure SPOT Carbon Dark Studio World (#0B0D0F)
    world = bpy.data.worlds.new("SPOT_Studio_World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.0032, 0.0038, 0.0050, 1.0)
    bg.inputs["Strength"].default_value = 0.55

    # Deep matte obsidian floor catching soft studio spotlight right under the bench
    bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0, 0, 0.0))
    floor = bpy.context.active_object
    floor.name = "Studio_Floor"
    floor.data.materials.append(
        make_simple_pbr("Studio_Floor_Mat", (0.0038, 0.0046, 0.0062, 1.0), roughness=0.84, metallic=0.04)
    )

    def add_area_light(name, loc, target, energy, size, color=(1.0, 1.0, 1.0)):
        ld = bpy.data.lights.new(name=name, type="AREA")
        ld.energy = energy
        ld.size = size
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (Vector(target) - lo.location).to_track_quat("-Z", "Y").to_euler()
        return lo

    # Overhead sculpting Key Light (carves dramatic athletic shadows between muscle heads!)
    add_area_light("Key_Light", (1.45, 1.65, 2.75), (0.0, -0.05, 0.58), energy=260, size=1.25, color=(0.98, 0.99, 1.0))
    # Cool Soft Fill from opposite side
    add_area_light("Fill_Light", (-2.2, 0.85, 1.70), (0.0, -0.05, 0.55), energy=90, size=2.0, color=(0.82, 0.90, 1.0))
    # Crisp Rim Light behind shoulders/head separating silhouette from dark carbon backdrop
    add_area_light("Rim_Light", (-0.65, -2.45, 2.05), (0.0, -0.05, 0.62), energy=290, size=1.15, color=(0.90, 0.98, 1.0))

    # Elevated Heroic 3/4 Camera:
    # Balanced margins around BOTH lifting shoes, head, barbell plates, and clear Pecs/Delt/Triceps!
    cam_data = bpy.data.cameras.new("SPOT_Camera")
    cam_data.lens = 43.0
    cam_obj = bpy.data.objects.new("SPOT_Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = Vector((1.92, 1.98, 2.08))
    cam_target = Vector((0.0, -0.02, 0.50))
    cam_obj.rotation_euler = (cam_target - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    return cam_obj


# ---------------------------------------------------------------------------
# 3D Analytical 2-Bone IK & Seamless 120-Frame Bench Press Animation
# ---------------------------------------------------------------------------
def solve_3d_two_bone_ik(shoulder, target, l1, l2, pole_target):
    to_target = target - shoulder
    dist = to_target.length
    min_d = abs(l1 - l2) + 0.015
    max_d = l1 + l2 - 0.008
    d = max(min_d, min(max_d, dist))
    u = to_target.normalized() if dist > 1e-6 else Vector((0, 0, 1))

    pole_dir = pole_target - shoulder
    pole_perp = pole_dir - u * pole_dir.dot(u)
    if pole_perp.length < 1e-6:
        pole_perp = Vector((0, 1, 0))
    else:
        pole_perp.normalize()

    a = (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    return shoulder + u * a + pole_perp * h


def aim_bone_world(arm_obj, pbone, target_world_tail, twist_rad=0.0):
    bpy.context.view_layer.update()
    inv_arm = arm_obj.matrix_world.inverted()
    head_arm = pbone.head.copy()
    cur_tail_arm = pbone.tail.copy()
    target_tail_arm = inv_arm @ target_world_tail

    cur_dir = cur_tail_arm - head_arm
    tgt_dir = target_tail_arm - head_arm
    if cur_dir.length < 1e-6 or tgt_dir.length < 1e-6:
        return
    cur_dir.normalize()
    tgt_dir.normalize()

    q_swing = cur_dir.rotation_difference(tgt_dir)
    rot_swing = q_swing.to_matrix().to_4x4()
    rot_part = pbone.matrix.to_3x3().to_4x4()
    new_rot = rot_swing @ rot_part

    if abs(twist_rad) > 1e-5:
        new_rot = Matrix.Rotation(twist_rad, 4, tgt_dir) @ new_rot

    pbone.matrix = Matrix.Translation(head_arm) @ new_rot
    pbone.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def eval_bench_cycle(frame, total_frames=120):
    f = ((frame - 1) % total_frames) + 1
    if f <= 15:
        return 0.0, "top"
    if f <= 67:
        t = (f - 15) / (67 - 15)
        s = -(math.cos(math.pi * t) - 1.0) * 0.5
        return 0.55 * s + 0.45 * (t * t * (3.0 - 2.0 * t)), "eccentric"
    if f <= 75:
        return 1.0, "bottom"
    if f <= 108:
        t = (f - 75) / (108 - 75)
        if t < 0.42:
            u = t / 0.42
            press = 0.48 * (u * u * (2.2 - 1.2 * u))
        else:
            u = (t - 0.42) / 0.58
            press = 0.48 + 0.52 * (1.0 - math.pow(max(0.0, 1.0 - u), 2.35))
        return 1.0 - press, "concentric"
    return 0.0, "lockout"


def eval_quad_bezier(p0, p1, p2, t):
    u = 1.0 - t
    return p0 * (u * u) + p1 * (2.0 * u * t) + p2 * (t * t)


def animate_bench_press(arm_obj, bar_root, J, sex, grip_half_x, bench_top_z=0.45, total_frames=120):
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = total_frames
    bpy.context.scene.render.fps = 30

    z_s = J["z_s"]
    pelvis_y_shift = 0.90 * z_s + 0.14
    back_thickness = 0.114 if sex == "male" else 0.104

    arm_obj.rotation_mode = "XYZ"
    arm_obj.rotation_euler = (-math.pi / 2.0, 0.0, math.pi)
    arm_obj.location = Vector((0.0, pelvis_y_shift, bench_top_z + back_thickness))
    bpy.context.view_layer.update()

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones

    l_thigh = (J["kn_L"] - J["hip_L"]).length
    l_shin = (J["an_L"] - J["kn_L"]).length
    l_upper = (J["el_L"] - J["sh_L"]).length
    l_fore = (J["wr_L"] - J["el_L"]).length

    foot_stance_x = 0.19 if sex == "female" else 0.21
    for side, sign in (("L", -1.0), ("R", 1.0)):
        for bn in (f"Thigh.{side}", f"Shin.{side}", f"Foot.{side}"):
            pb[bn].rotation_mode = "QUATERNION"
            pb[bn].rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        bpy.context.view_layer.update()

        hip_w = arm_obj.matrix_world @ pb[f"Thigh.{side}"].head
        ankle_target = Vector((sign * foot_stance_x, hip_w.y + 0.34, 0.072))
        knee_pole = Vector((sign * (foot_stance_x + 0.04), hip_w.y + 0.65, 0.85))
        knee_w = solve_3d_two_bone_ik(hip_w, ankle_target, l_thigh, l_shin, knee_pole)
        toe_w = Vector((sign * (foot_stance_x + 0.02), ankle_target.y + 0.16, 0.026))

        aim_bone_world(arm_obj, pb[f"Thigh.{side}"], knee_w)
        aim_bone_world(arm_obj, pb[f"Shin.{side}"], ankle_target)
        aim_bone_world(arm_obj, pb[f"Foot.{side}"], toe_w)

        for bn in (f"Thigh.{side}", f"Shin.{side}", f"Foot.{side}"):
            pb[bn].keyframe_insert(data_path="rotation_quaternion", frame=1)

    pb["Spine"].rotation_mode = "XYZ"
    pb["Spine"].rotation_euler = (-0.06, 0.0, 0.0)
    pb["Spine"].keyframe_insert(data_path="rotation_euler", frame=1)
    pb["Head"].rotation_mode = "XYZ"
    pb["Head"].rotation_euler = (0.04, 0.0, 0.0)
    pb["Head"].keyframe_insert(data_path="rotation_euler", frame=1)
    bpy.context.view_layer.update()

    sh_L_w = arm_obj.matrix_world @ pb["UpperArm.L"].head
    sh_R_w = arm_obj.matrix_world @ pb["UpperArm.R"].head
    sh_y = 0.5 * (sh_L_w.y + sh_R_w.y)
    sh_z = 0.5 * (sh_L_w.z + sh_R_w.z)

    lateral_reach = max(0.0, grip_half_x - abs(sh_L_w.x))
    max_vert_reach = math.sqrt(max(0.04, (l_upper + l_fore) ** 2 - lateral_reach ** 2))

    # Realistic J-curve: shoulder lockout -> lower-mid sternum -> J-curve drive back over shoulders
    bar_top = Vector((0.0, sh_y + 0.05, sh_z + max_vert_reach * 0.92 + 0.02))
    chest_clear = 0.175 if sex == "female" else 0.194
    bar_bottom = Vector((0.0, sh_y + 0.195, sh_z + chest_clear))
    ctrl_ecc = Vector((0.0, sh_y + 0.155, (bar_top.z + bar_bottom.z) * 0.5 + 0.02))
    ctrl_con = Vector((0.0, sh_y + 0.085, (bar_top.z + bar_bottom.z) * 0.5 - 0.01))

    key_frames = sorted(set(list(range(1, total_frames + 1, 2)) + [1, 15, 16, 41, 67, 68, 75, 76, 92, 108, 109, total_frames]))

    for f in key_frames:
        bpy.context.scene.frame_set(f)
        depth, phase = eval_bench_cycle(f, total_frames)

        if phase == "eccentric":
            bar_pos = eval_quad_bezier(bar_top, ctrl_ecc, bar_bottom, depth)
        elif phase == "concentric":
            bar_pos = eval_quad_bezier(bar_bottom, ctrl_con, bar_top, 1.0 - depth)
        elif phase == "bottom":
            bar_pos = bar_bottom.copy()
        else:
            bar_pos = bar_top.copy()

        bar_root.location = bar_pos
        bar_root.keyframe_insert(data_path="location", frame=f)

        for side, sign in (("L", -1.0), ("R", 1.0)):
            for bn in (f"UpperArm.{side}", f"Forearm.{side}"):
                pb[bn].rotation_mode = "QUATERNION"
                pb[bn].rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            bpy.context.view_layer.update()

            sh_w = arm_obj.matrix_world @ pb[f"UpperArm.{side}"].head
            # Wrist terminates seamlessly right inside the sculpted closed-fist wrist cuff!
            wrist_target = Vector((sign * grip_half_x, bar_pos.y, bar_pos.z - 0.028))

            elbow_pole = Vector((
                sign * (grip_half_x + 0.14),
                bar_pos.y + 0.22,
                bench_top_z - 0.14,
            ))

            elbow_w = solve_3d_two_bone_ik(sh_w, wrist_target, l_upper, l_fore, elbow_pole)

            aim_bone_world(arm_obj, pb[f"UpperArm.{side}"], elbow_w)
            aim_bone_world(arm_obj, pb[f"Forearm.{side}"], wrist_target)

            for bn in (f"UpperArm.{side}", f"Forearm.{side}"):
                pb[bn].keyframe_insert(data_path="rotation_quaternion", frame=f)

    bpy.ops.object.mode_set(mode="OBJECT")

    for obj in (arm_obj, bar_root):
        if obj.animation_data and obj.animation_data.action:
            for fc in obj.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "BEZIER"
                    kp.handle_left_type = "AUTO_CLAMPED"
                    kp.handle_right_type = "AUTO_CLAMPED"


def configure_render(width, height, samples):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = samples
    if hasattr(scene.eevee, "use_gtao"):
        scene.eevee.use_gtao = True
    if hasattr(scene.eevee, "use_shadows"):
        scene.eevee.use_shadows = True

    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - High Contrast"
    scene.view_settings.exposure = 0.12


def main():
    args = parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    log_step("1. Loading Z-Anatomy Muscular system")
    with bpy.data.libraries.load(args.blend, link=False) as (df, dt):
        dt.collections = [c for c in df.collections if c == "Muscular system"]

    musc_col = bpy.data.collections.get("Muscular system")
    if musc_col:
        bpy.context.scene.collection.children.link(musc_col)
    bpy.context.view_layer.update()

    musc_map = {}

    def gather_meshes(col):
        if not col:
            return
        for o in col.objects:
            if is_valid_muscle_mesh(o):
                musc_map[o.name] = o
        for ch in col.children:
            gather_meshes(ch)

    gather_meshes(musc_col)

    keep_names = set(musc_map.keys())
    for o in list(bpy.data.objects):
        if o.name not in keep_names:
            bpy.data.objects.remove(o, do_unlink=True)

    muscle_objs = list(musc_map.values())

    anatomy_col = bpy.data.collections.new("SPOT_Anatomy")
    bpy.context.scene.collection.children.link(anatomy_col)
    for o in muscle_objs:
        o.data = o.data.copy()
        mw = o.matrix_world.copy()
        is_mirrored = mw.determinant() < 0.0
        if mw != Matrix.Identity(4):
            o.data.transform(mw)
            if is_mirrored:
                bm = bmesh.new()
                bm.from_mesh(o.data)
                bmesh.ops.reverse_faces(bm, faces=bm.faces)
                bm.to_mesh(o.data)
                bm.free()
            o.data.update()
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
        o.modifiers.clear()
        o.constraints.clear()
        o.hide_viewport = False
        o.hide_render = False
        for c in list(o.users_collection):
            c.objects.unlink(o)
        anatomy_col.objects.link(o)

    if musc_col and musc_col.name in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.unlink(musc_col)
    bpy.context.view_layer.update()

    log_step(f"2. Dimorphism, distal tendon trim & shaders on {len(muscle_objs)} muscles")
    J = get_skeleton_joints(args.sex)
    apply_athletic_dimorphism_and_volume(muscle_objs, args.sex)
    muscle_objs = trim_distal_tendons_and_head_muscles(muscle_objs, J)
    mats = create_spot_materials()

    role_counts = {"primary": 0, "secondary": 0, "neutral_muscle": 0, "tendon": 0}
    for o in muscle_objs:
        role = classify_muscle_role(o.name)
        role_counts[role] += 1
        o.data.materials.clear()
        o.data.materials.append(mats[role])
        for poly in o.data.polygons:
            poly.use_smooth = True

    log_step(f"3. Rig, equipment & sculpted parts ({role_counts})")

    arm_obj = create_armature(f"SPOT_Rig_{args.sex}", J)

    grip_half_x = 0.30 if args.sex == "female" else 0.34
    bar_root = build_bench_and_barbell(mats, grip_half_x, args.sex, bench_top_z=0.45)
    build_studio_and_camera()

    sculpted_parts = build_sculpted_athletic_parts(anatomy_col, mats, J, args.sex)

    log_step("4. Assigning muscle weights")
    for o in muscle_objs:
        o.parent = arm_obj
        o.matrix_parent_inverse = Matrix.Identity(4)
    assign_muscle_weights(muscle_objs, arm_obj, J)
    bind_sculpted_parts(sculpted_parts, arm_obj, J)

    all_deform_objs = muscle_objs + [p[0] for p in sculpted_parts]
    for o in all_deform_objs:
        for m in o.modifiers:
            if m.type == "ARMATURE":
                m.show_viewport = False

    log_step("5. Solving 120-frame Bench Press IK")
    animate_bench_press(arm_obj, bar_root, J, args.sex, grip_half_x, bench_top_z=0.45, total_frames=120)

    for o in all_deform_objs:
        for m in o.modifiers:
            if m.type == "ARMATURE":
                m.show_viewport = True

    log_step("6. Configuring render & purging orphans")
    configure_render(args.width, args.height, args.samples)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    log_step("7. Starting EEVEE Next render")

    scene = bpy.context.scene
    if args.mode == "preview":
        scene.render.image_settings.file_format = "PNG"
        for frame, tag in ((1, "01_top"), (71, "03_bottom")):
            scene.frame_set(frame)
            out_path = os.path.join(args.out_dir, f"bench_{args.sex}_{tag}.png")
            scene.render.filepath = out_path
            bpy.ops.render.render(write_still=True)
            print(f"[SPOT Graphite 3D] Rendered preview frame {frame} -> {out_path}")
    else:
        scene.render.image_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
        scene.render.ffmpeg.ffmpeg_preset = "GOOD"
        scene.render.ffmpeg.gopsize = 15
        out_mp4 = os.path.join(args.out_dir, f"barbell_bench_press_{args.sex}.mp4")
        scene.render.filepath = out_mp4
        scene.frame_set(1)
        bpy.context.view_layer.update()
        bpy.ops.render.render(animation=True)
        print(f"[SPOT Graphite 3D] Rendered MP4 -> {out_mp4}")


if __name__ == "__main__":
    main()
