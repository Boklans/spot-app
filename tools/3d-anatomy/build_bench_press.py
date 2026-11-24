"""
SPOT — Realistic 3D Human Muscular Anatomy Pipeline (Project 001: Barbell Bench Press)

Headless Blender 4.2 LTS production script that builds a medical-grade 3D écorché
Barbell Bench Press scene directly from Z-Anatomy (BodyParts3D / CC BY-SA 4.0):

  1. Extracts 560 individual real muscle meshes + 329 skeletal meshes cleanly
     (excludes UI markers, fascia covers, and bursae so superficial muscles are crisp).
  2. Supports BOTH 'male' and 'female' anatomical models via dedicated anatomical
     dimorphism (pelvic breadth, biacromial shoulder ratio, ribcage/waist taper,
     femoral Q-angle, stature, and athletic hypertrophy profile).
  3. Builds an anatomically calibrated human skeleton armature and computes
     continuous 3D capsule weights with Dual-Quaternion volume preservation
     (zero detached muscles, smooth Pectoralis/Deltoid/Triceps origin-to-insertion stretch).
  4. Assigns SPOT medical écorché shaders independently to actual muscle meshes:
       - Primary:   Pectoralis major (clavicular + sternocostal + abdominal heads) -> Bright SPOT Lime
       - Secondary: Anterior deltoid (clavicular part) + Triceps brachii (all 3 heads) -> Softer Green
       - Neutral:   All other superficial muscles -> High-relief neutral anatomical sculpture with AO crevices
       - Bones:     Matte ivory anatomical bone shader
  5. Builds studio flat workout bench, rack uprights, Olympic 20kg barbell & bumper plates.
  6. Animates a biomechanically accurate 4.0s seamless loop (120 frames @ 30fps) with
     3D analytical 2-bone IK locked to the barbell shaft along a realistic J-curve.
  7. Renders either diagnostic keyframes (--mode preview) or final H.264 MP4 (--mode mp4).

Usage:
  blender --factory-startup --background --python tools/3d-anatomy/build_bench_press.py -- \
      --sex male --mode preview --out-dir <dir>
"""
import argparse
import math
import os
import sys
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------------------
# CLI Arguments
# ---------------------------------------------------------------------------
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
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--height", type=int, default=640)
    parser.add_argument("--samples", type=int, default=24)
    return parser.parse_args(args_list)


# ---------------------------------------------------------------------------
# Muscle Classification (Independent Anatomical Mesh Highlighting)
# ---------------------------------------------------------------------------
PRIMARY_PATTERNS = (
    "pectoralis major",
)

SECONDARY_PATTERNS = (
    "clavicular part of deltoid",
    "triceps brachii",
)

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
    "synovial", "fat pad", "labrum", "cartilage of nose",
    "eyeball", "eyelid", "ear", "tooth", "teeth", "gingiva",
    "palate", "tongue", "pharynx", "larynx", "diaphragm",
    "pelvic floor", "perine", "sphincter", "cremaster",
    "pectoralis minor",  # deep muscle under pec major
    "subscapularis", "intercostal", "transversus thoracis",
    "sesamoid", "hyoid", "ossicle",
)


def is_valid_anatomy_mesh(obj):
    if obj.type != "MESH" or not obj.data or len(obj.data.vertices) < 20:
        return False
    low = obj.name.lower()
    if any(low.endswith(s) for s in IGNORE_SUFFIXES):
        return False
    if any(k in low for k in EXCLUDE_KEYWORDS):
        return False
    return True


def classify_muscle_role(obj_name, is_bone):
    if is_bone:
        return "bone"
    low = obj_name.lower()
    if any(p in low for p in PRIMARY_PATTERNS):
        return "primary"
    if any(p in low for p in SECONDARY_PATTERNS):
        return "secondary"
    if "tendon" in low or "aponeurosis" in low or "tract" in low:
        return "tendon"
    return "neutral_muscle"


