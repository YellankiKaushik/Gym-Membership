import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {Capture, Logo, Mask, Pointer, range} from './Motion';

// Every camera move has an arrival, an inspection interval, and a motivated exit.
const cam=(f:number,frames:number[],values:number[])=>interpolate(f,frames,values,{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.65,0,.25,1)});
const reveal=(f:number,a=0,b=18)=>range(f,a,b);
const font:React.CSSProperties={fontFamily:'Segoe UI,Arial,sans-serif',fontWeight:650,letterSpacing:'-.045em',lineHeight:1.06};
const ink='#17382a',mint='#b3edc5';

const Stage:React.FC=()=>{
 const f=useCurrentFrame();
 return <AbsoluteFill style={{background:'#061b13'}}>
  <AbsoluteFill style={{background:`radial-gradient(ellipse at ${72-f/75}% 70%,#1a51312b,transparent 68%)`}}/>
  <div style={{position:'absolute',left:90,right:90,top:1040,height:1,background:'#8dcaa31c'}}/>
 </AbsoluteFill>;
};
const Mark:React.FC<{light?:boolean}>=({light=false})=><div style={{position:'absolute',left:90,top:48,display:'flex',gap:12,alignItems:'center',color:light?ink:'#dff6e6',fontSize:25,fontWeight:650,letterSpacing:'-.03em'}}><Logo size={35}/>FitZone<span style={{color:'#75d397',marginLeft:-10}}>.</span></div>;
const Title:React.FC<{children:React.ReactNode;left?:number;top?:number;size?:number;color?:string;delay?:number}>=({children,left=100,top=135,size=84,color='#f0fcf3',delay=0})=><div style={{position:'absolute',left,top,color,...font,fontSize:size}}><Mask delay={delay}>{children}</Mask></div>;
const NativeWindow:React.FC<{children:React.ReactNode;style?:React.CSSProperties;dark?:boolean}>=({children,style={},dark=false})=><div style={{background:dark?'#13251f':'#f5f6f3',border:'1px solid #add6b83a',borderRadius:24,overflow:'hidden',boxShadow:'0 35px 90px #0005',...style}}>{children}</div>;
const Line:React.FC<{width?:number;style?:React.CSSProperties}>=({width=90,style={}})=><div style={{width,height:3,background:mint,...style}}/>;

const Opening:React.FC=()=>{
 const f=useCurrentFrame(),s=cam(f,[0,34,105,150],[1.14,1,.99,.92]);
 const lift=cam(f,[105,150],[0,-80]);
 return <AbsoluteFill>
  <div style={{position:'absolute',left:0,top:0,width:1920,height:1080,transform:`translateY(${lift}px) scale(${s})`}}>
   <div style={{position:'absolute',left:350,top:365,opacity:reveal(f,3,16)}}><Logo size={134} progress={range(f,0,28)}/></div>
   <div style={{position:'absolute',left:525,top:338,overflow:'hidden',width:1100,height:230}}><div style={{transform:`translateY(${cam(f,[0,28],[240,0])}px)`,fontFamily:'Bahnschrift,Arial,sans-serif',fontSize:191,fontWeight:650,letterSpacing:'.015em'}}>FITZONE<span style={{color:mint}}>.</span></div></div>
   <div style={{position:'absolute',left:530,top:590,width:900,overflow:'hidden'}}>
    <div style={{transform:`translateX(${cam(f,[22,50],[-900,0])}px)`}}><Line width={760}/></div>
    <div style={{marginTop:33,fontSize:39,letterSpacing:'-.025em',color:'#bfd9c8',opacity:reveal(f,35,52)}}>Smarter gym membership management.</div>
   </div>
  </div>
  <div style={{position:'absolute',left:100,top:890,color:'#94bea2',fontSize:21,letterSpacing:'.13em',opacity:reveal(f,60,78)*range(f,120,145,1,0)}}>STRENGTH. DISCIPLINE. CONSISTENCY.</div>
  {f>=122&&<div style={{position:'absolute',right:0,top:0,bottom:0,width:cam(f,[122,150],[0,265]),background:'#f5f6f3',borderLeft:'2px solid #89cc9f'}}/>}
 </AbsoluteFill>;
};

