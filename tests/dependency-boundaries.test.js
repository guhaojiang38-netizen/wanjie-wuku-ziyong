import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as primitives from '../src/primitives.js';
import * as core from '../src/core.js';

test('core keeps the identical public helper implementations for existing consumers',()=>{
 for(const name of ['assert','clone','text','stable','hash']) assert.equal(core[name],primitives[name]);
});

test('configuration validators stay independent from the state/controller dependency graph',async()=>{
 const primitive=await readFile(new URL('../src/primitives.js',import.meta.url),'utf8');
 assert.doesNotMatch(primitive,/\bimport\s|\bfrom\s+['"]/);
 for(const file of ['adapters.js','management-profiles.js']){
  const source=await readFile(new URL('../src/'+file,import.meta.url),'utf8');
  const imports=[...source.matchAll(/from\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
  assert.ok(imports.every(s=>['./primitives.js','./management-profiles-data.js'].includes(s)),file+' may depend only on primitives and static data');
 }
});


test('persisted validators retain old public exports and share the same contract constants',async()=>{
 const leaf=await import('../src/state-validation.js');
 for(const [file,name] of [['specialized-records.js','validateSpecific'],['creation.js','validateCreations'],['terminal.js','validateTerminalState'],['creation-results.js','validateCreationProgress'],['terminal-results.js','validateTerminalProgress']]){
  const old=await import('../src/'+file);assert.equal(old[name],leaf[name],name);
 }
 for(const [file,name] of [['terminal.js','TERMINAL_KINDS'],['terminal-results.js','TERMINAL_PROGRESS'],['creation-results.js','CREATION_PROGRESS'],['core.js','ARCHIVE_TEXT_FORMAT']]){
  const old=await import('../src/'+file);assert.equal(old[name],leaf[name],name);
 }
});

test('reading core state cannot pull host, controllers or UI into its static dependency closure',async()=>{
 const visited=new Set();
 const forbidden=new Set(['host.js','mvu.js','creation.js','terminal.js','archives.js','specialized-records.js','creation-results.js','terminal-results.js','ui.js','model.js']);
 async function visit(url){
  if(visited.has(url.href))return;visited.add(url.href);
  const filename=url.pathname.split('/').at(-1);assert.ok(!forbidden.has(filename),'core must not load '+filename);
  const source=await readFile(url,'utf8');
  for(const m of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await visit(new URL(m[1],url));
 }
 await visit(new URL('../src/core.js',import.meta.url));
 const leaf=await readFile(new URL('../src/state-validation.js',import.meta.url),'utf8');
 const imports=[...leaf.matchAll(/from\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
 assert.deepEqual(imports,['./primitives.js']);
});


test('shared configuration, field projections and player guides preserve old public exports',async()=>{
 for(const [oldFile,newFile,names] of [
  ['creation.js','creation-config.js',['creationConfig']],
  ['specialized-records.js','specific-values.js',['specificRows','specificDiff']],
  ['player-home.js','player-guide.js',['normalizePlayerGuide','currentPlayerGuide']],
 ]){
  const old=await import('../src/'+oldFile),fresh=await import('../src/'+newFile);
  for(const name of names)assert.equal(old[name],fresh[name],name);
 }
});

test('all runtime static imports and reexports form an acyclic graph',async()=>{
 const root=new URL('../',import.meta.url),src=new URL('src/',root);
 const files=[new URL('index.js',root),...(await readdir(src)).filter(n=>n.endsWith('.js')).map(n=>new URL(n,src))];
 const graph=new Map();
 for(const url of files){
  const code=await readFile(url,'utf8');
  graph.set(url.href,[...code.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)].map(m=>new URL(m[1],url).href));
 }
 const visited=new Set(),active=[];
 function visit(node){
  assert.ok(!active.includes(node),'circular runtime dependency: '+[...active,node].map(s=>new URL(s).pathname.split('/').at(-1)).join(' -> '));
  if(visited.has(node))return;
  assert.ok(graph.has(node),'runtime import missing from graph: '+node);
  active.push(node);for(const next of graph.get(node))visit(next);active.pop();visited.add(node);
 }
 for(const node of graph.keys())visit(node);
});
