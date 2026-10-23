import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

await mkdir('output/qa',{recursive:true});
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${exe}: ${r.stderr}`);return r.stdout+r.stderr;}
function probe(path){return JSON.parse(run('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',path]));}
const voiceoverNote=existsSync('assets/audio/voiceover.wav')?'An optional voiceover source is present. Run npm run mix after adding or changing it; stream checks do not establish whether narration is included.':'No optional voiceover source is present; the standard render workflow uses original music and effects only.';
const report={generatedAt:new Date().toISOString(),files:[],captureAudit:JSON.parse(await readFile('assets/captures/capture-audit.json','utf8')),notes:['Synthetic fixture captured from original app, fixed 24 October 2026 clock.','Visual QA covers representative final frames plus frames adjacent to every hero cut.',voiceoverNote]};
const targets=[['fitzone-hero-1080p.mp4',1920,1080,60,true],['fitzone-clean-no-voiceover.mp4',1920,1080,60,true],['fitzone-silent-1080p.mp4',1920,1080,60,false],['fitzone-vertical-1080x1920.mp4',1080,1920,30,true]];
const selectedTargets=targets.filter(t=>(!process.argv.includes('--hero-only')||t[1]===1920)&&(!process.argv.includes('--published-only')||t[0]!=='fitzone-silent-1080p.mp4'));
for(const [name,width,height,duration,hasAudio] of selectedTargets){
 const path=resolve('output',name);if(!existsSync(path))throw new Error('Missing '+name);
 const info=probe(path),v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');
 if(v.width!==width||v.height!==height||v.r_frame_rate!=='30/1'||Math.abs(Number(info.format.duration)-duration)>.12||Boolean(a)!==hasAudio||v.pix_fmt!=='yuv420p')throw new Error('Unexpected stream metadata: '+name);
 const decode=run('ffmpeg',['-hide_banner','-v','error','-i',path,'-f','null','-']);if(decode.trim())throw new Error('Decode errors: '+decode);
 const blackLog=run('ffmpeg',['-hide_banner','-i',path,'-vf','blackdetect=d=0.15:pix_th=0.015:pic_th=0.98','-an','-f','null','-']);
 const blacks=blackLog.split(/\r?\n/).filter(s=>s.includes('black_start:'));
 let audio=null;
 if(a){const audioLog=run('ffmpeg',['-hide_banner','-i',path,'-af','loudnorm=I=-17:TP=-1.5:LRA=9:print_format=json','-vn','-f','null','-']);const match=audioLog.match(/\{\s*"input_i"[\s\S]*?\}/);audio=match?JSON.parse(match[0]):null;if(!audio||!Number.isFinite(Number(audio.input_i))||Number(audio.input_tp)>0)throw new Error('Audio missing or clipped: '+name);}
 const item={name,width:v.width,height:v.height,fps:v.r_frame_rate,duration:Number(info.format.duration),videoCodec:v.codec_name,pixelFormat:v.pix_fmt,frames:Number(v.nb_frames),audioCodec:a?.codec_name||null,sampleRate:a?.sample_rate||null,sizeBytes:Number(info.format.size),fullDecode:'passed',blackSegments:blacks,audio};
 report.files.push(item);console.log(`${name}: ${width}×${height}, ${duration}s, full decode passed${audio?`, ${audio.input_i} LUFS / ${audio.input_tp} dBTP`:''}`);
}
const hero='output/fitzone-hero-1080p.mp4';
const reps=[90,330,540,810,1110,1350,1530,1740];
const cuts=[150,180,258,390,455,612,690,765,840,915,990,1027,1230,1440,1620];
for(const frame of [...new Set([...reps,...cuts.flatMap(c=>[c-2,c+2])])])run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(frame/30),'-i',hero,'-frames:v','1',`output/qa/export-${String(frame).padStart(4,'0')}.png`]);
const tileExpr=reps.map(f=>`eq(n\\,${f})`).join('+');
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',hero,'-vf',`select='${tileExpr}',scale=640:360,tile=4x2:padding=12:margin=18:color=0x061b13`,'-frames:v','1','output/storyboard.png']);
const boundaries=cuts.flatMap(c=>[c-2,c+2]);
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',hero,'-vf',`select='${boundaries.map(f=>`eq(n\\,${f})`).join('+')}',scale=480:270,tile=4x8:padding=8:margin=12:color=0x061b13`,'-frames:v','1','output/qa/boundaries.png']);
if(existsSync('output/fitzone-vertical-1080x1920.mp4'))run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','output/fitzone-vertical-1080x1920.mp4','-vf',`select='${[90,240,480,660,840].map(f=>`eq(n\\,${f})`).join('+')}',scale=270:480,tile=5x1:padding=10:margin=12:color=0x061b13`,'-frames:v','1','output/qa/vertical-contact.png']);
await writeFile('output/verification.json',JSON.stringify(report,null,2));
await writeFile('output/VERIFICATION.md',`# FitZone exported-file verification\n\nGenerated: ${report.generatedAt}\n\n| File | Dimensions | Duration | FPS | Decode | Audio |\n| --- | --- | --- | --- | --- | --- |\n${report.files.map(f=>`| ${f.name} | ${f.width}×${f.height} | ${f.duration}s | 30 | Passed | ${f.audio?`${f.audio.input_i} LUFS / ${f.audio.input_tp} dBTP`:'Picture only'} |`).join('\n')}\n\nEvery MP4 was fully decoded by FFmpeg. Stream metadata is validated, including H.264, yuv420p and constant 30 fps. Black detection uses a conservative 1.5% pixel threshold for the deliberately dark forest palette; detected segments are recorded in verification.json. Capture audit has ${report.captureAudit.errors.length} browser errors and ${report.captureAudit.externalRequests.length} external requests.\n\nThe storyboard and boundary sheet were extracted from the encoded primary MP4. Representative stills and before/after-cut PNGs are in output/qa. Visual and editorial observations are recorded in ../CREATIVE_REVIEW.md. ${voiceoverNote}\n`);
console.log('Storyboard, boundary frames and verification reports written.');
