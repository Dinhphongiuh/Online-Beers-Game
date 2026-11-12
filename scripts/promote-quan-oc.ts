/**
 * Promote the Dev Mode "Quán Ốc Bờ Sông" map (and its ride) to the official game:
 *
 *   yarn promote:quan-oc        (or: npx tsx scripts/promote-quan-oc.ts)
 *
 * Copies the map's modules into src/official/quanOcBoSong/ as a frozen snapshot, used
 * when a table picks the "Quán Ốc Bờ Sông" map (theme `quan_oc`): the surroundings of
 * the table scene and the rides to / from the quán. Imports between copied modules stay
 * inside the snapshot; shared game modules (models, food, breathalyzer…) point back to
 * src/game. The game renders with WebGL, so `three/webgpu` imports become `three`.
 * Dev Mode keeps using the originals: developing there never changes the official map
 * until this script is run again.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'src/official/quanOcBoSong');

/** Original file (repo-relative) → snapshot file (relative to `target`). */
const FILES: Record<string, string> = {
  'src/game/riversideScenery.ts': 'game/riversideScenery.ts',
  'src/game/quanOcProps.ts': 'game/quanOcProps.ts',
  'src/game/quanOcInterior.ts': 'game/quanOcInterior.ts',
  'src/game/quanOcParking.ts': 'game/quanOcParking.ts',
  'src/game/playerController.ts': 'game/playerController.ts',
  'src/game/vrmCharacter.ts': 'game/vrmCharacter.ts',
  'src/game/vrmOutfit.ts': 'game/vrmOutfit.ts',
  'src/game/rideLab/bikePhysics.ts': 'game/rideLab/bikePhysics.ts',
  'src/game/rideLab/route.ts': 'game/rideLab/route.ts',
  'src/game/rideLab/rideModels.ts': 'game/rideLab/rideModels.ts',
  'src/game/rideLab/rideWorld.ts': 'game/rideLab/rideWorld.ts',
  // Only the RideView part (3D + HUD); the Ride Lab panel stays in Dev Mode.
  'src/dev/RideLab.tsx': 'ui/RideView.tsx',
};

const stamp = new Date().toISOString().slice(0, 10);
const header = (source: string) =>
  `// ⚠️ FROZEN COPY of ${source} for the official "Quán Ốc Bờ Sông" map (promoted ${stamp}).\n` +
  `// Develop in the original (Dev Mode) and run \`yarn promote:quan-oc\` to update this copy;\n` +
  `// edit here only for urgent production fixes (they are overwritten by the next promote).\n`;

const resolveSource = (fromFile: string, spec: string) => {
  const base = path.resolve(path.dirname(path.join(root, fromFile)), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return path.relative(root, candidate);
  }
  throw new Error(`Cannot resolve ${spec} from ${fromFile}`);
};

const relativeImport = (fromAbs: string, toAbs: string) => {
  let rel = path.relative(path.dirname(fromAbs), toAbs).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
};

// Only generated files are replaced; the hand-written glue (tableEnvironment.ts, QuanOcCommute.tsx) is kept.
rmSync(path.join(target, 'game'), { recursive: true, force: true });
rmSync(path.join(target, 'ui', 'RideView.tsx'), { force: true });
for (const [source, dest] of Object.entries(FILES)) {
  let code = readFileSync(path.join(root, source), 'utf8');
  if (source === 'src/dev/RideLab.tsx') {
    const cut = code.indexOf('// ---------------------------------------------------------------- lab');
    if (cut < 0) throw new Error('RideLab.tsx: lab section marker not found');
    code = code.slice(0, cut).trimEnd() + '\n';
  }
  // The official game renders with WebGLRenderer.
  code = code.replace(/from\s+(['"])three\/webgpu\1/g, "from 'three'");
  const destAbs = path.join(target, dest);
  code = code.replace(/(from\s+|import\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (match, prefix: string, quote: string, spec: string) => {
    const original = resolveSource(source, spec);
    const copied = FILES[original];
    const to = copied ? path.join(target, copied) : path.join(root, original);
    return `${prefix}${quote}${relativeImport(destAbs, to)}${quote}`;
  });
  mkdirSync(path.dirname(destAbs), { recursive: true });
  writeFileSync(destAbs, header(source) + code);
  console.log(`  ${source}  →  ${path.relative(root, destAbs)}`);
}
writeFileSync(
  path.join(target, 'README.md'),
  `# Quán Ốc Bờ Sông — official snapshot\n\nFrozen copy of the Dev Mode map, promoted ${stamp} by \`scripts/promote-quan-oc.ts\`.\n\n` +
    `- Develop in the originals (Dev Mode → *Quán Ốc Bờ Sông*, *Ride Lab*).\n` +
    `- When the dev version is ready for players: \`yarn promote:quan-oc\`, check the official mode, commit.\n` +
    `- Hand-written glue (not generated, kept as is): \`tableEnvironment.ts\` (surroundings for the table scene) and \`QuanOcCommute.tsx\` (rides at the start / end of a night).\n`
);
console.log(`Snapshot written to ${path.relative(root, target)}`);
