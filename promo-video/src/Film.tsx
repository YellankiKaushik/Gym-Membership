import React from 'react';
import {AbsoluteFill,Audio,staticFile,useVideoConfig} from 'remotion';
import {PremiumHero} from './Premium';
import {Vertical} from './Vertical';
import audioConfig from '../audio-config.json';
export type FilmProps={music:boolean;sfx:boolean;voiceover:string|null};
export const Film:React.FC<FilmProps>=({music,sfx,voiceover})=>{
 const {width,height}=useVideoConfig();
 const vertical=height>width;
 return <AbsoluteFill className="film">
 {vertical?<Vertical/>:<PremiumHero/>}
 {music&&<Audio src={staticFile('audio/'+(vertical?'vertical-music':'music')+'.wav')} volume={voiceover?audioConfig.musicGainWithVoiceover:audioConfig.musicGain}/>}
 {sfx&&<Audio src={staticFile('audio/'+(vertical?'vertical-sfx':'sfx')+'.wav')} volume={audioConfig.sfxGain}/>}
 {voiceover&&<Audio src={staticFile(voiceover)} volume={audioConfig.voiceoverGain}/>}
 </AbsoluteFill>;
};
