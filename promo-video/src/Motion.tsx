import React from 'react';
import {AbsoluteFill,Img,interpolate,spring,staticFile,useCurrentFrame} from 'remotion';
export const ease=(t:number)=>1-Math.pow(1-Math.max(0,Math.min(1,t)),4);
export const range=(f:number,a:number,b:number,x=0,y=1)=>interpolate(f,[a,b],[x,y],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
export const enter=(f:number,delay=0)=>spring({frame:f-delay,fps:30,config:{damping:24,stiffness:100,mass:1.1}});
export const A:React.FC<{children:React.ReactNode;delay?:number;x?:number;y?:number;style?:React.CSSProperties}> = ({children,delay=0,x=0,y=40,style={}})=>{
 const f=useCurrentFrame(),p=enter(f,delay);
 return <div style={{opacity:range(f,delay,delay+14),transform:`translate(${x*(1-p)}px,${y*(1-p)}px)`,...style}}>{children}</div>;
};
export const Mask:React.FC<{children:React.ReactNode;delay?:number;style?:React.CSSProperties}>=({children,delay=0,style={}})=>{
 const f=useCurrentFrame(),p=ease((f-delay)/28);
 return <div style={{overflow:'hidden',paddingBottom:9,...style}}><div style={{transform:`translateY(${115*(1-p)}%)`}}>{children}</div></div>;
};
export const Logo:React.FC<{size?:number;progress?:number;dark?:boolean}>=({size=100,progress=1,dark=false})=><svg width={size} height={size} viewBox="0 0 100 100" fill="none">
 <rect x="1" y="1" width="98" height="98" rx="27" fill={dark?'#183d2d':'#d9f9df'} stroke={dark?'#62b48a':'#c3efd1'} />
 <g transform="translate(18 18) scale(2.67)" stroke={dark?'#b0f3c4':'#12382a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="150" strokeDashoffset={150*(1-progress)}>
 <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>
 <path d="m2.5 21.5 1.4-1.4m16.2-16.2 1.4-1.4M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829zm4.257-7.085 4.8-4.8"/>
 </g></svg>;
export const Backdrop:React.FC<{light?:boolean}>=({light=false})=>{
 const f=useCurrentFrame();return <AbsoluteFill style={{background:light?'#eaf2e9':'#061b13'}}>
 <AbsoluteFill style={{background:light?'radial-gradient(ellipse at 75% 20%,#ffffff,transparent 70%)':`radial-gradient(ellipse at ${60+Math.sin(f/170)*18}% 65%,#1c614039,transparent 65%)`}}/>
 {!light&&<><div style={{position:'absolute',left:-100,top:100,width:1250,height:1250,border:'1px solid #6392761b',borderRadius:'50%',transform:`scale(${1+f/12000})`}}/><div style={{position:'absolute',left:700,top:-500,width:1250,height:1250,border:'1px solid #63927616',borderRadius:'50%'}}/></>}
 </AbsoluteFill>;
};
export const Chapter:React.FC<{n:string;label:string}>=({n,label})=><div className="chapter"><span className="brand-small"><Logo size={32}/>FitZone<span style={{color:'#66d493'}}>.</span></span><span>{n} / {label}</span></div>;
export const Capture:React.FC<{name:string;style?:React.CSSProperties}>=({name,style={}})=><Img className="ui-img" src={staticFile(`captures/${name}.png`)} style={style}/>;
export const Frame:React.FC<{children:React.ReactNode;style?:React.CSSProperties;title?:string}>=({children,style={},title='FitZone · Membership management'})=><div className="ui-frame" style={style}><div className="ui-bar"><i/><i/><i/><span>{title}</span></div>{children}</div>;
export const Pointer:React.FC<{x:number;y:number;click?:number}>=({x,y,click=0})=><div style={{position:'absolute',left:x,top:y,zIndex:8,transform:`scale(${1-click*.15})`,filter:'drop-shadow(0 4px 5px #0005)'}}><svg width="34" height="40" viewBox="0 0 28 34"><path d="M2 2 23 20 14 21 10 30Z" fill="#fff" stroke="#123f2b" strokeWidth="2"/></svg>{click>0&&<div style={{position:'absolute',width:65,height:65,border:'2px solid #81dca5',borderRadius:'50%',left:-27,top:-27,opacity:click,transform:`scale(${2-click})`}}/>}</div>;
export const Phone:React.FC<{children:React.ReactNode;width?:number;height?:number;style?:React.CSSProperties}>=({children,width=350,height=700,style={}})=><div className="device" style={{width,height,position:'relative',...style}}><div className="device-notch"/>{children}</div>;
export const Wipe:React.FC<{duration:number;kind?:'iris'|'line'|'shutter'}>=({duration,kind='line'})=>{
 const f=useCurrentFrame(),p=range(f,duration-14,duration);if(!p)return null;
 if(kind==='iris')return <AbsoluteFill style={{background:'#b2f5c4',clipPath:`circle(${p*150}% at 85% 50%)`,opacity:p>.9?1:.9}}/>;
 return <AbsoluteFill style={{background:kind==='shutter'?'#eaf2e9':'#0b3824',transform:`translateX(${(1-ease(p))*110}%)`,borderLeft:'3px solid #b2f5c4'}}/>;
};
