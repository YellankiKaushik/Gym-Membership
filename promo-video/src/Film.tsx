import React from 'react';
import {AbsoluteFill,Audio,staticFile} from 'remotion';
import {PremiumHero} from './Premium';
import {Vertical} from './Vertical';
export type FilmProps={vertical:boolean;music:boolean;sfx:boolean;voiceover:string|null};
export const Film:React.FC<FilmProps>=({vertical,music,sfx,voiceover})=><AbsoluteFill className="film">
 {vertical?<Vertical/>:<PremiumHero/>}
 {music&&<Audio src={staticFile('audio/'+(vertical?'vertical-music':'music')+'.wav')} volume={voiceover?0.48:1}/>}
 {sfx&&<Audio src={staticFile('audio/'+(vertical?'vertical-sfx':'sfx')+'.wav')} volume={1}/>}
 {voiceover&&<Audio src={staticFile(voiceover)} volume={1}/>}
</AbsoluteFill>;
