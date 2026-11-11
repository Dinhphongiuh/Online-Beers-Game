# Human character assets

The body, morph targets, skin details, hair styles, clothing meshes, and joint-offset data come from the generated `output/` assets in [CharacterCreator](https://github.com/kblood/CharacterCreator), built from MakeHuman/MPFB assets.

The source project marks its generated `output/*.glb` and `output/*.json` files as CC0-1.0. The corresponding per-asset license record is retained in `asset_licenses.json`. The CharacterCreator application code is GPL-3.0-or-later and is not bundled or used by this game.

The GLB files in `optimized/` were processed with glTF-Transform using Meshopt geometry compression and WebP texture compression. They remain derivatives of the CC0 output assets.