const MemberExperience:React.FC=()=>{
 const f=useCurrentFrame();
 const input=f<53?'lookup-empty':f<58?'lookup-type-1':f<63?'lookup-type-10':f<68?'lookup-type-104':'lookup-filled';
 const late=cam(f,[140,220],[0,1]);
 return <AbsoluteFill><Mark/>
  {f<30&&<div><Title top={125} size={82}>Membership details. One ID away.</Title>
   <NativeWindow style={{position:'absolute',left:100,top:300,width:1720,height:672,transform:`perspective(2000px) rotateY(${cam(f,[0,38],[-3,0])}deg)`}}><Capture name="lookup-hero"/></NativeWindow>
  </div>}
  {f>=30&&<>
   {f<108&&<><div style={{position:'absolute',left:0,right:0,top:145,textAlign:'center',...font,fontSize:70}}>One member ID.</div>
   <NativeWindow style={{position:'absolute',left:cam(f,[30,100],[490,465]),top:cam(f,[30,100],[300,285]),width:990}}>
    <Capture name={input}/>
    {f<108&&<Pointer x={cam(f,[42,75],[860,510])} y={cam(f,[42,75],[350,471])} click={f>=88&&f<103?Math.sin((f-88)/15*Math.PI):0}/>}
   </NativeWindow></>}
   {f>=108&&<><div style={{position:'absolute',left:cam(f,[108,150],[235,330]),top:cam(f,[108,150],[290,350]),width:cam(f,[108,150],[1450,1260]),transform:`perspective(2200px) rotateX(${cam(f,[108,150],[2,0])}deg)`}}>
    <NativeWindow><Capture name="lookup-result"/></NativeWindow>
    <div style={{position:'absolute',left:55,right:55,top:208,height:149,borderRadius:18,border:'2px solid #08745b',clipPath:`inset(0 ${(1-range(f,149,181))*100}% 0 0)`,opacity:range(f,213,235,1,0)}}/>
   </div>
   <div style={{position:'absolute',left:100,top:148,...font,fontSize:73}}>Ready for your next session.</div></>}
   <div style={{position:'absolute',left:335,top:950,fontSize:32,color:'#b4d7c0',transform:`translateX(${25*(1-late)}px)`,opacity:range(f,170,192)}}>Your plan. Your status. Back to training.</div>
  </>}
 </AbsoluteFill>;
};

const OwnerOverview:React.FC=()=>{
 const f=useCurrentFrame();
 const focus=f>=65&&f<222;
 const track=cam(f,[65,105,135,165,195,222],[0,0,-460,-460,-920,-920]);
 const focusLabel=f<105?'Every member.':f<165?'Every active membership.':'Renewals in focus.';
 return <AbsoluteFill><Mark/>
  {!focus?<>
   <Title top={130} size={80}>{f<222?'Your gym. One clear view.':'From overview to action.'}</Title>
   <NativeWindow style={{position:'absolute',left:100,top:290,width:1720,height:700,transform:`perspective(2200px) rotateX(${cam(f,[0,45],[3,0])}deg)`}}>
    {f<222?<Capture name="dashboard" style={{transform:`translateY(${cam(f,[0,60],[-30,-70])}px)`}}/>:<><Capture name="native-dashboard-heading"/><div style={{paddingTop:20}}><Capture name="members"/></div></>}
    {f>235&&<Pointer x={cam(f,[236,281],[1100,1600])} y={cam(f,[236,281],[240,70])} click={f>283&&f<298?Math.sin((f-283)/15*Math.PI):0}/>}
   </NativeWindow>
  </>:<>
   <div style={{position:'absolute',left:100,top:165,...font,fontSize:100}}>{focusLabel}</div>
   <div style={{position:'absolute',left:100,top:475,width:1720,height:385,overflow:'hidden',borderRadius:24}}>
    <div style={{width:2640,transform:`translateX(${track}px)`,position:'relative'}}><Capture name="summary" style={{width:2640}}/>
     <div style={{position:'absolute',left:f<105?0:f<165?665:1330,top:0,width:645,height:320,border:'3px solid #94d9ad',borderRadius:28}}/>
    </div>
   </div>
   <div style={{position:'absolute',left:105,top:910,display:'flex',gap:16}}>{['Members','Active','Expiring soon'].map((n,i)=><div key={n} style={{width:i===(f<105?0:f<165?1:2)?150:50,height:3,background:i===(f<105?0:f<165?1:2)?mint:'#345a41'}}/>)}</div>
  </>}
 </AbsoluteFill>;
};