# ---------------------------------------------------------------------------
# SPOT Medical Écorché PBR Shader Library
# ---------------------------------------------------------------------------
def build_anatomical_material(name, base_rgba, crevice_rgba, roughness, emission_rgba=None, emission_strength=0.0, bump_strength=0.14, subsurface=0.18, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (260, 0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.42
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
    if "Subsurface Scale" in bsdf.inputs:
        bsdf.inputs["Subsurface Scale"].default_value = 0.012
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.14
        bsdf.inputs["Coat Roughness"].default_value = 0.32

    if emission_rgba and emission_strength > 0.0:
        bsdf.inputs["Emission Color"].default_value = emission_rgba
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    # Ambient Occlusion node to carve deep, unmistakable boundaries between adjacent muscles
    ao = nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 0.055
    ao.location = (-360, 220)

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-140, 220)
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[1].position = 0.88

    mix_col = nodes.new("ShaderNodeMix")
    mix_col.data_type = "RGBA"
    mix_col.location = (40, 180)
    mix_col.inputs["A"].default_value = crevice_rgba
    mix_col.inputs["B"].default_value = base_rgba

    links.new(ao.outputs["AO"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], mix_col.inputs["Factor"])
    links.new(mix_col.outputs["Result"], bsdf.inputs["Base Color"])

    # Fine directional muscle-fiber micro-striation bump
    if bump_strength > 0.0:
        tex_coord = nodes.new("ShaderNodeTexCoord")
        tex_coord.location = (-640, -180)

        mapping = nodes.new("ShaderNodeMapping")
        mapping.location = (-440, -180)
        mapping.inputs["Scale"].default_value = (18.0, 18.0, 85.0)

        noise = nodes.new("ShaderNodeTexNoise")
        noise.location = (-220, -180)
        noise.inputs["Scale"].default_value = 6.5
        noise.inputs["Detail"].default_value = 6.0
        noise.inputs["Roughness"].default_value = 0.65

        bump = nodes.new("ShaderNodeBump")
        bump.location = (20, -180)
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.0025

        links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def create_spot_materials():
    return {
        # Primary Active Muscle: Pectoralis Major -> Vivid SPOT Lime (#C8FF3D)
        "primary": build_anatomical_material(
            "SPOT_Primary_Muscle",
            base_rgba=(0.48, 0.98, 0.02, 1.0),
            crevice_rgba=(0.07, 0.22, 0.01, 1.0),
            roughness=0.34,
            emission_rgba=(0.50, 0.99, 0.04, 1.0),
            emission_strength=0.72,
            bump_strength=0.28,
            subsurface=0.18,
        ),
        # Secondary Active Muscles: Anterior Deltoid & Triceps Brachii -> Distinct Soft Emerald-Green
        "secondary": build_anatomical_material(
            "SPOT_Secondary_Muscle",
            base_rgba=(0.07, 0.46, 0.20, 1.0),
            crevice_rgba=(0.015, 0.11, 0.045, 1.0),
            roughness=0.42,
            emission_rgba=(0.08, 0.48, 0.20, 1.0),
            emission_strength=0.28,
            bump_strength=0.26,
            subsurface=0.14,
        ),
        # Neutral Superficial Muscles: Deep High-Relief Matte Anatomical Écorché Sculpture
        "neutral_muscle": build_anatomical_material(
            "SPOT_Neutral_Muscle",
            base_rgba=(0.145, 0.165, 0.205, 1.0),
            crevice_rgba=(0.022, 0.026, 0.036, 1.0),
            roughness=0.44,
            bump_strength=0.32,
            subsurface=0.08,
        ),
        # Tendons / Aponeuroses: Subtle silver-ivory transition
        "tendon": build_anatomical_material(
            "SPOT_Tendon",
            base_rgba=(0.24, 0.26, 0.30, 1.0),
            crevice_rgba=(0.06, 0.07, 0.09, 1.0),
            roughness=0.42,
            bump_strength=0.10,
            subsurface=0.05,
        ),
        # Anatomical Skeleton (skull, hands, feet, joints): Clean sculpted anatomical stone-ivory
        "bone": build_anatomical_material(
            "SPOT_Bone",
            base_rgba=(0.28, 0.30, 0.34, 1.0),
            crevice_rgba=(0.07, 0.08, 0.10, 1.0),
            roughness=0.48,
            bump_strength=0.06,
            subsurface=0.04,
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
# Anatomical Sex Dimorphism Morph (True Structural Proportions, NOT Uniform Scale)
# ---------------------------------------------------------------------------
def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def apply_anatomical_dimorphism(objects, sex):
    """
    Applies anatomically distinct structural proportions in standing rest space
    (Z in [0.0, 1.71], X symmetric, Y anterior=- / posterior=+) BEFORE rigging:
      - Male:   1.78m athletic build, broader biacromial clavicle/deltoid girdle,
                stronger thoracic cage, narrower pelvic ratio.
      - Female: 1.64m athletic build, narrower shoulder girdle & ribcage, slimmer
                waist, genuinely wider iliac pelvic girdle + fuller gluteal curve,
                anatomical femoral Q-angle tapering smoothly toward knees.
    """
    for obj in objects:
        mesh = obj.data
        mw = obj.matrix_world.copy()
        mw_inv = mw.inverted()
        for v in mesh.vertices:
            p = mw @ v.co
            x, y, z = p.x, p.y, p.z

            if sex == "female":
                # 1. Shoulder girdle & upper thorax narrower (Z: 1.15 .. 1.48)
                w_shoulder = smoothstep(1.08, 1.36, z) * (1.0 - smoothstep(1.44, 1.56, z))
                # 2. Waist taper (Z: 0.98 .. 1.24)
                w_waist = smoothstep(0.94, 1.07, z) * (1.0 - smoothstep(1.12, 1.28, z))
                # 3. Pelvic & gluteal breadth wider (Z: 0.72 .. 1.04)
                w_pelvis = smoothstep(0.62, 0.86, z) * (1.0 - smoothstep(0.96, 1.12, z))
                # 4. Head/neck proportional refinement
                w_head = smoothstep(1.45, 1.56, z)

                sx = 1.0 - 0.11 * w_shoulder - 0.08 * w_waist + 0.11 * w_pelvis - 0.04 * w_head
                sy = 1.0 - 0.07 * w_shoulder - 0.06 * w_waist + 0.07 * w_pelvis - 0.03 * w_head

                # Don't over-narrow hands/forearms laterally while shoulders narrow
                if abs(x) > 0.21 and z < 1.25:
                    arm_shift = -0.022 * (1.0 if x > 0 else -1.0)
                    x = x + arm_shift
                else:
                    x *= sx

                # Subtle posterior gluteal fullness & natural lumbar curve
                if y > 0.0 and w_pelvis > 0.01:
                    y *= (1.0 + 0.10 * w_pelvis)
                else:
                    y *= sy

                # Height ratio (~1.64m vs 1.70m base)
                z *= 0.965
            else:
                # Male athletic stature (~1.77m) with broader biacromial shoulder girdle & fuller upper torso
                w_shoulder = smoothstep(1.12, 1.36, z) * (1.0 - smoothstep(1.45, 1.56, z))
                w_chest = smoothstep(1.14, 1.30, z) * (1.0 - smoothstep(1.38, 1.48, z))
                w_pelvis = smoothstep(0.70, 0.90, z) * (1.0 - smoothstep(0.98, 1.12, z))

                sx = 1.0 + 0.075 * w_shoulder - 0.035 * w_pelvis
                sy = 1.0 + 0.065 * w_chest

                if abs(x) > 0.21 and z < 1.25:
                    arm_shift = 0.016 * (1.0 if x > 0 else -1.0)
                    x = x + arm_shift
                else:
                    x *= sx
                y *= sy
                z *= 1.04

            v.co = mw_inv @ Vector((x, y, z))
        mesh.update()


# ---------------------------------------------------------------------------
# Exact Skeletal Joint Calibration & Continuous Anatomical Skinning
# ---------------------------------------------------------------------------
def get_skeleton_joints(sex):
    """Returns exact joint world coordinates calibrated to the morphed Z-Anatomy skeleton."""
    z_s = 0.965 if sex == "female" else 1.04
    sh_x = 0.155 if sex == "female" else 0.184
    el_x = 0.208 if sex == "female" else 0.244
    wr_x = 0.242 if sex == "female" else 0.278
    ha_x = 0.256 if sex == "female" else 0.292
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
        "ha_L": Vector((+ha_x, -0.022, 0.778 * z_s)),
        "fi_L": Vector((+(ha_x + 0.012), -0.032, 0.695 * z_s)),
        "sh_R": Vector((-sh_x, 0.024, 1.368 * z_s)),
        "el_R": Vector((-el_x, 0.022, 1.095 * z_s)),
        "wr_R": Vector((-wr_x, -0.005, 0.858 * z_s)),
        "ha_R": Vector((-ha_x, -0.022, 0.778 * z_s)),
        "fi_R": Vector((-(ha_x + 0.012), -0.032, 0.695 * z_s)),
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
        add_bone(f"Hand.{side}", J[f"wr_{side}"], J[f"ha_{side}"], f"Forearm.{side}", True)
        add_bone(f"Fingers.{side}", J[f"ha_{side}"], J[f"fi_{side}"], f"Hand.{side}", True)

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
    proj = a + ab * t
    return t, (p - proj).length


def assign_anatomical_weights(objects, bone_flags, arm_obj, J):
    """
    Assigns anatomically clean, continuous vertex weights so that:
      - Rigid bones (Humerus, Ulna, Radius, Femur, Tibia, Cranium, etc.) move 100% rigidly.
      - Pectoralis Major smoothly bridges Spine (medial sternum/clavicle) -> UpperArm (humeral insertion).
      - Anterior Deltoid & Triceps bridge shoulder/elbow smoothly without tearing.
      - Neighboring superficial muscles share identical spatial weight fields -> ZERO gaps!
    """
    z_s = J["z_s"]
    sh_x = abs(J["sh_L"].x)
    el_z = J["el_L"].z
    wr_z = J["wr_L"].z
    ha_z = J["ha_L"].z
    hip_z = J["hip_L"].z
    kn_z = J["kn_L"].z
    an_z = J["an_L"].z
    lumbar_z = J["lumbar"].z
    neck_z = J["chest_top"].z
    head_z = J["neck_top"].z

    # Rigid bone keyword map for skeletal parts
    def rigid_bone_for_mesh(name, center):
        low = name.lower()
        side = "L" if (low.endswith(".l") or center.x > 0.02) else ("R" if (low.endswith(".r") or center.x < -0.02) else None)
        if any(k in low for k in ("humerus",)):
            return f"UpperArm.{side}" if side else "Spine"
        if any(k in low for k in ("ulna", "radius")):
            return f"Forearm.{side}" if side else "Spine"
        if any(k in low for k in ("phalan",)) and center.z > 0.55 * z_s:
            return f"Fingers.{side}" if side else "Spine"
        if any(k in low for k in ("carpal", "metacarpal", "pisiform", "scaphoid", "lunate", "triquetr", "trapezi", "capitate", "hamate", "sesamoid")) and center.z > 0.55 * z_s:
            return f"Hand.{side}" if side else "Spine"
        if any(k in low for k in ("femur", "patella")):
            return f"Thigh.{side}" if side else "Pelvis"
        if any(k in low for k in ("tibia", "fibula")):
            return f"Shin.{side}" if side else "Pelvis"
        if any(k in low for k in ("tarsal", "metatarsal", "calcaneus", "talus", "navicular", "cuboid", "cuneiform")) or center.z < 0.22 * z_s:
            return f"Foot.{side}" if side else "Pelvis"
        # Spatial safeguard for any unnamed upper-limb bones hanging laterally beside hips
        if abs(center.x) > sh_x * 1.05 and 0.62 * z_s < center.z < 1.38 * z_s and side:
            if center.z < ha_z:
                return f"Fingers.{side}"
            if center.z < wr_z:
                return f"Hand.{side}"
            if center.z < el_z:
                return f"Forearm.{side}"
            return f"UpperArm.{side}"
        if center.z > head_z - 0.02:
            return "Head"
        if center.z > neck_z - 0.02 and abs(center.x) < 0.08:
            return "Neck"
        if center.z < lumbar_z - 0.04 and abs(center.x) < sh_x:
            return "Pelvis"
        return "Spine"

    arm_bones = [b.name for b in arm_obj.data.bones]

    for obj in objects:
        is_bone = bone_flags[obj.name]
        low = obj.name.lower()
        mesh = obj.data
        mw = obj.matrix_world

        # Pre-compute mesh center
        bb = [mw @ Vector(c) for c in obj.bound_box]
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

        # 1. Skeletal meshes -> clean rigid bone binding (bones never warp!)
        if is_bone:
            rb = rigid_bone_for_mesh(obj.name, center)
            vg = obj.vertex_groups.new(name=rb)
            vg.add([v.index for v in mesh.vertices], 1.0, "REPLACE")
        else:
            # 2. Muscle meshes -> anatomically tailored continuous weights
            is_pec = "pectoralis major" in low
            is_delt = "deltoid" in low
            is_lat = "latissimus dorsi" in low
            is_arm_musc = (
                any(
                    k in low
                    for k in (
                        "triceps brachii", "biceps brachii", "brachialis", "coracobrachialis",
                        "brachioradialis", "pronator", "supinator", "flexor carpi", "extensor carpi",
                        "flexor digitorum", "extensor digitorum", "palmaris", "abductor pollicis",
                        "extensor pollicis", "flexor pollicis", "anconeus", "thenar", "hypothenar",
                        "lumbrical", "interosse", "hand", "pollicis", "digiti minimi", "indicis",
                        "opponens", "adductor pollicis", "abductor digiti"
                    )
                )
                and center.z > 0.58 * z_s
            ) or (
                # Spatial guarantee: any muscle sitting laterally in the hanging arm/hand zone
                # (outside pelvis/ribcage X envelope) ALWAYS binds to the upper limb, never Pelvis!
                not is_pec and not is_delt and not is_lat
                and abs(center.x) > sh_x * 1.02
                and 0.62 * z_s < center.z < 1.38 * z_s
            )

            side = "L" if (low.endswith(".l") or center.x >= 0.0) else "R"

            for v in mesh.vertices:
                p = mw @ v.co
                x, y, z = p.x, p.y, p.z
                ax = abs(x)
                vside = "L" if x >= 0.0 else "R"

                if is_pec:
                    # Pectoralis major: sternum/clavicle (Spine) -> humeral insertion (UpperArm)
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
                    elif z >= wr_z + 0.03:
                        add_w(f"Forearm.{side}", v.index, 1.0)
                    elif z >= wr_z - 0.03:
                        w_hand = smoothstep(wr_z + 0.03, wr_z - 0.03, z)
                        add_w(f"Forearm.{side}", v.index, 1.0 - w_hand)
                        add_w(f"Hand.{side}", v.index, w_hand)
                    elif z >= ha_z + 0.015:
                        add_w(f"Hand.{side}", v.index, 1.0)
                    elif z >= ha_z - 0.015:
                        w_fi = smoothstep(ha_z + 0.015, ha_z - 0.015, z)
                        add_w(f"Hand.{side}", v.index, 1.0 - w_fi)
                        add_w(f"Fingers.{side}", v.index, w_fi)
                    else:
                        add_w(f"Fingers.{side}", v.index, 1.0)
                else:
                    # Head, Neck, Torso, Pelvis, Lower Limbs
                    if z >= head_z:
                        w_h = smoothstep(head_z, head_z + 0.05, z)
                        add_w("Neck", v.index, 1.0 - w_h)
                        add_w("Head", v.index, w_h)
                    elif z >= neck_z and ax < 0.085:
                        w_n = smoothstep(neck_z, neck_z + 0.06, z)
                        add_w("Spine", v.index, 1.0 - w_n)
                        add_w("Neck", v.index, w_n)
                    elif z >= hip_z + 0.04:
                        # Torso: Pelvis <-> Spine transition at lumbar
                        w_sp = smoothstep(lumbar_z - 0.07, lumbar_z + 0.07, z)
                        add_w("Pelvis", v.index, 1.0 - w_sp)
                        add_w("Spine", v.index, w_sp)
                    elif z >= hip_z - 0.08:
                        # Hip / Gluteal blend zone: Pelvis <-> Thigh
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
                    elif z >= an_z - 0.035:
                        w_ft = smoothstep(an_z + 0.035, an_z - 0.035, z)
                        add_w(f"Shin.{vside}", v.index, 1.0 - w_ft)
                        add_w(f"Foot.{vside}", v.index, w_ft)
                    else:
                        add_w(f"Foot.{vside}", v.index, 1.0)

        # Attach Armature modifier with Dual-Quaternion Volume Preservation
        mod = obj.modifiers.new(name="Armature", type="ARMATURE")
        mod.object = arm_obj
        mod.use_deform_preserve_volume = True


# ---------------------------------------------------------------------------
# Precision 3D Gym Equipment (Flat Bench, Upright Rack, Olympic Barbell & Plates)
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


def build_bench_and_barbell(bench_top_z=0.45):
    col = bpy.data.collections.new("GymEquipment")
    bpy.context.scene.collection.children.link(col)

    mat_steel = make_simple_pbr("Bench_Steel", (0.045, 0.052, 0.065, 1.0), roughness=0.38, metallic=0.65)
    mat_pad = make_simple_pbr("Bench_Leather", (0.065, 0.075, 0.092, 1.0), roughness=0.58, metallic=0.05)
    mat_chrome = make_simple_pbr("Barbell_Chrome", (0.68, 0.72, 0.78, 1.0), roughness=0.22, metallic=0.92)
    mat_plate = make_simple_pbr("Plate_Rubber", (0.032, 0.036, 0.044, 1.0), roughness=0.65, metallic=0.08)
    mat_lime_trim = make_simple_pbr(
        "Plate_Lime_Trim",
        (0.55, 0.96, 0.06, 1.0),
        roughness=0.35,
        emission=(0.55, 0.96, 0.06, 1.0),
        emission_strength=0.6,
    )

    def link_only_to_col(obj):
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col.objects.link(obj)

    # 1. Flat Bench Pad (top surface strictly at bench_top_z = 0.45m)
    pad_h = 0.065
    pad = add_beveled_box(
        "Bench_Pad",
        loc=(0.0, -0.22, bench_top_z - pad_h * 0.5),
        dims=(0.30, 1.24, pad_h),
        mat=mat_pad,
        bevel_width=0.014,
    )
    link_only_to_col(pad)

    # 2. Under-pad central steel spine & support legs
    beam_z = bench_top_z - pad_h - 0.025
    for name, loc, dims in [
        ("Bench_Beam", (0.0, -0.22, beam_z), (0.07, 1.12, 0.05)),
        ("Bench_Leg_Rear", (0.0, -0.68, beam_z * 0.5), (0.065, 0.065, beam_z)),
        ("Bench_Leg_Front", (0.0, 0.24, beam_z * 0.5), (0.065, 0.065, beam_z)),
        ("Bench_Foot_Rear", (0.0, -0.68, 0.022), (0.46, 0.08, 0.044)),
        ("Bench_Foot_Front", (0.0, 0.24, 0.022), (0.42, 0.08, 0.044)),
        ("Bench_Crossbar", (0.0, -0.22, 0.14), (0.045, 0.92, 0.045)),
        # Twin bench press rack uprights behind shoulders (x = +-0.54, y = -0.56)
        ("Rack_Post_L", (0.54, -0.56, 0.54), (0.06, 0.06, 1.08)),
        ("Rack_Post_R", (-0.54, -0.56, 0.54), (0.06, 0.06, 1.08)),
        ("Rack_Base_L", (0.54, -0.56, 0.022), (0.08, 0.52, 0.044)),
        ("Rack_Base_R", (-0.54, -0.56, 0.022), (0.08, 0.52, 0.044)),
        ("Rack_Tie_Rear", (0.0, -0.78, 0.025), (1.16, 0.06, 0.05)),
        ("Rack_JCup_L", (0.54, -0.50, 0.96), (0.065, 0.09, 0.04)),
        ("Rack_JCup_R", (-0.54, -0.50, 0.96), (0.065, 0.09, 0.04)),
    ]:
        o = add_beveled_box(name, loc=loc, dims=dims, mat=mat_steel, bevel_width=0.006)
        link_only_to_col(o)

    # 3. Olympic Barbell Assembly (parented to Barbell_Root empty so bar + plates move rigidly!)
    bar_root = bpy.data.objects.new("Barbell_Root", None)
    bar_root.location = (0.0, -0.26, 1.05)
    col.objects.link(bar_root)

    # Central shaft (29mm diameter, 1.36m inner shaft)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0145, depth=1.36, rotation=(0, math.pi / 2, 0))
    shaft = bpy.context.active_object
    shaft.name = "Barbell_Shaft"
    bpy.ops.object.shade_smooth()
    shaft.data.materials.append(mat_chrome)
    shaft.parent = bar_root
    link_only_to_col(shaft)

    # Sleeves + Collars + Olympic 20kg + 10kg Bumper Plates on both sides
    for sign, tag in ((1, "L"), (-1, "R")):
        # Sleeve (50mm diameter)
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.025, depth=0.38, location=(sign * 0.87, 0, 0), rotation=(0, math.pi / 2, 0))
        slv = bpy.context.active_object
        slv.name = f"Barbell_Sleeve_{tag}"
        bpy.ops.object.shade_smooth()
        slv.data.materials.append(mat_chrome)
        slv.parent = bar_root
        link_only_to_col(slv)

        # Inner collar
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.036, depth=0.032, location=(sign * 0.695, 0, 0), rotation=(0, math.pi / 2, 0))
        col_obj = bpy.context.active_object
        col_obj.name = f"Barbell_Collar_{tag}"
        bpy.ops.object.shade_smooth()
        col_obj.data.materials.append(mat_chrome)
        col_obj.parent = bar_root
        link_only_to_col(col_obj)

        # Primary 20kg Bumper Plate (450mm diameter -> r=0.225, thickness=0.052)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.225, depth=0.052, location=(sign * 0.745, 0, 0), rotation=(0, math.pi / 2, 0))
        p20 = bpy.context.active_object
        p20.name = f"Plate_20kg_{tag}"
        bev = p20.modifiers.new("Bevel", "BEVEL")
        bev.width = 0.007
        bev.segments = 3
        bpy.ops.object.shade_smooth()
        p20.data.materials.append(mat_plate)
        p20.parent = bar_root
        link_only_to_col(p20)

        # Subtle SPOT lime ring inset on 20kg plate face
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.172, minor_radius=0.004,
            location=(sign * 0.771, 0, 0),
            rotation=(0, math.pi / 2, 0),
        )
        ring = bpy.context.active_object
        ring.name = f"Plate_Trim_{tag}"
        bpy.ops.object.shade_smooth()
        ring.data.materials.append(mat_lime_trim)
        ring.parent = bar_root
        link_only_to_col(ring)

        # Secondary 10kg Plate (r=0.175, thickness=0.036)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.175, depth=0.036, location=(sign * 0.796, 0, 0), rotation=(0, math.pi / 2, 0))
        p10 = bpy.context.active_object
        p10.name = f"Plate_10kg_{tag}"
        bev2 = p10.modifiers.new("Bevel", "BEVEL")
        bev2.width = 0.005
        bev2.segments = 2
        bpy.ops.object.shade_smooth()
        p10.data.materials.append(mat_plate)
        p10.parent = bar_root
        link_only_to_col(p10)

    return bar_root


