"""Pin the existing browser engine dependencies locally for reliable startup."""
from pathlib import Path
import io, json, tarfile, urllib.request

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = {
    'three': ('0.180.0', 'three'),
    '@recast-navigation/core': ('0.43.1', 'recast-core'),
    '@recast-navigation/generators': ('0.43.1', 'recast-generators'),
    '@recast-navigation/wasm': ('0.43.1', 'recast-wasm'),
}
THREE_FILES = {'build/three.module.js', 'build/three.core.js',
               'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/utils/SkeletonUtils.js',
               'examples/jsm/utils/BufferGeometryUtils.js'}

for name, (version, destination) in PACKAGES.items():
    metadata = json.load(urllib.request.urlopen(f'https://registry.npmjs.org/{name}/{version}'))
    blob = urllib.request.urlopen(metadata['dist']['tarball']).read()
    target = ROOT / 'vendor' / destination
    archive = tarfile.open(fileobj=io.BytesIO(blob), mode='r:gz')
    count = 0
    for member in archive.getmembers():
        relative = Path(member.name).relative_to('package')
        if not member.isfile() or '..' in relative.parts:
            continue
        keep = relative.name in ('LICENSE', 'LICENSE.md', 'package.json')
        keep |= (name == 'three' and relative.as_posix() in THREE_FILES)
        keep |= (name != 'three' and relative.parts[0] == 'dist' and relative.suffix in ('.js', '.mjs', '.wasm'))
        if keep:
            path = target / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(archive.extractfile(member).read())
            count += 1
    (target / 'SOURCE.json').write_text(json.dumps({'name': name, 'version': version, 'integrity': metadata['dist'].get('integrity'), 'url': metadata['dist']['tarball']}, indent=2))
    print(name, version, count, 'files', flush=True)