const Workflow:React.FC=()=>{
 const f=useCurrentFrame(),beat=Math.min(3,Math.floor(f/75)),k=f%75;
 const names=[k<20?'add-name-0':k<30?'add-name-2':k<39?'add-name-4':'add-name-10',k<36?'edit':'edit-updated',k<35?'renew':'renew-selected'];
 const width=beat===1?520:610;
 const y=beat===1?145:155;
 const drift=cam(k,[0,24,62,75],[65,0,-10,-36]);
 return <AbsoluteFill>
  <AbsoluteFill style={{background:'#eaf0e8'}}/>
  <Mark light/>
  <div style={{position:'absolute',left:100,top:132,...font,fontSize:70,color:ink}}>Add. Manage. Renew.</div>
  {beat<3?<>
   <NativeWindow style={{position:'absolute',left:100,top:290,width:1720,height:670,opacity:.17}}><Capture name="members" style={{transform:`translateY(${-130-beat*40}px)`}}/></NativeWindow>
   {beat===0?<><div style={{position:'absolute',left:100,top:380,color:ink,...font,fontSize:106,width:750,transform:`translateY(${cam(k,[0,25],[25,0])}px)`}}>Welcome the next member.</div>
   <div style={{position:'absolute',left:100,top:780,color:'#536b5a',fontSize:25}}>01 / ADD MEMBER</div>
   <div style={{position:'absolute',left:1030,top:y,width,transform:`translateX(${drift}px)`,clipPath:`inset(0 0 ${Math.max(0,(1-range(k,0,12))*100)}% 0 round 22px)`}}>
    <NativeWindow><Capture name={names[beat]}/></NativeWindow>
    <Pointer x={cam(k,[0,24,52,75],[width*.85,width*.28,width*.3,width*.7])} y={beat===0?165:beat===1?cam(k,[0,30],[260,258]):cam(k,[0,30],[330,315])} click={k>30&&k<43?Math.sin((k-30)/13*Math.PI):0}/>
   </div>
   </>:<>
    <NativeWindow style={{position:'absolute',left:cam(k,[0,30],[330,300]),top:345,width:1320,height:515,background:'#fff',padding:'52px 60px',transform:`perspective(2300px) rotateY(${cam(k,[0,35],[3,0])}deg)`}}>
     <div style={{fontSize:39,color:ink,fontWeight:650,letterSpacing:'-.035em',marginBottom:30}}>{beat===1?'Edit Member':'Renew Membership'} <span style={{fontSize:23,fontWeight:400,marginLeft:25,color:'#647b68'}}>Ananya Rao · #1043</span></div>
     <Capture name={beat===1?(k<35?'edit-name':'edit-name-updated'):(k<35?'renew-plan-field':'renew-plan-selected')}/>
     {beat===1&&<Capture name="edit-save" style={{position:'absolute',right:60,bottom:36,width:440}}/>}
     {beat===2&&<p style={{marginTop:35,color:'#607665',fontSize:28}}>New start date: 28 Oct 2026</p>}
     <Pointer x={cam(k,[0,28,54,75],[1040,360,beat===1?1120:800,beat===1?1120:800])} y={cam(k,[0,28,54],[220,230,beat===1?445:230])} click={k>28&&k<40?Math.sin((k-28)/12*Math.PI):0}/>
    </NativeWindow>
   </>}
  </>:<>
   <div style={{position:'absolute',left:100,top:246,fontSize:31,color:'#58705f'}}>Find the right membership.</div>
   <NativeWindow style={{position:'absolute',left:100,top:345,width:1720,height:630,transform:`translateY(${cam(k,[0,30],[35,0])}px)`}}>
    <Capture name={k<15?'members':k<23?'search-A':k<32?'search-Ana':'search-Ananya'}/>
    <Pointer x={cam(k,[0,24],[1100,1450])} y={166} click={k>9&&k<21?Math.sin((k-9)/12*Math.PI):0}/>
   </NativeWindow>
  </>}
  <div style={{position:'absolute',left:100,right:100,bottom:41,height:2,background:'#b7c8b9'}}><div style={{width:`${(f+1)/300*100}%`,height:2,background:'#08745b'}}/></div>
 </AbsoluteFill>;
};

