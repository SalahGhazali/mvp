/* No npm dependencies: exercise the frontend in an isolated headless Chromium profile. */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const browserPath=process.env.QATRA_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'qatra-sprint7-browser-'));
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(body);});
});
let browser,ws,sequence=0,checks=0;
const pending=new Map(),exceptions=[];
async function eventually(fn,message,timeout=15000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await pause(80);}throw new Error('Timed out: '+message);}
function command(method,params={}){
  const id=++sequence;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timed out: '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});ws.send(JSON.stringify({id,method,params}));});
}
async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function navigate(route){await command('Page.navigate',{url:base+route});await eventually(()=>evaluate(`location.pathname===${JSON.stringify('/'+route.split('?')[0])}&&document.readyState==='complete'&&!!document.querySelector('#page-content')?.textContent.trim()`),'page '+route);}
function check(value,message){assert.ok(value,message);checks++;console.log('PASS '+message);}
let base;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}/`;
  if(!fs.existsSync(browserPath))throw new Error('Set QATRA_TEST_BROWSER to a Chromium browser executable.');
  browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-features=RendererCodeIntegrity','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  browser.on('error',error=>exceptions.push(String(error)));
  const portFile=path.join(profile,'DevToolsActivePort');
  await eventually(()=>fs.existsSync(portFile),'browser debugging port');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target=targets.find(t=>t.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
  await command('Runtime.enable');await command('Page.enable');
  await command('Page.navigate',{url:base+'login.html'});
  await eventually(()=>evaluate("document.readyState==='complete'&&!!window.QatraAccounts"),'login');
  await evaluate("QatraAccounts.setSession(QatraAccounts.findById('SYS-HEALTH-SUPERVISOR'))");
  for(const page of ['dashboard','organizations','bloodbanks','inventory','requests','donors','donations','appeals','campaigns','reports','approvals','activity','decisions','notifications']){
    await navigate('supervisor/'+page+'.html');
    check(await evaluate("!document.querySelector('#page-content').textContent.includes('تعذر تحميل البيانات')"),'supervisor '+page+' loads');
  }
  await navigate('supervisor/dashboard.html');
  check(await evaluate("document.querySelectorAll('.supervisor-stats .stat-card').length===16"),'dashboard has all primary metrics');
  const fixture=await evaluate(`(()=>{
    const account=QatraAccounts.create({role:'hospital_bloodbank',name:'ممثل الاختبار',organization:'مؤسسة اختبار',email:'sprint7@example.test',phone:'0598887776',password:'Testing@123',isPrimary:true,approvalStatus:'pending',requestedServices:['blood_request','blood_bank'],approvedServices:[],institutionProfile:{name:'مؤسسة اختبار',governorate:'غزة',institutionType:'مستشفى ميداني'}}).account;
    const bank=QatraAccounts.findById('DEMO-BLOOD-BANK-01'),hospital=QatraAccounts.findById('DEMO-HOSPITAL-01'),donor=QatraAccounts.findById('DEMO-DONOR-01');
    localStorage.setItem('qatraRequests',JSON.stringify([{id:'QA-R1',org:hospital.organization,target:bank.organization,type:'O−',units:2,covered:0,urgency:'طارئ',status:'قيد الاستجابة',createdAt:'2026-10-02T10:00:00Z',neededAt:'2026-10-08T10:00:00Z'},{id:'QA-R2',org:hospital.organization,target:bank.organization,type:'A+',units:1,status:'مرفوض',createdAt:'2026-10-03T10:00:00Z'}]));
    localStorage.setItem('qatraAppeals',JSON.stringify([{id:'QA-C1',org:bank.organization,bloodType:'O−',units:3,status:'مفتوح',neededAt:'2099-10-08T10:00:00Z',createdAt:'2026-10-02T10:00:00Z',responses:[{accountId:donor.id,name:'اسم لا يظهر',phone:'0599876543',email:'hidden@example.test',bloodType:'A+',status:'تم التبرع',completedAt:'2026-10-03T10:00:00Z'},{accountId:'QA-D2',status:'موعد مؤكد'}]}]));
    localStorage.setItem('qatraCampaigns',JSON.stringify([{id:'QA-CP1',name:'حملة اختبار',org:bank.organization,status:'Active',date:'2026-10-07T10:00:00Z',bloodTypes:['O−'],participants:[{donorId:donor.id},{donorId:'QA-D2'}]}]));
    return {pendingId:account.id,bankId:bank.id,bank:bank.organization,hospitalId:hospital.id,donorId:donor.id};
  })()`);
  await navigate('supervisor/organizations.html?status=pending');
  check(await evaluate("document.querySelectorAll('#supervisor-results tbody tr').length===1"),'institution status filter');
  await evaluate("document.querySelector('[data-supervisor=details]').click()");
  check(await evaluate("document.querySelector('#modal-body').textContent.includes('الخدمات المطلوبة')&&document.querySelector('#modal-body').textContent.includes('الخدمات المعتمدة')"),'institution details separate requested and approved services');
  await evaluate("document.querySelector('#close-modal').click()");
  await navigate('supervisor/requests.html?status=Rejected');
  check(await evaluate("document.querySelectorAll('#supervisor-results tbody tr').length===1&&document.querySelector('#supervisor-results tbody').textContent.includes('QA-R2')"),'request status filter');
  await evaluate("document.querySelector('[data-supervisor=details]').click()");
  check(await evaluate("document.querySelector('#modal-body').textContent.includes('تسلسل حالة الطلب')&&!document.querySelector('#modal-body [data-action=accept-request]')"),'request details show timeline without mutation controls');
  await evaluate("document.querySelector('#close-modal').click();const before=localStorage.getItem('qatraRequests');acceptBloodRequest('QA-R1');window.qaDenied=before===localStorage.getItem('qatraRequests')");
  check(await evaluate('window.qaDenied'),'supervisor cannot accept requests');
  await navigate('supervisor/donations.html');
  check(await evaluate("document.querySelectorAll('#supervisor-results tbody tr').length===1&&!document.querySelector('#page-content').textContent.includes('hidden@example.test')&&!document.querySelector('#page-content').textContent.includes('اسم لا يظهر')"),'actual donation count and donor privacy');
  await navigate('supervisor/campaigns.html');
  check(await evaluate("document.querySelector('#supervisor-results tbody').textContent.includes('حملة اختبار')"),'campaign monitoring reads saved data');
  await navigate('supervisor/reports.html');
  for(const type of ['institutions','requests','inventory','donors','donations','calls','campaigns']){
    await evaluate(`document.querySelector('[data-report=${type}]').click()`);
    check(await evaluate("!!document.querySelector('#supervisor-results .stats-grid')"),'report '+type+' renders');
  }
  await evaluate("document.querySelector('[data-report=requests]').click();const form=document.querySelector('#supervisor-filters');form.elements.from.value='2026-10-04';form.elements.to.value='2026-10-01';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
  check(await evaluate("document.querySelector('#supervisor-results').textContent.includes('تاريخ البداية')"),'invalid date range shows validation error');
  await evaluate("document.querySelector('[data-supervisor=reset]').click();const dateForm=document.querySelector('#supervisor-filters');dateForm.elements.from.value='2026-10-02';dateForm.elements.to.value='2026-10-02';dateForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
  check(await evaluate("document.querySelector('#supervisor-results .stat-value').textContent==='١'"),'report date range applies to summary');
  await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
  await evaluate("document.querySelector('[data-supervisor=export]').click()");
  await eventually(()=>fs.readdirSync(profile).some(f=>f.endsWith('.csv')),'CSV download');
  const csv=fs.readFileSync(path.join(profile,fs.readdirSync(profile).find(f=>f.endsWith('.csv'))),'utf8');
  check(csv.includes('طلبات الدم')&&!csv.includes('hidden@example.test'),'CSV contains the filtered aggregate report');
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const page of ['dashboard','organizations','requests','donors','reports']){
    await navigate('supervisor/'+page+'.html');
    check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'mobile '+page+' has no viewport overflow');
  }
  const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(profile,'sprint7-mobile.png'),Buffer.from(screenshot.data,'base64'));
  await command('Emulation.clearDeviceMetricsOverride');
  await navigate('supervisor/reports.html');
  await evaluate("localStorage.setItem('qatraCampaigns','invalid-json');document.querySelector('[data-supervisor=refresh]').click()");
  check(await evaluate("document.querySelector('#page-content').textContent.includes('تعذر قراءة بعض البيانات')&&!!document.querySelector('#supervisor-results')"),'partial data failure preserves usable reports');
  await evaluate("localStorage.setItem('qatraCampaigns','[]')");
  // A full request flow must reserve once, then send and receive once.
  await evaluate(`QatraAccounts.setSession(QatraAccounts.findById(${JSON.stringify(fixture.bankId)}))`);
  await navigate('bloodbank/requests.html');
  const beforeStock=await evaluate(`organizationInventory()[${JSON.stringify('O−')}]`);
  await evaluate("sendBloodRequest('QA-R1')");
  check(await evaluate("requests.find(r=>r.id==='QA-R1').status==='قيد الاستجابة'"),'request cannot skip acceptance and preparation');
  await evaluate("acceptBloodRequest('QA-R1');prepareBloodRequest('QA-R1');prepareBloodRequest('QA-R1')");
  check(await evaluate(`organizationInventory()['O−']===${beforeStock-2}&&requests.find(r=>r.id==='QA-R1').reservedUnits===2`),'preparation reserves units exactly once');
  await evaluate("readyBloodRequest('QA-R1');sendBloodRequest('QA-R1');sendBloodRequest('QA-R1')");
  check(await evaluate(`organizationInventory()['O−']===${beforeStock-2}&&requests.find(r=>r.id==='QA-R1').status==='تم الإرسال بانتظار الاستلام'`),'delivery uses reserved units without double deduction');
  await evaluate("openModal('add-unit');const unitForm=document.querySelector('#unit-form');unitForm.elements.bloodType.value='AB+';unitForm.elements.collectedAt.value=new Date().toISOString().slice(0,10);unitForm.elements.expiresAt.value=new Date(Date.now()+3*86400000).toISOString().slice(0,10);unitForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
  check(await evaluate("JSON.parse(localStorage.getItem('qatraBloodUnits')).some(unit=>unit.bloodType==='AB+'&&unit.collectedAt&&unit.expiresAt&&!unit.legacy)"),'new blood unit preserves collection and expiry dates');
  await evaluate("const expiryUnit=inventoryUnits.find(unit=>unit.bloodType==='AB+'&&unit.expiresAt&&!unit.legacy);window.qaStock=organizationInventory()['AB+'];expiryUnit.expiresAt='2020-01-01';persistInventory()");
  check(await evaluate("organizationInventory()['AB+']===window.qaStock-1&&inventoryUnits.some(unit=>unit.bloodType==='AB+'&&unit.expiresAt==='2020-01-01'&&unit.status==='EXPIRED')"),'expired units are removed from available stock');
  await evaluate(`QatraAccounts.setSession(QatraAccounts.findById(${JSON.stringify(fixture.hospitalId)}))`);
  await navigate('hospital/requests.html');
  await evaluate("receiveBloodRequest('QA-R1');receiveBloodRequest('QA-R1')");
  check(await evaluate("requests.find(r=>r.id==='QA-R1').status==='مكتمل'&&requests.find(r=>r.id==='QA-R1').statusHistory.length===6"),'receipt completes the request and saves the full timeline');
  await evaluate(`QatraAccounts.setSession(QatraAccounts.findById(${JSON.stringify(fixture.pendingId)}))`);
  await navigate('hospital-bloodbank/dashboard.html');
  check(await evaluate("!!document.querySelector('.approval-lock-hero.pending')"),'pending institution has approval workspace');
  await evaluate("openModal('add-unit')");
  check(await evaluate("document.querySelector('#modal').classList.contains('hidden')"),'pending institution cannot add inventory');
  await evaluate(`QatraAccounts.setSession(QatraAccounts.findById(${JSON.stringify(fixture.donorId)}))`);
  await command('Page.navigate',{url:base+'supervisor/dashboard.html'});
  await eventually(()=>evaluate("location.pathname==='/donor/dashboard.html'&&document.readyState==='complete'"),'role redirect');
  check(true,'donor cannot open supervisor dashboard');
  await evaluate('QatraAccounts.clearSession()');
  await command('Page.navigate',{url:base+'supervisor/reports.html'});
  await eventually(()=>evaluate("location.pathname==='/login.html'&&document.readyState==='complete'"),'guest redirect');
  check(true,'logged-out users cannot open protected reports');
  check(exceptions.length===0,'no uncaught JavaScript exceptions: '+exceptions.join('\n'));
  console.log(`Browser smoke checks: ${checks} passed. Screenshot: ${path.join(profile,'sprint7-mobile.png')}`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(ws){try{await command('Browser.close');}catch{}ws.close();}
  if(browser&&!browser.killed)browser.kill();
  server.close();
});
