/// <reference types="vite/client" />
import {sillamae} from '../city/sillamae/index.ts';
import type {StudyDefinition} from './types.ts';

// The project selects a city; generic study controls never encode building IDs.
export const city = sillamae;
const modules = import.meta.glob<{study: StudyDefinition}>('../city/sillamae/*/study.ts', {eager: true});
export const definitions = Object.values(modules).map(module => module.study);
if (new Set(definitions.map(s => s.id)).size !== definitions.length) throw Error('Duplicate studio building ID');