const ExpiryFocus:React.FC=()=>{
 const f=useCurrentFrame(),filtered=f>=37;
 const scale=cam(f,[64,112],[1,1.05]);
 const x=cam(f,[64,112],[0,-25]);
 const y=cam(f,[64,112,175,225],[0,-60,-140,-210]);
 return <AbsoluteFill><Mark/>
  <Title size={83} top={132}>Stay ahead of expiries.</Title>
  <div style={{position:'absolute',left:100,top:300,width:1720,height:650}}>
   <NativeWindow style={{height:650}}><div style={{position:'relative',width:1720,transform:`translate(${x}px,${y}px) scale(${scale})`,transformOrigin:'0 0'}}><Capture name={filtered?'expiring':'members'}/>
    {!filtered&&<Pointer x={cam(f,[0,30],[1430,320])} y={166} click={f>28&&f<40?Math.sin((f-28)/12*Math.PI):0}/>}
    {filtered&&<div style={{position:'absolute',left:892,top:cam(f,[65,112,142,177,207],[282,282,453,453,623]),width:275,height:116,borderLeft:'3px solid #bb913b',borderRight:'3px solid #bb913b',opacity:range(f,53,69)}}/>}
   </div></NativeWindow>
  </div>
  <div style={{position:'absolute',left:100,top:962,fontSize:26,color:'#b6d4bf',opacity:range(f,62,90)}}>Today through the next seven days.</div>
 </AbsoluteFill>;
};

const Sheet:React.FC<{phase:number}>=({phase})=>{
 const cols=['ID','Name','Phone','Age','Weight','Membership Plan','Start Date','End Date','Notified'];
 const rows=[['1048','Dev Malhotra','Hidden','27','68','3 Months','24 Aug 2026','24 Oct 2026','No'],['1043','Ananya Rao','Hidden','27','68','3 Months','24 Aug 2026','27 Oct 2026','No'],['1044','Rohan Shah','Hidden','27','68','3 Months','24 Aug 2026','29 Oct 2026','No']];
 return <div style={{width:1950,height:665,background:'#f5faf6',border:'1px solid #acc5b1',borderRadius:16,overflow:'hidden',color:'#254732',fontFamily:'Segoe UI',fontSize:23,boxShadow:'0 50px 100px #0004'}}>
  <div style={{height:78,background:'#14724c',color:'#edfff1',padding:'21px 30px',fontSize:27,fontWeight:600}}>Google Sheets <span style={{fontWeight:400,fontSize:20,marginLeft:32,opacity:.8}}>Member records · illustrative data</span></div>
  <div style={{display:'grid',gridTemplateColumns:'100px 260px 155px 85px 110px 240px 225px 225px 150px',paddingLeft:35,height:62,alignItems:'center',background:'#e3eee4'}}>{cols.map(c=><div key={c}>{c}</div>)}</div>
  {rows.map((row,i)=><div key={row[0]} style={{height:112,display:'grid',gridTemplateColumns:'100px 260px 155px 85px 110px 240px 225px 225px 150px',alignItems:'center',paddingLeft:35,borderBottom:'1px solid #ccdacf',background:i===1?`rgba(115,204,144,${.08+.22*phase})`:'white'}}>{row.map((t,j)=><div key={j} style={{height:112,paddingTop:36,borderRight:'1px solid #e3eae5',paddingLeft:8}}>{t}</div>)}</div>)}
  <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',height:180}}>{Array.from({length:12},(_,i)=><div key={i} style={{borderRight:'1px solid #e3eae5',background:'repeating-linear-gradient(transparent 0px,transparent 55px,#e3eae5 55px,#e3eae5 56px)'}}/>)}</div>
 </div>;
};
const Connected:React.FC=()=>{
 const f=useCurrentFrame(),p=range(f,70,130);
 return <AbsoluteFill><Mark/>
  <Title top={150} size={88}>Built around<br/>Google Sheets.</Title>
  <div style={{position:'absolute',left:cam(f,[0,80,180],[900,790,740]),top:cam(f,[0,80,180],[350,300,275]),transform:`perspective(2200px) rotateY(${cam(f,[0,85],[-10,-7])}deg) rotateX(5deg)`}}><Sheet phase={p}/></div>
  <div style={{position:'absolute',left:100,top:475,width:570,overflow:'hidden',borderRadius:18,boxShadow:'0 20px 60px #0004',transform:`translateY(${cam(f,[0,55],[28,0])}px)`}}><Capture name="native-ananya" style={{width:1930,maxWidth:'none'}}/></div>
  <svg width={1920} height={1080} style={{position:'absolute',left:0,top:0}}><path d="M650 620H735Q765 620 765 600H820" fill="none" stroke="#b2eac3" strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1-p}/></svg>
  <div style={{position:'absolute',left:610,top:672,fontSize:22,color:'#b9d7c3',opacity:range(f,45,65)}}>via Apps Script</div>
  <div style={{position:'absolute',left:100,top:885,fontSize:28,color:'#abcab5',opacity:range(f,135,153)}}>Load. Manage. Refresh.</div>
  <div style={{position:'absolute',left:100,top:953,fontSize:19,color:'#709c7d'}}>Read and update through the app.</div>
 </AbsoluteFill>;
};

