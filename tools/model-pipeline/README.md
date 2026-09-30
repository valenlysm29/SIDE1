# NPC city asset build

The game does not load these build dependencies. Review outfits and licenses first, then create `assets/models/incoming/curated.json` as an array of records:

```json
[{"id":"unique-id","nombre":"Display name","genero":"mujer","rol":"cliente","archivo":"assets/models/incoming/quaternius/model.glb","altura":1.68,"licencia":"CC0","fuente":"Quaternius Universal Base Characters","url":"https://quaternius.com/packs/universalbasecharacters.html"}]
```

Include only real files that have been visually approved for city clothing. Paths must stay inside `assets/models/incoming`. Run `node tools/model-pipeline/build_city_npcs.cjs` to create 1024 px GLBs and `assets/models/npc/manifest.json`. Use `--low` for separate 512 px GLBs. FBX input needs `BLENDER_PATH` set to a Blender executable. Missing source, missing or unconfirmed license, duplicate IDs, and copies of the four selectable avatars fail the build. En3D remains blocked pending written license confirmation for its avatars and weights.

For Mixamo downloaded by the user, keep source files in the Git-ignored `assets/models/incoming/mixamo/` directory. After visual review, create `assets/models/incoming/mixamo/curated.json` with the same fields, setting `fuente` and `licencia` to `Mixamo`, `url` to `https://www.mixamo.com/`, and `animations` to the three animation-only FBX paths. Example:

```json
[{"id":"office_01","nombre":"Cliente de oficina","genero":"mujer","rol":"cliente","archivo":"assets/models/incoming/mixamo/office_01_skin.fbx","animations":{"idle":"assets/models/incoming/mixamo/office_01_idle.fbx","walk":"assets/models/incoming/mixamo/office_01_walk.fbx","run":"assets/models/incoming/mixamo/office_01_run.fbx"},"altura":1.68,"licencia":"Mixamo","fuente":"Mixamo","url":"https://www.mixamo.com/"}]
```

Set `BLENDER_PATH` to a locally installed Blender executable and run `node tools/model-pipeline/build_city_npcs.cjs --private-mixamo`. The Blender helper verifies an identical bone set, hierarchy, and rest pose for every clip before assigning animation tracks to the skinned character. It rejects incompatible rigs; it does not guess a retarget. The build then confirms a skin, vertex weights, and the three named clips in the exported GLB. It writes only to Git-ignored `assets/models/npc/private/`, including its own manifest. Do not commit, zip, or publish either private directory. The game's local runtime loads the private manifest when present; public delivery falls back to approved CC0 models or procedural NPCs.

The manifest describes actual clips in the source. It does not invent idle/walk/run animations. The build warns when the 1.5 MB per model or 25 MB total targets are missed; these limits require visual quality review before further reduction. The current runtime has no meshopt or Draco decoder, so this build keeps meshes directly loadable by its `GLTFLoader`.

Each accepted public source must already contain `idle`, `walk` and `run` clips to pass the delivery test. For private Mixamo, the helper combines the supplied animation FBXs only when the rest skeletons match exactly. This is not a verified cross-rig retarget pass. Visual inspection of skin deformation and foot contact remains necessary after conversion.
