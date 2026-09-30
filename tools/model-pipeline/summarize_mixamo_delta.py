"""Preserve the differential audit before updating mixamo_current_inventory.json."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
prior = {row['file']: row for row in json.loads((root / 'reports/mixamo_current_inventory.json').read_text(encoding='utf-8'))['files']}
details = {row['name']: row for path in (root / 'reports/mixamo_inventory').glob('*.json')
           for row in [json.loads(path.read_text(encoding='utf-8'))]}
clips = {row['clipFile']: row for row in json.loads((root / 'reports/mixamo_clip_compatibility.json').read_text(encoding='utf-8'))}

def kind(name, row):
    if row.get('skinnedMeshes'):
        return 'character With Skin'
    if not row.get('armatures') or not row.get('actions'):
        return 'unknown'
    if name.startswith('Slow Run'):
        return 'Run Without Skin'
    if name == 'Walking.fbx':
        return 'Walk Without Skin'
    if name.startswith('Strut Walking'):
        return 'other clip Without Skin'
    return 'unknown animation Without Skin'

def in_place(name):
    clip = clips.get(name)
    return (clip['motion']['horizontalDeltaMeters'] < .05) if clip and clip.get('motion') else None
changed, unchanged = [], []
for name, row in sorted(details.items()):
    previous = prior.get(name)
    if previous and previous['sha256'] == row['sha256']:
        unchanged.append(name)
        continue
    same_rest = [other for other, value in details.items()
                 if other != name and value.get('restHash') == row.get('restHash')
                 and value.get('vertices') == row.get('vertices')]
    changed.append({
        'file': name, 'change': 'modified' if previous else 'new',
        'sha256': row['sha256'], 'type': kind(name, row),
        'armatures': row['armatures'], 'meshes': row['meshes'], 'skinnedMeshes': row['skinnedMeshes'],
        'bones': row.get('bones'), 'armatureName': row.get('armatureName'),
        'rigFingerprint': {'boneNames': row.get('boneNamesHash'), 'hierarchy': row.get('hierarchyHash'),
                           'restPose': row.get('restHash')},
        'armatureTransform': row.get('armatureTransform'), 'rootBones': row.get('rootBones'),
        'actions': row['actions'], 'fps': row.get('fps'),
        'sameRestAndVertexCountAs': same_rest,
        'inPlace': in_place(name),
        'result': 'no separate Idle/Walk/Run animation; cannot complete NPC',
    })
out = root / 'reports/mixamo_delta_2026-09-29.json'
if not changed and out.exists():
    existing = json.loads(out.read_text(encoding='utf-8'))
    for item in existing['changed']:
        item['type'] = kind(item['file'], details[item['file']])
        item['inPlace'] = in_place(item['file'])
    out.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'0 changed since current inventory; enriched existing differential audit at {out}')
    raise SystemExit(0)
out.write_text(json.dumps({'previous': len(prior), 'current': len(details),
                           'new': sum(row['change'] == 'new' for row in changed),
                           'modified': sum(row['change'] == 'modified' for row in changed),
                           'unchanged': unchanged, 'changed': changed},
                          ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(changed)} changed, {len(unchanged)} unchanged')
