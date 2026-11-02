import React from 'react';
import {Composition} from 'remotion';
import {Film, FilmProps} from './Film';
import './style.css';
export const Root: React.FC = () => <>
  <Composition id="FitZoneHero" component={Film} durationInFrames={1800} fps={30} width={1920} height={1080} defaultProps={{music:true,sfx:true,voiceover:null} satisfies FilmProps}/>
  <Composition id="FitZoneVertical" component={Film} durationInFrames={900} fps={30} width={1080} height={1920} defaultProps={{music:true,sfx:true,voiceover:null} satisfies FilmProps}/>
</>;
