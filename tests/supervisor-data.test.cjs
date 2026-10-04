const {test} = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../supervisor-data.js');
const now = new Date('2026-10-04T12:00:00Z');
const institution = (id,role='bloodbank',approvalStatus='approved',extra={}) => ({id,role,approvalStatus,isPrimary:true,organization:id,createdAt:'2026-08-01T09:00:00Z',institutionProfile:{governorate:'غزة',institutionType:'مركز دم'},...extra});
const donor = {id:'D1',role:'donor',bloodType:'O-',governorate:'غزة',available:true,name:'اسم خاص',phone:'0591234567',email:'private@example.test',identity:'123456789'};

test('pending/rejected services and explicitly empty approvals never grant bank access',()=>{
  const data=Data.snapshot({accounts:[institution('approved'),institution('pending','bloodbank','pending'),institution('rejected','bloodbank','rejected'),institution('empty','bloodbank','approved',{approvedServices:[]}),institution('requested-only','hospital','approved',{requestedServices:['blood_bank'],approvedServices:['blood_request']})],inventory:{approved:{'O−':5},pending:{'O−':999},rejected:{'O−':999},empty:{'O−':999}}},now);
  assert.deepEqual(data.banks.map(b=>b.id),['approved']);
  assert.equal(data.inventory.reduce((n,r)=>n+r.available,0),5);
  assert.deepEqual(data.institutions.find(r=>r.id==='requested-only').requestedServices,['blood_bank']);
  assert.deepEqual(data.institutions.find(r=>r.id==='requested-only').approvedServices,['blood_request']);
});
test('inventory excludes reserved/delivered/expired/discarded units and catches date expiration',()=>{
  const units=[['AVAILABLE','2026-10-06'],['RESERVED','2026-10-06'],['DELIVERED','2026-10-06'],['EXPIRED','2026-10-01'],['DISCARDED','2026-10-06'],['AVAILABLE','2026-10-01']].map(([status,expirationDate],i)=>({id:`U${i}`,institutionId:'B1',bloodType:'O-',status,expirationDate}));
  const data=Data.snapshot({accounts:[institution('B1')],units},now),row=data.inventory.find(r=>r.bloodType==='O−');
  assert.equal(row.available,1);assert.equal(row.reserved,1);assert.equal(row.expired,2);assert.equal(row.delivered,1);assert.equal(row.discarded,1);assert.equal(row.expiring,1);
});
test('undated legacy stock is preserved without inventing expiry information',()=>{
  const data=Data.snapshot({accounts:[institution('B1')],inventory:{B1:{'O−':7}}},now);
  assert.equal(data.banks[0].available,7);assert.equal(data.banks[0].expiring,null);
  assert.equal(Data.report(data,'inventory',{from:'2026-10-01'}).rows.length,0);
});
test('interested responses and campaign registrations are not actual donations',()=>{
  const data=Data.snapshot({accounts:[donor,institution('B1')],calls:[{id:'C1',org:'B1',bloodType:'O−',responses:[{accountId:'D1',status:'موعد مؤكد'}]}],campaigns:[{id:'CP1',org:'B1',status:'Active',participants:[{donorId:'D1'}, {donorId:'D1'}]}]},now);
  assert.equal(data.donations.length,0);assert.equal(data.donors[0].donationCount,0);assert.equal(data.calls[0].interested,1);assert.equal(data.calls[0].invitations,null);assert.equal(data.campaigns[0].participants,1);assert.equal(data.campaigns[0].donations,0);
});
test('confirmed donations deduplicate legacy/ledger records and require a donation date',()=>{
  const completedAt='2026-10-02T10:00:00Z';
  const data=Data.snapshot({accounts:[donor,institution('B1')],calls:[{id:'C1',org:'B1',bloodType:'O−',responses:[{accountId:'D1',status:'تم التبرع',completedAt},{accountId:'D2',status:'تم التبرع'}]}],donations:[{id:'DN1',donorId:'D1',callId:'C1',institution:'B1',bloodType:'O−',completedAt}]},now);
  assert.equal(data.donations.length,1);assert.equal(data.calls[0].donations,1);assert.equal(data.donors[0].donationCount,1);
});
test('donor projections exclude names, contact details, passwords and identity',()=>{
  const data=Data.snapshot({accounts:[{...donor,password:'secret'}]},now);
  for(const key of ['name','phone','email','identity','password'])assert.equal(Object.hasOwn(data.donors[0],key),false);
  assert.equal(data.donors[0].bloodType,'O−');
});
test('request filters preserve status and date semantics, including inclusive final day',()=>{
  const data=Data.snapshot({accounts:[institution('B1')],requests:[{id:'R1',org:'B1',type:'A+',status:'مكتمل',createdAt:'2026-10-02T18:00:00',receivedAt:'2026-10-03T18:00:00'},{id:'R2',org:'B1',type:'O−',status:'مرفوض',createdAt:'2026-10-02T19:00:00'},{id:'R3',org:'B1',type:'O−',status:'ملغي',createdAt:'2026-10-03T19:00:00'}]},now);
  const report=Data.report(data,'requests',{from:'2026-10-02',to:'2026-10-02'});
  assert.equal(report.rows.length,2);assert.equal(report.summary[1][1],1);assert.equal(report.chart.reduce((n,r)=>n+r.value,0),2);assert.equal(report.table.reduce((n,r)=>n+r.value,0),2);
  assert.equal(Data.report(data,'requests',{status:'Rejected',bloodType:'O−'}).rows[0].id,'R2');
});
test('invalid or reversed date ranges produce an explicit error and no results',()=>{
  for(const filters of [{from:'2026-10-04',to:'2026-10-01'},{from:'2026-02-31'},{to:'invalid'}]){assert.ok(Data.validRange(filters));assert.equal(Data.report({requests:[]},'requests',filters).rows.length,0);}
});
test('all seven report summaries and distributions share the filtered dataset',()=>{
  const data=Data.snapshot({accounts:[institution('B1'),institution('B2','hospital','approved'),donor],requests:[{id:'R1',org:'B1',status:'Pending',type:'O−',units:3,createdAt:'2026-10-03'}],inventory:{B1:{'O−':7}},calls:[{id:'C1',org:'B1',bloodType:'O−',status:'مفتوح',createdAt:'2026-10-03'}],campaigns:[{id:'CP1',org:'B1',name:'حملة',status:'Active',date:'2026-10-03',participants:['D1']}],donations:[{id:'DN1',donorId:'D1',institution:'B1',bloodType:'O−',completedAt:'2026-10-03',campaignId:'CP1'}]},now);
  for(const type of Object.keys(Data.reportLabels)){
    const report=Data.report(data,type,{governorate:'غزة'});
    assert.equal(report.error,'');
    const expected=type==='inventory'?report.rows.reduce((n,r)=>n+r.available,0):report.rows.length;
    assert.equal(report.chart.reduce((n,r)=>n+r.value,0),expected,type);
    assert.equal(report.table.reduce((n,r)=>n+r.value,0),expected,type);
    assert.equal(report.summary[0][1],expected,type);
  }
});
test('campaign actual donations count only records, never participant status',()=>{
  const data=Data.snapshot({accounts:[institution('B1'),donor],campaigns:[{id:'CP1',org:'B1',participants:[{donorId:'D1',status:'DONATED'}],donations:[{id:'DN1',donorId:'D1',bloodType:'O−',completedAt:'2026-10-03'}]}]},now);
  assert.equal(data.campaigns[0].participants,1);assert.equal(data.campaigns[0].donations,1);assert.equal(Data.report(data,'donations').summary[0][1],1);
});
test('configured low-stock threshold applies per approved bank and blood type',()=>{
  const data=Data.snapshot({accounts:[institution('B1')],inventory:{B1:{'O−':4,'A+':6}},settings:{lowStockThreshold:5}},now);
  assert.equal(data.inventory.find(r=>r.bloodType==='O−').low,true);assert.equal(data.inventory.find(r=>r.bloodType==='A+').low,false);
});
test('known expiry alerts remain visible when a bank has undated legacy units',()=>{
  const data=Data.snapshot({accounts:[institution('B1')],units:[{id:'old',institutionId:'B1',bloodType:'O−',status:'AVAILABLE',legacy:true},{id:'new',institutionId:'B1',bloodType:'O−',status:'AVAILABLE',collectedAt:'2026-10-01',expiresAt:'2026-10-06'}]},now);
  assert.equal(data.banks[0].available,2);assert.equal(data.banks[0].expiring,null);assert.equal(data.banks[0].knownExpiring,1);
});
test('inventory period filtering uses collection dates and preserves stock state exclusions',()=>{
  const data=Data.snapshot({accounts:[institution('B1')],units:[{id:'U1',institutionId:'B1',bloodType:'O−',status:'AVAILABLE',collectedAt:'2026-10-02',expiresAt:'2026-10-06'},{id:'U2',institutionId:'B1',bloodType:'O−',status:'RESERVED',collectedAt:'2026-10-02',expiresAt:'2026-10-06'},{id:'U3',institutionId:'B1',bloodType:'O−',status:'AVAILABLE',legacy:true}]},now);
  const report=Data.report(data,'inventory',{from:'2026-10-02',to:'2026-10-02'});
  assert.equal(report.summary[0][1],1);assert.equal(report.summary[1][1],1);assert.equal(report.summary[3][1],1);assert.equal(report.chart.reduce((n,r)=>n+r.value,0),1);
});
test('empty datasets contain zero metrics and no fabricated report rows',()=>{
  const data=Data.snapshot({},now);
  for(const type of Object.keys(Data.reportLabels)){const report=Data.report(data,type);assert.equal(report.rows.length,0);assert.equal(report.summary[0][1],0);assert.ok(report.chart.every(row=>row.value===0));}
});
