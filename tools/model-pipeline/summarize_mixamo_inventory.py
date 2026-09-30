"""Summarize inspected local Mixamo files without publishing any licensed asset."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DETAILS = ROOT / 'reports' / 'mixamo_inventory'
DEST = ROOT / 'reports' / 'mixamo_current_inventory.json'
CLIPS = {row['clipFile']: row for row in json.loads((ROOT / 'reports/mixamo_clip_compatibility.json').read_text(encoding='utf-8'))}

# Visual observations from tests/output/mixamo_curate and mixamo_delta. A candidate is not
# an approved NPC until all three separate clips and deformation pass inspection.
VISUAL = {
    'Dwarf Walk (1).fbx': ('candidate', 'mujer', 'blazer azul oscuro y pantalón beige', 'tienda'),
    'Dwarf Walk (2).fbx': ('candidate', 'mujer', 'casaca clara y pantalón oscuro', 'cliente'),
    'Dwarf Walk (3).fbx': ('candidate', 'hombre', 'sudadera gris con capucha y joggers', 'cliente'),
    'Dwarf Walk.fbx': ('candidate', 'hombre', 'blazer y jean', 'tienda'),
    'Reloading.fbx': ('discard', 'hombre', 'casco y atuendo de trabajo; acción de recarga', None),
    'Strut Walking (1).fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Strut Walking (2).fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Strut Walking (3).fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Strut Walking (4).fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Strut Walking (5).fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Strut Walking (6).fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Strut Walking (7).fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Strut Walking.fbx': ('clip_only', 'no aplica', 'sin malla; acción Strut Walking', None),
    'Slow Run (1).fbx': ('clip_only', 'no aplica', 'sin malla; Slow Run con root motion', None),
    'Slow Run.fbx': ('clip_only', 'no aplica', 'sin malla; Slow Run con root motion', None),
    'Walk (1).fbx': ('discard', 'mujer', 'atuendo estilizado y gafas grandes', None),
    'Walk (2).fbx': ('candidate', 'mujer', 'polo rayado y jean', 'cliente'),
    'Walk (3).fbx': ('discard', 'mujer', 'atuendo estilizado y gafas grandes', None),
    'Walk (4).fbx': ('candidate', 'mujer', 'sudadera y shorts casuales', 'cliente'),
    'Walk (5).fbx': ('candidate', 'mujer', 'casaca rosa ligera y leggings', 'cliente'),
    'Walk (6).fbx': ('candidate', 'mujer', 'traje azul de oficina', 'tienda'),
    'Walk.fbx': ('discard', 'hombre', 'uniforme deportivo blanco con shorts y medias largas', None),
    'Walking (1).fbx': ('candidate', 'hombre', 'camiseta roja y shorts de mezclilla', 'cliente'),
    'Walking (2).fbx': ('candidate', 'hombre', 'polo gris y jean', 'cliente'),
    'Walking (3).fbx': ('candidate', 'hombre', 'sudadera negra, gorra y audífonos urbanos', 'cliente'),
    'Walking (4).fbx': ('candidate', 'mujer', 'polo gris y jean', 'cliente'),
    'Walking (5).fbx': ('duplicate', 'mujer', 'polo gris y jean; mismo personaje que Walking (4)', None),
    'Walking (6).fbx': ('candidate', 'hombre', 'suéter azul oscuro y pantalón', 'cliente'),
    'Walking (7).fbx': ('duplicate', 'hombre', 'sudadera gris; mismo personaje que Dwarf Walk (3)', None),
    'Walking (8).fbx': ('duplicate', 'mujer', 'personaje estilizado; mismo que Walk (1)', None),
    'Walking 1).fbx': ('candidate', 'hombre', 'polo gris y shorts cargo', 'cliente'),
    'Walking 2).fbx': ('duplicate', 'mujer', 'traje azul; mismo personaje que Walk (6)', None),
    'Walking.fbx': ('clip_only', 'no aplica', 'sin malla; marcha Walking In Place', None),
    'Walking1.fbx': ('duplicate', 'hombre', 'uniforme deportivo blanco; mismo que Walk', None),
    'character.fbx': ('duplicate', 'hombre', 'camiseta roja y shorts; pose base de Walking (1)', None),
}

rows = []
for source in sorted((ROOT / 'assets/models/incoming/mixamo').glob('*.fbx')):
    technical = json.loads((DETAILS / (source.stem + '.json')).read_text(encoding='utf-8'))
    decision, presentation, clothing, role = VISUAL.get(source.name, ('unknown', 'no evaluado', 'no evaluada', None))
    parts = technical.get('boneNames', [])
    def has(name):
        return any(bone.split(':')[-1] == name for bone in parts)
    rows.append({
        'file': source.name, 'classification': ('A: personaje With Skin' if technical['skinnedMeshes'] else
                'D: Run Without Skin' if source.name.startswith('Slow Run') else
                'C: Walk Without Skin' if source.name == 'Walking.fbx' else
                'E: otro clip Without Skin' if technical['armatures'] == 1 and technical['actions'] else 'F: desconocido'),
        'actionAssessment': ('sin acción' if not technical['actions'] else
            'Run con root motion' if source.name.startswith('Slow Run') and not technical['meshes'] else
            'otro: Strut Walking In Place' if source.name.startswith('Strut') and not technical['meshes'] else
            'Walk In Place' if source.name == 'Walking.fbx' and not technical['meshes'] else
            'acción embebida Reloading' if source.name == 'Reloading.fbx' else
            'acción embebida; semántica indicada por nombre, no aprobada como clip separado'),
        'visualDecision': decision, 'visualPresentation': presentation, 'dominantClothing': clothing,
        'suggestedRole': role, 'sha256': technical['sha256'], 'bytes': technical['bytes'],
        'armatures': technical['armatures'], 'armatureName': technical.get('armatureName'),
        'meshes': technical['meshes'], 'skinnedMeshes': technical['skinnedMeshes'],
        'vertices': technical['vertices'], 'weightedVertices': technical.get('weightedVertices'),
        'boneCount': technical.get('bones'), 'rootBones': technical.get('rootBones'),
        'anatomy': {name: has(name) for name in ('Hips','Spine','Neck','Head','LeftArm','RightArm',
                    'LeftLeg','RightLeg','LeftFoot','RightFoot','LeftHandIndex1','RightHandIndex1')},
        'rigFingerprint': {'boneNamesSha256': technical.get('boneNamesHash'),
                           'hierarchySha256': technical.get('hierarchyHash'),
                           'restMatricesSha256': technical.get('restHash')},
        'actions': technical['actions'], 'fps': technical.get('fps'),
        'durationSeconds': technical.get('durationSeconds'),
        'meshDetails': technical.get('meshDetails'),
        'technicalErrors': technical['errors'],
        'clipMotion': CLIPS.get(source.name, {}).get('motion'),
        'rigMatches': CLIPS.get(source.name, {}).get('matches'),
        'inPlace': (CLIPS[source.name]['motion']['horizontalDeltaMeters'] < .05
                    if source.name in CLIPS and CLIPS[source.name]['motion'] else None),
        'pending': (['separate Idle Without Skin', 'separate Running Without Skin',
                    'rig/rest compatibility', 'In Place and deformation verification']
                    if technical['skinnedMeshes'] else []),
    })

DEST.write_text(json.dumps({'files': rows, 'separateClips': {'idle': [], 'walking': ['Walking.fbx'],
                            'running': ['Slow Run.fbx','Slow Run (1).fbx'],
                            'other': sorted(name for name in CLIPS if name.startswith('Strut Walking'))},
                            'approvedNpcCount': 0}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(rows)} FBX; {sum(row["visualDecision"] == "candidate" for row in rows)} visual candidates; 0 approved')
