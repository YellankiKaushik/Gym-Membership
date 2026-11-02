import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const config=JSON.parse(readFileSync(new URL('../audio-config.json',import.meta.url),'utf8'));
const jsx=(type,props)=>({type,props});
// Execute the actual compiled components with only Remotion's context/JSX boundary stubbed.
function loadComponent(file,dimensions={width:1920,height:1080},audio=config){
 const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const modules={react:{},
  'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
  remotion:{AbsoluteFill:'canvas',Audio:'audio',Composition:'composition',staticFile:p=>p,useVideoConfig:()=>dimensions},
  './Premium':{PremiumHero:'hero'},'./Vertical':{Vertical:'portrait'},
  '../audio-config.json':audio,'./Film':{Film:'film'},'./style.css':{}
 };
 const module={exports:{}};
 const require=name=>{assert.ok(name in modules,`Unexpected runtime import: ${name}`);return modules[name];};
 new Function('require','module','exports',code)(require,module,module.exports);
 return module.exports;
}

test('composition dimensions select both picture and audio despite a conflicting legacy prop',()=>{
 for(const [width,height,override,layout,prefix] of [[1920,1080,true,'hero',''],[1080,1920,false,'portrait','vertical-']]){
  const {Film}=loadComponent('Film.tsx',{width,height});
  const frame=Film({vertical:override,music:true,sfx:true,voiceover:null});
  assert.equal(frame.props.children[0].type,layout);
  assert.deepEqual(frame.props.children.filter(x=>x?.type==='audio').map(x=>x.props.src),[`audio/${prefix}music.wav`,`audio/${prefix}sfx.wav`]);
 }
});

test('Studio uses the same configured gains as the final mix, including voiceover ducking',()=>{
 const gains={...config,musicGain:.8,sfxGain:.7,voiceoverGain:.6,musicGainWithVoiceover:.42};
 const {Film}=loadComponent('Film.tsx',undefined,gains);
 for(const [voiceover,expected] of [[null,[.8,.7]],['audio/voiceover.wav',[.42,.7,.6]]]){
  const layers=Film({music:true,sfx:true,voiceover}).props.children.filter(x=>x?.type==='audio');
  assert.deepEqual(layers.map(x=>x.props.volume),expected);
 }
 assert.equal(config.musicGainWithVoiceover,.42);
});

test('independent music and effects switches remain available',()=>{
 const {Film}=loadComponent('Film.tsx');
 const layers=Film({music:false,sfx:false,voiceover:'audio/voiceover.wav'}).props.children.filter(x=>x?.type==='audio');
 assert.deepEqual(layers.map(x=>x.props.src),['audio/voiceover.wav']);
});

test('registered composition formats and timing remain unchanged without an overridable layout prop',()=>{
 const {Root}=loadComponent('Root.tsx');
 const compositions=Root().props.children.map(x=>x.props);
 assert.deepEqual(compositions.map(({id,width,height,fps,durationInFrames})=>({id,width,height,fps,durationInFrames})),[
  {id:'FitZoneHero',width:1920,height:1080,fps:30,durationInFrames:1800},
  {id:'FitZoneVertical',width:1080,height:1920,fps:30,durationInFrames:900}
 ]);
 assert.ok(compositions.every(c=>!('vertical' in c.defaultProps)));
});
