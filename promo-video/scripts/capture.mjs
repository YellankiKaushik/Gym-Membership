import { createServer } from '../../node_modules/vite/dist/node/index.js';
import react from '../../node_modules/@vitejs/plugin-react/dist/index.js';
import { chromium } from '../../node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { withCaptureResources } from './capture-resources.mjs';

// The original app is served with an isolated, explicit config. No .env is read.
const root = resolve('..');
const out = resolve('assets/captures');
await mkdir(out, {recursive: true});
// Tailwind resolves its content globs from cwd; point it at the unchanged app.
process.chdir(root);
// Synthetic fixture endpoint only; every request to it is intercepted below.
const endpoint = 'https://script.google.com/macros/s/FILM_FIXTURE_ONLY/exec';
await withCaptureResources({createServer: () => createServer({root, configFile: false, envFile: false,
  plugins: [react()], define: {__GYM_PUBLIC_CONFIG__: JSON.stringify({apiUrl:endpoint, name:'FitZone', lookupMode:'legacy', environment:'film'})},
  server:{host:'127.0.0.1',port:4197,strictPort:true},logLevel:'error'}),
  launchBrowser: () => chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
}, async browser => {
const audit = {date:'2026-10-24', source:'Original src/App.tsx and original CSS', externalRequests:[], errors:[], captures:[]};
const names = ['Aarav Mehta','Ananya Rao','Rohan Shah','Maya Kapoor','Arjun Sen','Isha Verma','Dev Malhotra','Tara Desai'];
const ends = ['2026-11-23','2026-10-27','2026-10-29','2026-10-20','2026-12-23','2027-01-23','2026-10-24','2026-10-18'];
// Deliberately no real or fabricated phone numbers. Capture-only redaction below.
const members = names.map((name,i)=>({id:String(1042+i),name,phone:'',age:27,weight:68,membershipType:i===4?'6 Months':'3 Months',startDate:'2026-08-24',endDate:ends[i],status:i===3||i===7?'Expired':'Active',version:'film-row-'+i}));
async function setup(width,height) {
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce'});
 await context.addInitScript(() => { const D=Date; const fixed=D.parse('2026-10-24T06:30:00Z'); window.Date=class extends D {constructor(...a){super(...(a.length?a:[fixed]));}static now(){return fixed;}}; });
 await context.route('**/*',async route=>{
  const req=route.request();
  if(req.url().startsWith(endpoint)) {
   const action=req.method()==='POST'?req.postDataJSON().action:'lookup';
   // This repeated-character token is synthetic, valid only inside this intercepted fixture.
   const result=action==='login'?{success:true,sessionToken:'f'.repeat(64),expiresAt:1792825200000+1800000}:action==='getAll'?{success:true,members}:{success:true,member:{id:'1042',name:'Member',membershipType:'3 Months',endDate:'2026-11-23',status:'Active',daysRemaining:30}};
   // Expiry derives from the browser clock, never the host clock.
   if(action==='login') result.expiresAt=Date.parse('2026-10-24T06:30:00Z')+1800000;
   return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
  }
  if(req.url().startsWith('http://127.0.0.1:4197/')) return route.continue();
  audit.externalRequests.push(req.url()); return route.abort();
 });
 const page=await context.newPage(); page.on('pageerror',e=>audit.errors.push(e.message));
 await page.goto('http://127.0.0.1:4197');
 // This removes sensitive contact fields only in the screenshot browser; source is untouched.
 await page.addStyleTag({content:'.member-contact,#member-phone{color:transparent!important;position:relative}.member-contact:after{content:"Contact hidden";color:#65736d;position:absolute;left:0;top:0}.whatsapp-unavailable{display:none!important}'});
 await page.evaluate(()=>document.fonts.ready);
 return {page,context};
}
async function snap(page,selector,name) {
 const el=(typeof selector==='string'?page.locator(selector):selector).first(); await el.waitFor();
 await el.screenshot({path:resolve(out,name+'.png')});
 const box=await el.boundingBox();audit.captures.push({name,width:box.width,height:box.height});
}
async function login(page) {
 await page.getByRole('button',{name:'Owner Dashboard',exact:true}).click();
 // Invented capture-only credentials; these are never sent to a real backend.
 await page.getByLabel('Owner ID',{exact:true}).fill('film-owner');
 await page.getByLabel('Password',{exact:true}).fill('FilmFixtureOnly2026!');
 await page.getByRole('button',{name:'Login',exact:true}).click();
 await page.getByRole('heading',{name:'Owner Dashboard',exact:true}).waitFor();
 await page.locator('.member-row').first().waitFor();
}
 const {page,context}=await setup(1440,1100);
 await snap(page,'.lookup-hero','lookup-hero');
 await snap(page,'.lookup-form','lookup-empty');
 for (const value of ['1','10','104']) {
  await page.getByLabel('Member ID',{exact:true}).fill(value);
  await snap(page,'.lookup-form',`lookup-type-${value}`);
 }
 await page.getByLabel('Member ID',{exact:true}).fill('1042');
 await snap(page,'.lookup-form','lookup-filled');
 await snap(page,'.site-header','native-header');
 await page.getByRole('button',{name:'Check Membership',exact:true}).click();
 await snap(page,'.membership-result','lookup-result');
 await snap(page,'.result-days','native-days');
 await snap(page,'.lookup-hero','lookup-complete');
 await login(page);
 await snap(page,'.dashboard','dashboard');
 await snap(page,'.summary-grid','summary');
 await snap(page,'.dashboard-heading','native-dashboard-heading');
 await snap(page,'.attention-bar','native-attention');
 for(let i=0;i<4;i++) await page.locator('.summary-card').nth(i).screenshot({path:resolve(out,`stat-${i}.png`)});
 await snap(page,'.members-workspace','members');
 await snap(page,'.filter-tabs','native-filters-all');
 await page.getByRole('button',{name:'View expiring',exact:false}).click();
 await snap(page,'.members-workspace','expiring');
 await snap(page,'.filter-tabs','native-filters-expiring');
 for(let i=0;i<3;i++) await page.locator('.member-row').nth(i).screenshot({path:resolve(out,`expiry-row-${i}.png`)});
 for(let i=0;i<3;i++) await page.locator('.member-row').nth(i).locator('.member-expiry').screenshot({path:resolve(out,`native-expiry-${i}.png`)});
 await page.getByRole('button',{name:'All',exact:true}).click();
 await page.getByRole('searchbox').fill('Ananya');
 await snap(page,'.members-workspace','search');
 await snap(page,'.member-row','native-ananya');
 for(const query of ['A','Ana','Ananya']) {
  await page.getByRole('searchbox').fill(query);
  await snap(page,'.members-workspace',`search-${query}`);
 }
 await page.getByRole('button',{name:'Clear member search'}).click();
 await page.getByRole('button',{name:'Add Member',exact:true}).first().click();
 await page.getByLabel('Name',{exact:true}).fill('Neel Joshi');
 await page.getByLabel('Age',{exact:true}).fill('26');
 await page.getByLabel('Weight (kg)',{exact:true}).fill('72');
 await snap(page,'.dialog-surface','add');
 for(const value of ['','Ne','Neel','Neel Joshi']) {
  await page.getByLabel('Name',{exact:true}).fill(value);
  await snap(page,'.dialog-surface',`add-name-${value.length}`);
 }
 await page.getByRole('button',{name:'Close member dialog'}).click();
 await page.getByRole('button',{name:'Edit Ananya Rao',exact:true}).click();
 await snap(page,'.dialog-surface','edit');
 await snap(page,page.locator('#member-name').locator('..'),'edit-name');
 await snap(page,page.locator('.dialog-surface button[type="submit"]'),'edit-save');
 await page.getByLabel('Name',{exact:true}).fill('Ananya R. Rao');
 await snap(page,'.dialog-surface','edit-updated');
 await snap(page,page.locator('#member-name').locator('..'),'edit-name-updated');
 await page.getByRole('button',{name:'Close member dialog'}).click();
 await page.getByRole('button',{name:'Renew Ananya Rao',exact:true}).click();
 await snap(page,'.dialog-surface','renew');
 await snap(page,page.locator('#renew-plan').locator('../..'),'renew-plan-field');
 await page.getByLabel('New Membership Type',{exact:true}).selectOption('6 Months');
 await snap(page,'.dialog-surface','renew-selected');
 await snap(page,page.locator('#renew-plan').locator('../..'),'renew-plan-selected');
 await context.close();
 const mobile=await setup(390,900);
 await mobile.page.getByLabel('Member ID',{exact:true}).fill('1042');
 await mobile.page.getByRole('button',{name:'Check Membership',exact:true}).click();
 await mobile.page.locator('.membership-result').waitFor();
 await mobile.page.screenshot({path:resolve(out,'mobile-lookup.png'),fullPage:true});
 await snap(mobile.page,'.lookup-form','mobile-form');
 await snap(mobile.page,'.membership-result','mobile-result');
 await login(mobile.page);
 await snap(mobile.page,'.dashboard','mobile-dashboard');
 await mobile.context.close();
 if(audit.errors.length||audit.externalRequests.length) throw new Error(JSON.stringify(audit));
 await writeFile(resolve(out,'capture-audit.json'),JSON.stringify(audit,null,2));
 console.log(`Captured ${audit.captures.length} original UI regions; no external requests or browser errors.`);
});