const Responsive:React.FC=()=>{
 const f=useCurrentFrame();
 const desktopX=cam(f,[0,42,150],[-70,100,82]);
 return <AbsoluteFill><Mark/>
  <Title top={142} size={79}>Built for the people<br/>who run the gym.</Title>
  <NativeWindow style={{position:'absolute',left:desktopX,top:422,width:1210,height:537,transform:`perspective(2200px) rotateY(${cam(f,[0,42,155],[-5,0,1.2])}deg)`}}>
   <Capture name="native-header"/><div style={{height:462,overflow:'hidden',padding:'0 28px'}}><Capture name="lookup-complete" style={{transform:`translateY(${cam(f,[45,155],[0,-30])}px)`}}/></div>
  </NativeWindow>
  <div style={{position:'absolute',left:cam(f,[0,50,150],[1850,1420,1403]),top:cam(f,[0,50],[350,175]),width:365,height:807,borderRadius:43,border:'8px solid #2f4b37',outline:'1px solid #9cc4a04a',overflow:'hidden',background:'#f5f6f3',boxShadow:'0 35px 90px #0007'}}>
   <div style={{height:55,background:'#13251f',fontSize:22,fontWeight:650,padding:'11px 19px',color:'#e1f3e7'}}>FitZone<span style={{color:mint}}>.</span></div>
   <div style={{height:736,overflow:'hidden'}}><Capture name="mobile-dashboard" style={{transform:`translateY(${cam(f,[55,150],[0,-210])}px)`}}/></div>
  </div>
  <div style={{position:'absolute',left:100,top:994,width:cam(f,[100,175],[0,1185]),height:3,background:'#b3edc5'}}/>
 </AbsoluteFill>;
};

const Closing:React.FC=()=>{
 const f=useCurrentFrame();
 return <AbsoluteFill>
  <div style={{position:'absolute',left:cam(f,[0,35],[310,350]),top:cam(f,[0,35],[315,345]),opacity:range(f,0,12)}}><Logo size={134} progress={range(f,0,25)}/></div>
  <div style={{position:'absolute',left:525,top:320,fontFamily:'Bahnschrift,Arial,sans-serif',fontSize:190,fontWeight:650,letterSpacing:'.015em'}}><Mask delay={3}>FITZONE<span style={{color:mint}}>.</span></Mask></div>
  <div style={{position:'absolute',left:530,top:580,...font,fontSize:43,color:'#c8e3d1'}}><Mask delay={18}>Less admin. More momentum.</Mask></div>
  <Line width={cam(f,[20,54],[0,800])} style={{position:'absolute',left:530,top:695}}/>
  <div style={{position:'absolute',left:530,top:748,fontSize:35,letterSpacing:'.015em',color:'#a9dfb9',opacity:range(f,37,56)}}>fitzone-gym-mu.vercel.app</div>
  <AbsoluteFill style={{background:'#061b13',opacity:range(f,174,180)}}/>
 </AbsoluteFill>;
};

export const PremiumHero:React.FC=()=> <AbsoluteFill><Stage/>
 <Sequence from={0} durationInFrames={150}><Opening/></Sequence>
 <Sequence from={150} durationInFrames={240}><MemberExperience/></Sequence>
 <Sequence from={390} durationInFrames={300}><OwnerOverview/></Sequence>
 <Sequence from={690} durationInFrames={300}><Workflow/></Sequence>
 <Sequence from={990} durationInFrames={240}><ExpiryFocus/></Sequence>
 <Sequence from={1230} durationInFrames={210}><Connected/></Sequence>
 <Sequence from={1440} durationInFrames={180}><Responsive/></Sequence>
 <Sequence from={1620} durationInFrames={180}><Closing/></Sequence>
 </AbsoluteFill>;