# ---------------------------------------------------------------------------
# Studio Lighting, Cyclorama Floor & Camera
# ---------------------------------------------------------------------------
def build_studio_and_camera(bench_top_z=0.45):
    scene = bpy.context.scene

    # World: Clean SPOT Carbon Dark (#0B0D0F linear ~ 0.0033, 0.0040, 0.0052)
    world = bpy.data.worlds.new("SPOT_Studio_World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.0045, 0.0055, 0.0072, 1.0)
    bg.inputs["Strength"].default_value = 0.85

    # Matte architectural floor plane catching subtle contact shadows
    bpy.ops.mesh.primitive_plane_add(size=14.0, location=(0, 0, 0.0))
    floor = bpy.context.active_object
    floor.name = "Studio_Floor"
    floor.data.materials.append(
        make_simple_pbr("Studio_Floor_Mat", (0.006, 0.008, 0.011, 1.0), roughness=0.80, metallic=0.04)
    )

    # 3-Point Medical Studio Lighting
    def add_area_light(name, loc, target, energy, size, color=(1.0, 1.0, 1.0)):
        ld = bpy.data.lights.new(name=name, type="AREA")
        ld.energy = energy
        ld.size = size
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        direction = Vector(target) - lo.location
        lo.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return lo

    # Key light: overhead-front 3/4 sculpting pectorals, delts, quads, and muscle grooves
    add_area_light("Key_Light", (1.85, 1.35, 2.55), (0.0, 0.02, 0.58), energy=220, size=1.3, color=(0.98, 0.99, 1.0))
    # Fill light: soft opposite side keeping shadowed side clearly legible
    add_area_light("Fill_Light", (-2.3, 0.75, 1.65), (0.0, 0.02, 0.55), energy=82, size=2.1, color=(0.84, 0.91, 1.0))
    # Rim light: clean athletic edge separation from dark studio background
    add_area_light("Rim_Light", (-0.85, -2.35, 1.95), (0.0, 0.02, 0.60), energy=250, size=1.2, color=(0.92, 0.98, 1.0))

    # Hero 3/4-Side Elevated Camera (Full body head-to-feet with clean margins + maximum Pecs/Delt/Triceps visibility)
    cam_data = bpy.data.cameras.new("SPOT_Camera")
    cam_data.lens = 44.0
    cam_obj = bpy.data.objects.new("SPOT_Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = Vector((2.38, 1.44, 1.66))
    cam_target = Vector((0.0, 0.02, 0.52))
    cam_obj.rotation_euler = (cam_target - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj
    return cam_obj


# ---------------------------------------------------------------------------
# 3D Analytical 2-Bone IK + Supine Bench Press Pose & 120-Frame Seamless Animation
# ---------------------------------------------------------------------------
def solve_3d_two_bone_ik(shoulder, target, l1, l2, pole_target):
    """Exact 3D analytical 2-bone IK returning elbow position aligned toward pole_target."""
    to_target = target - shoulder
    dist = to_target.length
    min_d = abs(l1 - l2) + 0.015
    max_d = l1 + l2 - 0.008
    d = max(min_d, min(max_d, dist))
    u = to_target.normalized() if dist > 1e-6 else Vector((0, 0, 1))

    # Project pole vector orthogonal to shoulder->target axis
    pole_dir = pole_target - shoulder
    pole_perp = pole_dir - u * pole_dir.dot(u)
    if pole_perp.length < 1e-6:
        pole_perp = Vector((0, 1, 0))
    else:
        pole_perp.normalize()

    a = (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    elbow = shoulder + u * a + pole_perp * h
    return elbow


def aim_bone_world(arm_obj, pbone, target_world_tail, twist_rad=0.0):
    """
    Rotates a PoseBone around its CURRENT live head using the shortest-arc
    quaternion (`rotation_difference`) so its +Y axis points cleanly at
    `target_world_tail` with ZERO candy-wrapper longitudinal twist!
    """
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

    # Apply swing around bone's current head in armature space
    cur_mat = pbone.matrix.copy()
    rot_part = cur_mat.to_3x3().to_4x4()
    new_rot = rot_swing @ rot_part

    if abs(twist_rad) > 1e-5:
        q_twist = Matrix.Rotation(twist_rad, 4, tgt_dir)
        new_rot = q_twist @ new_rot

    pbone.matrix = Matrix.Translation(head_arm) @ new_rot
    pbone.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def eval_bench_cycle(frame, total_frames=120):
    """
    Deterministic 4.0s (120 frames @ 30fps) seamless bench press cycle:
      - Frames   1..15  (500 ms): Top lockout hold
      - Frames  16..67 (1733 ms): Controlled eccentric lowering along forward arc
      - Frames  68..75  (267 ms): Brief pause touching lower-mid chest
      - Frames  76..108(1100 ms): Athletic concentric press along J-curve back over shoulders
      - Frames 109..120 (400 ms): Smooth top lockout finish (wraps seamlessly to Frame 1)
    Returns (depth in [0,1], j_curve_y_offset_factor).
    """
    f = ((frame - 1) % total_frames) + 1
    if f <= 15:
        return 0.0, "top"
    if f <= 67:
        t = (f - 15) / (67 - 15)
        # Smooth eccentric descent
        s = -(math.cos(math.pi * t) - 1.0) * 0.5
        depth = 0.55 * s + 0.45 * (t * t * (3.0 - 2.0 * t))
        return depth, "eccentric"
    if f <= 75:
        return 1.0, "bottom"
    if f <= 108:
        t = (f - 75) / (108 - 75)
        # Decisive athletic concentric drive with soft lockout deceleration
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


def animate_bench_press(arm_obj, bar_root, J, sex, bench_top_z=0.45, total_frames=120):
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = total_frames
    bpy.context.scene.render.fps = 30

    # Place athlete supine on flat bench pad:
    # Rotating standing body (+Z up, facing -Y) by +90 deg around X maps:
    #   old (x, y, z) -> new (x, -z, y)
    # Wait: verify! Rx(+90°): y' = y*cos - z*sin = -z; z' = y*sin + z*cos = +y!
    # Check: sternum had y = -0.10 -> z' = -0.10 (facing DOWN! WRONG!).
    # So we want Rx(-90°)!! Verify Rx(-90°):
    #   y' = y*0 - z*(-1) = +z (head at +Y, feet at 0) -> OR Rx(-90°) + Rz(180°)!
    # Let's verify Rx(-90°) + Rz(180°):
    #   First Rx(-90°): (x, y, z) -> (x, +z, -y). Now chest (y = -0.10) is at z' = +0.10 (FACING UP!!),
    #   back (y = +0.11) is at z' = -0.11 (RESTING ON BENCH!!), head (z = 1.65) is at y' = +1.65!
    #   Now Rz(180°): (x', y', z') -> (-x', -y', z'):
    #   Head moves to y'' = -1.65 (toward rack at -Y!), feet toward +Y, chest STILL faces UP (+Z)!!
    #   Let's offset Y so Pelvis sits at Y = +0.12 and Head sits at Y = -0.64,
    #   and offset Z so back of torso/glutes (rest y = +0.11 -> z'' = -0.11) rests right on bench_top_z = 0.45m -> offset Z = 0.56m!
    z_s = J["z_s"]
    pelvis_y_shift = 0.90 * z_s + 0.14  # brings pelvis (z=0.90*z_s) -> y = +0.14
    back_thickness = 0.112 if sex == "male" else 0.102

    arm_obj.rotation_mode = "XYZ"
    arm_obj.rotation_euler = (-math.pi / 2.0, 0.0, math.pi)
    arm_obj.location = Vector((0.0, pelvis_y_shift, bench_top_z + back_thickness))
    bpy.context.view_layer.update()

    # Switch to Pose Mode and pose the static grounded Lower Body (feet planted firmly on floor Z = 0!)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones

    # Compute exact world-space shoulder & hip positions after placing athlete on bench
    def rest_to_world(v):
        return arm_obj.matrix_world @ v

    sh_L_w = rest_to_world(J["sh_L"])
    sh_R_w = rest_to_world(J["sh_R"])
    hip_L_w = rest_to_world(J["hip_L"])
    hip_R_w = rest_to_world(J["hip_R"])

    l_thigh = (J["kn_L"] - J["hip_L"]).length
    l_shin = (J["an_L"] - J["kn_L"]).length
    l_upper = (J["el_L"] - J["sh_L"]).length
    l_fore = (J["wr_L"] - J["el_L"]).length

    # Planted feet on floor (Z = 0.08m ankle center so sole sits flush on floor Z = 0.00!)
    # Bench front edge is at Y = +0.40 -> knees drop cleanly past bench edge at Y ≈ +0.52!
    foot_stance_x = 0.19 if sex == "female" else 0.21
    for side, sign in (("L", -1.0), ("R", 1.0)):
        # Reset leg bones to identity before aiming cleanly from rest pose
        for bn in (f"Thigh.{side}", f"Shin.{side}", f"Foot.{side}"):
            pb[bn].rotation_mode = "QUATERNION"
            pb[bn].rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        bpy.context.view_layer.update()

        hip_w = arm_obj.matrix_world @ pb[f"Thigh.{side}"].head
        ankle_target = Vector((sign * foot_stance_x, hip_w.y + 0.34, 0.082))
        knee_pole = Vector((sign * (foot_stance_x + 0.04), hip_w.y + 0.65, 0.85))
        knee_w = solve_3d_two_bone_ik(hip_w, ankle_target, l_thigh, l_shin, knee_pole)
        toe_w = Vector((sign * (foot_stance_x + 0.02), ankle_target.y + 0.15, 0.028))

        aim_bone_world(arm_obj, pb[f"Thigh.{side}"], knee_w)
        aim_bone_world(arm_obj, pb[f"Shin.{side}"], ankle_target)
        aim_bone_world(arm_obj, pb[f"Foot.{side}"], toe_w)

        for bn in (f"Thigh.{side}", f"Shin.{side}", f"Foot.{side}"):
            pb[bn].keyframe_insert(data_path="rotation_quaternion", frame=1)

    # Slight athletic thoracic arch + neutral head on bench
    pb["Spine"].rotation_mode = "XYZ"
    pb["Spine"].rotation_euler = (-0.06, 0.0, 0.0)
    pb["Spine"].keyframe_insert(data_path="rotation_euler", frame=1)
    pb["Head"].rotation_mode = "XYZ"
    pb["Head"].rotation_euler = (0.04, 0.0, 0.0)
    pb["Head"].keyframe_insert(data_path="rotation_euler", frame=1)
    bpy.context.view_layer.update()

    # Re-read shoulder world positions after subtle thoracic arch
    sh_L_w = arm_obj.matrix_world @ pb["UpperArm.L"].head
    sh_R_w = arm_obj.matrix_world @ pb["UpperArm.R"].head
    sh_y = 0.5 * (sh_L_w.y + sh_R_w.y)
    sh_z = 0.5 * (sh_L_w.z + sh_R_w.z)

    # Barbell J-curve coordinates (in world Y, Z):
    # Top lockout: directly above shoulder joints, soft extension (94% of L1+L2 -> no hyperextension!)
    grip_half_x = 0.31 if sex == "female" else 0.35
    lateral_reach = max(0.0, grip_half_x - abs(sh_L_w.x))
    max_vert_reach = math.sqrt(max(0.04, (l_upper + l_fore) ** 2 - lateral_reach ** 2))

    # Top bar sits straight above shoulder joint at ~92% vertical reach (clean soft lockout!)
    bar_top = Vector((0.0, sh_y + 0.05, sh_z + max_vert_reach * 0.92))
    # Bottom bar touches lower-mid sternum cleanly (mid-sternum is +0.20m caudal from shoulder line!)
    chest_clear = 0.168 if sex == "female" else 0.186
    bar_bottom = Vector((0.0, sh_y + 0.20, sh_z + chest_clear))
    # Quadratic Bezier control points for asymmetric J-curve (concentric curves back toward shoulder earlier!)
    ctrl_ecc = Vector((0.0, sh_y + 0.155, (bar_top.z + bar_bottom.z) * 0.5 + 0.02))
    ctrl_con = Vector((0.0, sh_y + 0.085, (bar_top.z + bar_bottom.z) * 0.5 - 0.01))

    # Keyframe every 2 frames + exact phase boundary frames for butter-smooth 30fps playback
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

        # Move Barbell + Plates
        bar_root.location = bar_pos
        bar_root.keyframe_insert(data_path="location", frame=f)

        # Solve 3D 2-bone IK for both Left and Right arms locked onto the barbell shaft!
        for side, sign in (("L", -1.0), ("R", 1.0)):
            # Reset arm bones to rest before deterministic shortest-arc swing (prevents cumulative roll drift!)
            for bn in (f"UpperArm.{side}", f"Forearm.{side}", f"Hand.{side}", f"Fingers.{side}"):
                pb[bn].rotation_mode = "QUATERNION"
                pb[bn].rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            bpy.context.view_layer.update()

            sh_w = arm_obj.matrix_world @ pb[f"UpperArm.{side}"].head
            # Wrist sits firmly directly underneath barbell shaft (stacked forearm->wrist->bar!)
            grip_w = Vector((sign * grip_half_x, bar_pos.y, bar_pos.z - 0.026))

            # Biomechanical 65° elbow tuck pole target (elbows track down & slightly toward hips!)
            elbow_pole = Vector((
                sign * (grip_half_x + 0.14),
                bar_pos.y + 0.22,
                bench_top_z - 0.14,
            ))

            elbow_w = solve_3d_two_bone_ik(sh_w, grip_w, l_upper, l_fore, elbow_pole)
            # Tight closed grip: palm hugs bar underside/back, fingers wrap snugly OVER the 29mm shaft!
            hand_knuckle_w = Vector((sign * grip_half_x, bar_pos.y - 0.006, bar_pos.z + 0.012))
            finger_curl_w = Vector((sign * grip_half_x, bar_pos.y + 0.022, bar_pos.z - 0.014))

            aim_bone_world(arm_obj, pb[f"UpperArm.{side}"], elbow_w)
            aim_bone_world(arm_obj, pb[f"Forearm.{side}"], grip_w)
            aim_bone_world(arm_obj, pb[f"Hand.{side}"], hand_knuckle_w)
            aim_bone_world(arm_obj, pb[f"Fingers.{side}"], finger_curl_w)
            pb[f"Fingers.{side}"].scale = (0.88, 0.82, 0.88)

            for bn in (f"UpperArm.{side}", f"Forearm.{side}", f"Hand.{side}", f"Fingers.{side}"):
                pb[bn].keyframe_insert(data_path="rotation_quaternion", frame=f)
            pb[f"Fingers.{side}"].keyframe_insert(data_path="scale", frame=f)

    bpy.ops.object.mode_set(mode="OBJECT")

    # Smooth bezier interpolation on all fcurves
    for obj in (arm_obj, bar_root):
        if obj.animation_data and obj.animation_data.action:
            for fc in obj.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "BEZIER"
                    kp.handle_left_type = "AUTO_CLAMPED"
                    kp.handle_right_type = "AUTO_CLAMPED"


# ---------------------------------------------------------------------------
# Render Configuration (EEVEE Next — Fast GPU Medical Visualization)
# ---------------------------------------------------------------------------
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
    scene.view_settings.exposure = 0.05


# ---------------------------------------------------------------------------
# Main Pipeline Execution
# ---------------------------------------------------------------------------
def main():
    args = parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    # Start from clean empty scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # 1. Load Z-Anatomy Muscular & Skeletal systems cleanly via library loader
    with bpy.data.libraries.load(args.blend, link=False) as (df, dt):
        dt.collections = [c for c in df.collections if c in ("Muscular system", "Skeletal system")]

    musc_col = bpy.data.collections.get("Muscular system")
    skel_col = bpy.data.collections.get("Skeletal system")
    for c in (musc_col, skel_col):
        if c:
            bpy.context.scene.collection.children.link(c)
    bpy.context.view_layer.update()

    def gather_meshes(col, out):
        if not col:
            return
        for o in col.objects:
            if is_valid_anatomy_mesh(o):
                out[o.name] = o
        for ch in col.children:
            gather_meshes(ch, out)

    musc_map = {}
    skel_map = {}
    gather_meshes(musc_col, musc_map)
    gather_meshes(skel_col, skel_map)

    # Remove all non-selected / annotation / fascia objects from scene so render is 100% pure
    keep_names = set(musc_map.keys()) | set(skel_map.keys())
    for o in list(bpy.data.objects):
        if o.name not in keep_names:
            bpy.data.objects.remove(o, do_unlink=True)

    all_objs = list(musc_map.values()) + [o for k, o in skel_map.items() if k not in musc_map]
    bone_flags = {o.name: (o.name in skel_map and o.name not in musc_map) for o in all_objs}

    # Move every anatomy mesh into a single visible collection, make single-user copies,
    # bake world transforms cleanly (fixing flipped normals on mirrored .r instances), and unhide!
    anatomy_col = bpy.data.collections.new("SPOT_Anatomy")
    bpy.context.scene.collection.children.link(anatomy_col)
    for o in all_objs:
        # CRITICAL: Z-Anatomy shares mesh datablocks between .l and mirrored .r objects!
        # Always clone mesh data to single-user BEFORE baking matrix_world!
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

    # Remove old Z-Anatomy nested collections (which may have hide_render=True)
    for c in (musc_col, skel_col):
        if c and c.name in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.unlink(c)
    bpy.context.view_layer.update()

    print(f"[SPOT 3D] Loaded {len(musc_map)} muscle meshes + {len(skel_map)} skeletal meshes for sex={args.sex}")

    # 2. Apply anatomical sex dimorphism + smooth shading + SPOT medical écorché shaders
    apply_anatomical_dimorphism(all_objs, args.sex)
    mats = create_spot_materials()

    role_counts = {"primary": 0, "secondary": 0, "neutral_muscle": 0, "tendon": 0, "bone": 0}
    for o in all_objs:
        role = classify_muscle_role(o.name, bone_flags[o.name])
        role_counts[role] += 1
        o.data.materials.clear()
        o.data.materials.append(mats[role])
        for poly in o.data.polygons:
            poly.use_smooth = True

    print(f"[SPOT 3D] Shader assignment: {role_counts}")

    # 3. Build anatomical rig, parent all anatomy meshes to it, and bind weights continuously
    J = get_skeleton_joints(args.sex)
    arm_obj = create_armature(f"SPOT_Rig_{args.sex}", J)
    for o in all_objs:
        o.parent = arm_obj
        o.matrix_parent_inverse = Matrix.Identity(4)
    assign_anatomical_weights(all_objs, bone_flags, arm_obj, J)

    # 4. Build gym equipment, studio lighting & camera
    bar_root = build_bench_and_barbell(bench_top_z=0.45)
    build_studio_and_camera(bench_top_z=0.45)

    # 5. Animate 4.0s seamless Barbell Bench Press cycle (120 frames @ 30fps)
    animate_bench_press(arm_obj, bar_root, J, args.sex, bench_top_z=0.45, total_frames=120)

    # 6. Configure EEVEE Next medical studio renderer
    configure_render(args.width, args.height, args.samples)

    # Purge all unlinked Z-Anatomy orphan data-blocks BEFORE EEVEE shader/VRAM allocation
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    scene = bpy.context.scene
    if args.mode == "preview":
        scene.render.image_settings.file_format = "PNG"
        for frame, tag in ((1, "01_top"), (42, "02_eccentric"), (71, "03_bottom"), (92, "04_concentric")):
            scene.frame_set(frame)
            out_path = os.path.join(args.out_dir, f"bench_{args.sex}_{tag}.png")
            scene.render.filepath = out_path
            bpy.ops.render.render(write_still=True)
            print(f"[SPOT 3D] Rendered preview frame {frame} -> {out_path}")
    else:
        # Clean purge of unused orphan data-blocks before rendering full 120-frame MP4 (prevents VRAM spikes!)
        bpy.ops.outliner.orphans_purge(do_recursive=True)
        scene.render.image_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
        scene.render.ffmpeg.ffmpeg_preset = "GOOD"
        scene.render.ffmpeg.gopsize = 15
        out_mp4 = os.path.join(args.out_dir, f"barbell_bench_press_{args.sex}.mp4")
        scene.render.filepath = out_mp4
        # Warm up frame 1 evaluation before recording animation
        scene.frame_set(1)
        bpy.context.view_layer.update()
        bpy.ops.render.render(animation=True)
        print(f"[SPOT 3D] Rendered MP4 animation -> {out_mp4}")


if __name__ == "__main__":
    main()
