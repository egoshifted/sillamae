import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {sillamae} from '../../city/sillamae/index.ts';
import type {WorldData} from '../../engine/data.ts';
import {localDirectory, option, repo, writeNew} from './local.ts';

export function createDraft(root: string, world: WorldData, id: string, slug: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(slug) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(slug)) throw Error('Use a lowercase building directory name');
  const building = world.buildings.find(b => b.id === id);
  if (!building?.heightRange) throw Error('Building ID or height range missing; run npm run data first');
  const directory = path.join(root, 'src/city/sillamae', slug);
  if (fs.existsSync(directory)) throw Error('Building directory already exists; existing work is never overwritten');
  const idText = JSON.stringify(id);
  const files: Record<string, string> = {
    'design.ts': `import type {MassingDesign} from '../../../studio/assembly/massing.ts';\n\nexport const design: MassingDesign = ${JSON.stringify({footprint: building.g, height: building.h, datum: building.heightRange[0] + world.base}, null, 2)};\n`,
    'model.ts': `import {createMassingStudy} from '../../../studio/assembly/massing.ts';\nimport type {OverrideContext} from '../../../engine/types.ts';\nimport type {StudyModel} from '../../../studio/types.ts';\nimport {design} from './design.ts';\n\nexport function createBuilding(context: OverrideContext): StudyModel {\n  return createMassingStudy(context, design);\n}\n`,
    'study.ts': `import {createBuilding} from './model.ts';\nimport type {StudyDefinition} from '../../../studio/types.ts';\n\nexport const study: StudyDefinition = {id: ${idText}, stages: {draft: {label: 'Working draft', build: createBuilding}}};\n`,
    'index.ts': `import {createBuilding} from './model.ts';\nimport type {BuildingOverride} from '../../../engine/types.ts';\n\nexport const refined: BuildingOverride = {\n  id: ${idText},\n  build(context) {\n    const model = createBuilding(context);\n    context.scene.add(model.root);\n    model.root.userData.dispose = model.dispose;\n    return {root: model.root, groundPatches: [], ready: model.ready, setTextures: on => model.setTextures?.(on)};\n  },\n};\n`,
  };
  fs.mkdirSync(directory);
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content, {flag: 'wx'});
  return {directory, files: Object.keys(files), id, name: building.name, basis: 'Imported footprint and approximate envelope only; no architectural approval', published: false};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = localDirectory(option('out', true)!);
  if (fs.readdirSync(out).length) throw Error('Use a new empty local record directory');
  const world: WorldData = JSON.parse(fs.readFileSync(path.join(repo, 'public/data/world.json'), 'utf8'));
  const id = option('id', true)!, slug = option('slug', true)!;
  const existing = fs.readdirSync(path.join(repo, 'src/city/sillamae')).filter(name => fs.existsSync(path.join(repo, 'src/city/sillamae', name, 'study.ts')));
  if (sillamae.overrides.some(o => o.id === id)) throw Error('This building already has a production model; edit its existing source');
  for (const name of existing) {
    const {study} = await import(pathToFileURL(path.join(repo, 'src/city/sillamae', name, 'study.ts')).href);
    if (study.id === id) throw Error('A study already exists for this ID');
  }
  const result = createDraft(repo, world, id, slug);
  writeNew(path.join(out, 'starting-building.json'), {created: new Date().toISOString(), ...result, building: world.buildings.find(b => b.id === id)});
  fs.copyFileSync(path.join(repo, 'src/studio/templates/building-record.md'), path.join(out, 'building-record.md'), fs.constants.COPYFILE_EXCL);
  console.log(JSON.stringify(result, null, 2) + '\nSelect this ID and Working draft in studio. Production registration is a separate reviewed step.');
}
