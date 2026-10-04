/* Sprint 7: shared, privacy-safe projections for the local frontend prototype. */
(function (root) {
  'use strict';
  const bloodTypes = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
  const requestLabels = {Pending:'قيد الاستجابة', Accepted:'مقبول', Preparing:'قيد التجهيز', Ready:'جاهز للتسليم', Sent:'أُرسل بانتظار الاستلام', Completed:'مكتمل', Rejected:'مرفوض', Cancelled:'ملغي'};
  const callLabels = {Active:'نشط', Awaiting:'بانتظار التبرع', Completed:'مكتمل', Cancelled:'ملغي', Expired:'منتهي'};
  const campaignLabels = {Draft:'مسودة', Upcoming:'قادمة', Active:'نشطة', Completed:'مكتملة', Cancelled:'ملغاة'};
  const reportLabels = {institutions:'المؤسسات', requests:'طلبات الدم', inventory:'المخزون', donors:'المتبرعون', donations:'التبرعات الفعلية', calls:'نداءات التبرع', campaigns:'الحملات'};
  const list = value => Array.isArray(value) ? value : [];
  const count = value => Math.max(0, Number(value) || 0);
  const blood = value => String(value || '').replace(/-/g, '−');
  const status = value => String(value || '').toLowerCase();
  const validDate = value => Boolean(value && Number.isFinite(new Date(value).getTime()));
  const institutionRoles = ['hospital', 'hospital_bloodbank', 'bloodbank'];
  function roleServices(role) {
    return role === 'hospital' ? ['blood_request'] : role === 'hospital_bloodbank' ? ['blood_request','blood_bank'] : role === 'bloodbank' ? ['blood_bank'] : [];
  }
  function normalizeServices(value) {
    return [...new Set(list(value).flatMap(service => {
      const key = String(service).toLowerCase().replace(/[ _-]/g, '');
      return key === 'both' ? ['blood_request','blood_bank'] : key === 'bloodrequest' ? ['blood_request'] : key === 'bloodbank' ? ['blood_bank'] : [];
    }))];
  }
  function services(account, approved = false) {
    if (!account || !institutionRoles.includes(account.role)) return [];
    if (approved && (account.approvalStatus || 'approved') !== 'approved') return [];
    const field = approved ? 'approvedServices' : 'requestedServices';
    const explicit = account[field] ?? account.institutionProfile?.[field];
    // Legacy accounts used role as their service selection. Explicit empty lists stay empty.
    return explicit === undefined ? roleServices(account.role) : normalizeServices(explicit);
  }
  function requestStatus(value) {
    const key = status(value);
    return ({'قيد الاستجابة':'Pending','مقبول بانتظار الإرسال':'Accepted','قيد التجهيز':'Preparing','جاهز للتسليم':'Ready','تم الإرسال بانتظار الاستلام':'Sent','مكتمل':'Completed','مرفوض':'Rejected','ملغي':'Cancelled'})[key]
      || Object.keys(requestLabels).find(item => item.toLowerCase() === key) || 'Unknown';
  }
  function callStatus(value) {
    const key = status(value);
    return ({'مفتوح':'Active','نشط':'Active','بانتظار التبرع':'Awaiting','مكتمل':'Completed','ملغي':'Cancelled','منتهي':'Expired'})[key]
      || Object.keys(callLabels).find(item => item.toLowerCase() === key) || 'Unknown';
  }
  function campaignStatus(value) {
    const key = status(value);
    return ({'مسودة':'Draft','قادمة':'Upcoming','نشطة':'Active','نشط':'Active','مكتمل':'Completed','مكتملة':'Completed','ملغي':'Cancelled','ملغاة':'Cancelled'})[key]
      || Object.keys(campaignLabels).find(item => item.toLowerCase() === key) || 'Unknown';
  }
  function snapshot(input = {}, now = new Date()) {
    const accounts = list(input.accounts), primary = accounts.filter(a => a.isPrimary && institutionRoles.includes(a.role));
    const institutionById = new Map(primary.map(a => [a.id, a]));
    const institutionByName = new Map(primary.map(a => [a.organization, a]));
    const findInstitution = value => institutionById.get(value) || institutionByName.get(value);
    const organizationName = value => findInstitution(value)?.organization || value || 'غير محدد';
    const governorate = value => findInstitution(value)?.institutionProfile?.governorate || '';
    const institutions = primary.map(a => ({id:a.id, name:a.organization || a.institutionProfile?.name || '', type:a.institutionProfile?.institutionType || '', governorate:a.institutionProfile?.governorate || '', address:a.institutionProfile?.address || '', status:a.approvalStatus || 'approved', requestedServices:services(a), approvedServices:services(a, true), createdAt:a.createdAt, reviewedAt:a.reviewedAt, updatedAt:a.updatedAt}));
    const requests = list(input.requests).map(r => ({id:r.id, institution:organizationName(r.institutionId || r.org), bank:organizationName(r.assignedBankId || r.target), governorate:r.governorate || governorate(r.institutionId || r.org), bloodType:blood(r.bloodType || r.type), units:count(r.units), priority:r.priority || r.urgency || '', status:requestStatus(r.status), rawStatus:r.status, neededAt:r.neededAt, createdAt:r.createdAt, updatedAt:r.updatedAt || r.receivedAt || r.sentAt || r.acceptedAt || r.createdAt, completedAt:r.completedAt || r.receivedAt, history:list(r.statusHistory).map(h => ({status:requestStatus(h.status), at:h.at || h.createdAt})), timestamps:{Pending:r.createdAt, Accepted:r.acceptedAt, Preparing:r.preparingAt, Ready:r.readyAt, Sent:r.sentAt, Completed:r.completedAt || r.receivedAt, Rejected:r.rejectedAt, Cancelled:r.cancelledAt}}));

    const candidates = [];
    const addDonation = (record, parent, kind, sourceId) => {
      const completedAt = record.completedAt || record.donationDate || record.donatedAt;
      if (!validDate(completedAt)) return;
      const institution = organizationName(record.institutionId || record.institution || record.org || parent?.institutionId || parent?.org || parent?.institution);
      candidates.push({id:record.donationId || record.id || `${kind}:${sourceId}:${record.accountId || record.donorId}`, donorId:record.donorId || record.accountId || '', institution, governorate:governorate(institution), bloodType:blood(record.bloodType || parent?.bloodType), completedAt, createdAt:completedAt, sourceType:record.campaignId ? 'campaign' : record.callId || record.appealId ? 'call' : kind, sourceId:record.campaignId || record.callId || record.appealId || sourceId || '', unitId:record.bloodUnitId || record.unitId || ''});
    };
    list(input.calls).forEach(call => list(call.responses).filter(r => ['تم التبرع','donated','completed'].includes(status(r.status))).forEach(r => addDonation(r, call, 'call', call.id)));
    list(input.voluntary).filter(r => ['تم التبرع','donated','completed'].includes(status(r.status))).forEach(r => addDonation(r, r, 'voluntary', r.id));
    list(input.donations).filter(r => !r.status || ['تم التبرع','donated','completed'].includes(status(r.status))).forEach(r => addDonation(r, null, r.campaignId ? 'campaign' : r.callId || r.appealId ? 'call' : 'direct', r.campaignId || r.callId || r.appealId || r.id));
    list(input.campaigns).forEach(c => list(c.donations).filter(r => !r.status || ['تم التبرع','donated','completed'].includes(status(r.status))).forEach(r => addDonation(r, c, 'campaign', c.id)));
    const donations = [], donationIds = new Set(), donationKeys = new Set();
    candidates.forEach(d => {
      const key = `${d.donorId}|${d.sourceType}|${d.sourceId}|${new Date(d.completedAt).toISOString()}`;
      if (donationIds.has(d.id) || donationKeys.has(key)) return;
      donationIds.add(d.id); donationKeys.add(key); donations.push(d);
    });
    const donors = accounts.filter(a => a.role === 'donor').map(a => {
      const actual = donations.filter(d => d.donorId === a.id).sort((x,y) => new Date(y.completedAt) - new Date(x.completedAt));
      return {id:a.id, bloodType:blood(a.bloodType), governorate:a.governorate || '', available:a.available === true && a.status !== 'inactive', donationCount:actual.length, lastDonationAt:actual[0]?.completedAt || null, createdAt:a.createdAt};
    });
    const calls = list(input.calls).map(c => {
      const responses = list(c.responses);
      return {id:c.id, institution:organizationName(c.institutionId || c.org), governorate:c.governorate || governorate(c.institutionId || c.org), bloodType:blood(c.bloodType), units:count(c.units), priority:c.priority || c.urgency || '', location:c.location || '', neededAt:c.neededAt, createdAt:c.createdAt, status:callStatus(c.status), invitations:Array.isArray(c.invitations) ? c.invitations.length : null, interested:responses.filter(r => ['موعد مؤكد','مهتم','interested','تم قبول الموعد'].includes(status(r.status))).length, donations:donations.filter(d => d.sourceType === 'call' && d.sourceId === c.id).length};
    });
    const campaigns = list(input.campaigns).map(c => ({id:c.id, name:c.name || c.title || '', institution:organizationName(c.institutionId || c.org || c.institution), governorate:c.governorate || governorate(c.institutionId || c.org || c.institution), bloodTypes:list(c.bloodTypes || c.targetBloodTypes).map(blood), location:c.location || '', date:c.date || c.startsAt, createdAt:c.createdAt, status:campaignStatus(c.status), participants:new Set(list(c.participants).map(p => typeof p === 'string' ? p : p.donorId || p.accountId || p.id).filter(Boolean)).size, donations:donations.filter(d => d.sourceType === 'campaign' && d.sourceId === c.id).length}));

    const nowTime = new Date(now).getTime(), expiryLimit = nowTime + 7 * 86400000;
    const threshold = Number.isFinite(Number(input.settings?.lowStockThreshold)) ? count(input.settings.lowStockThreshold) : 1;
    const units = list(input.units);
    const inventory = institutions.filter(i => i.approvedServices.includes('blood_bank')).flatMap(bank => {
      const bankUnits = units.filter(u => u.institutionId === bank.id || u.organization === bank.name || u.org === bank.name);
      const legacy = input.inventory?.[bank.name] || {};
      return bloodTypes.map(type => {
        const typed = bankUnits.filter(u => blood(u.bloodType || u.type) === type);
        const effectiveStatus = u => status(u.status) === 'available' && validDate(u.expiresAt || u.expirationDate) && new Date(u.expiresAt || u.expirationDate).getTime() < nowTime ? 'expired' : status(u.status);
        const available = typed.filter(u => effectiveStatus(u) === 'available');
        const expired = typed.filter(u => effectiveStatus(u) === 'expired').length;
        const raw = legacy[type] ?? legacy[type.replace('−','-')];
        const detailed = bankUnits.length > 0;
        const availableCount = detailed ? available.length : count(typeof raw === 'object' ? raw?.available : raw);
        const reservedLegacy = typeof raw === 'object' ? count(raw?.reserved) : list(input.requests).filter(r => (r.target === bank.name || r.assignedBankId === bank.id) && blood(r.type || r.bloodType) === type && ['Preparing','Ready'].includes(requestStatus(r.status))).reduce((n,r) => n+count(r.reservedUnits),0);
        const expiryKnown=detailed&&available.every(u=>validDate(u.expiresAt||u.expirationDate));
        const knownExpiring=available.filter(u=>validDate(u.expiresAt||u.expirationDate)&&new Date(u.expiresAt||u.expirationDate).getTime()<=expiryLimit).length;
        return {id:`${bank.id}:${type}`, bankId:bank.id, institution:bank.name, governorate:bank.governorate, bloodType:type, available:availableCount, reserved:detailed ? typed.filter(u => effectiveStatus(u) === 'reserved').length : reservedLegacy, expired:detailed ? expired : count(raw?.expired), delivered:detailed ? typed.filter(u => effectiveStatus(u) === 'delivered').length : count(raw?.delivered), discarded:detailed ? typed.filter(u => effectiveStatus(u) === 'discarded').length : count(raw?.discarded), expiring:expiryKnown ? knownExpiring : null, knownExpiring, low:availableCount < threshold, threshold, detailed, updatedAt:detailed ? typed.map(u => u.updatedAt || u.createdAt).filter(validDate).sort().pop() : null, units:typed.map(u => ({...u, status:effectiveStatus(u)}))};
      });
    });
    const banks = institutions.filter(i => i.approvedServices.includes('blood_bank')).map(bank => {
      const rows = inventory.filter(r => r.bankId === bank.id);
      return {...bank, available:rows.reduce((n,r) => n+r.available,0), reserved:rows.reduce((n,r) => n+r.reserved,0), expiring:rows.some(r => r.expiring === null) ? null : rows.reduce((n,r) => n+r.expiring,0), knownExpiring:rows.reduce((n,r)=>n+r.knownExpiring,0), lowTypes:rows.filter(r => r.low).map(r => r.bloodType), updatedAt:rows.map(r => r.updatedAt).filter(validDate).sort().pop() || null};
    });
    return {institutions, banks, inventory, requests, donors, donations, calls, campaigns, activity:list(input.activity), warnings:list(input.warnings), now:new Date(now).toISOString()};
  }
  function validRange(filters) {
    const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(`${value}T00:00:00`) && new Date(`${value}T00:00:00`).getDate() === Number(value.slice(-2));
    if ((filters.from && !day(filters.from)) || (filters.to && !day(filters.to))) return 'أدخل تاريخًا صحيحًا.';
    return filters.from && filters.to && filters.from > filters.to ? 'تاريخ البداية يجب أن يسبق تاريخ النهاية.' : '';
  }
  function matches(row, filters = {}, dateField = 'createdAt') {
    const query = String(filters.search || '').trim().toLowerCase();
    if (query && ![row.id,row.name,row.institution,row.bank,row.type,row.location].some(v => String(v || '').toLowerCase().includes(query))) return false;
    if (filters.status && String(row.status) !== filters.status) return false;
    if (filters.governorate && row.governorate !== filters.governorate) return false;
    if (filters.institution && row.institution !== filters.institution && row.name !== filters.institution) return false;
    if (filters.bank && row.bank !== filters.bank && row.institution !== filters.bank) return false;
    if (filters.bloodType && row.bloodType !== filters.bloodType && !list(row.bloodTypes).includes(filters.bloodType)) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.service && !list(row.approvedServices).includes(filters.service)) return false;
    if (filters.available && String(row.available) !== filters.available) return false;
    if (filters.sourceType && row.sourceType !== filters.sourceType) return false;
    if (filters.from || filters.to) {
      if (!validDate(row[dateField])) return false;
      const date = new Date(row[dateField]);
      const localDay = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      if ((filters.from && localDay < filters.from) || (filters.to && localDay > filters.to)) return false;
    }
    return true;
  }
  function filterRows(data, type, filters = {}) {
    if (validRange(filters)) return [];
    const dateField = type === 'donations' ? 'completedAt' : type === 'campaigns' ? 'date' : type === 'inventory' ? 'updatedAt' : 'createdAt';
    let rows = list(data[type]).filter(row => matches(row, filters, dateField));
    if (type === 'inventory' && (filters.from || filters.to)) {
      // Unit dates can be filtered exactly; undated legacy totals are excluded.
      rows = list(data.inventory).filter(r => matches(r, {...filters, from:'', to:''})).map(r => {
        const units = r.units.filter(u => matches({...r, createdAt:u.collectedAt || u.collectionDate || u.createdAt}, {...filters, search:''}));
        const available = units.filter(u => u.status === 'available');
        const knownExpiring=available.filter(u=>validDate(u.expiresAt||u.expirationDate)&&new Date(u.expiresAt||u.expirationDate).getTime()<=new Date(data.now).getTime()+7*86400000).length;
        return {...r, units, available:available.length, reserved:units.filter(u => u.status === 'reserved').length, expired:units.filter(u => u.status === 'expired').length, delivered:units.filter(u => u.status === 'delivered').length, discarded:units.filter(u => u.status === 'discarded').length, knownExpiring, expiring:available.every(u=>validDate(u.expiresAt||u.expirationDate))?knownExpiring:null, low:available.length < r.threshold};
      }).filter(r => r.units.length);
    }
    return rows.sort((a,b) => filters.sort === 'name' ? String(a.name || a.institution || a.id).localeCompare(String(b.name || b.institution || b.id),'ar') : filters.sort === 'oldest' ? new Date(a[dateField] || 0) - new Date(b[dateField] || 0) : new Date(b[dateField] || 0) - new Date(a[dateField] || 0));
  }
  function groups(rows, field, weight = () => 1) {
    const totals = new Map();
    rows.forEach(row => {const label = String(row[field] || 'غير محدد'); totals.set(label,(totals.get(label)||0)+weight(row));});
    return [...totals].map(([label,value]) => ({label,value}));
  }
  function report(data, type, filters = {}) {
    const rows = filterRows(data,type,filters), sum = field => rows.reduce((n,r) => n+count(r[field]),0);
    let summary = [], chart = [], table = [];
    if (type === 'institutions') {
      summary = [['إجمالي المؤسسات',rows.length],['قيد المراجعة',rows.filter(r=>r.status==='pending').length],['معتمدة',rows.filter(r=>r.status==='approved').length],['مرفوضة',rows.filter(r=>r.status==='rejected').length]];
      chart = groups(rows,'status').map(g=>({...g,label:{pending:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض'}[g.label]||g.label}));
      table = groups(rows,'governorate');
    } else if (type === 'requests') {
      const completed = rows.filter(r=>r.status==='Completed');
      const timed = completed.filter(r=>validDate(r.createdAt)&&validDate(r.completedAt)&&new Date(r.completedAt)>=new Date(r.createdAt));
      const average = timed.length ? Math.round(timed.reduce((n,r)=>n+(new Date(r.completedAt)-new Date(r.createdAt)),0)/timed.length/60000) : null;
      summary = [['إجمالي الطلبات',rows.length],['طلبات مكتملة',completed.length],['قيد المعالجة',rows.filter(r=>['Accepted','Preparing','Ready','Sent'].includes(r.status)).length],['متوسط الإكمال بالدقائق',average ?? '—']];
      chart = groups(rows,'status').map(g=>({...g,label:requestLabels[g.label]||g.label})); table = groups(rows,'bloodType');
    } else if (type === 'inventory') {
      summary = [['وحدات متاحة',sum('available')],['وحدات محجوزة',sum('reserved')],['حالات نقص',rows.filter(r=>r.low).length],['تنتهي خلال 7 أيام',rows.some(r=>r.expiring===null)?'غير مسجل':sum('expiring')]];
      chart = bloodTypes.map(label=>({label,value:rows.filter(r=>r.bloodType===label).reduce((n,r)=>n+r.available,0)})); table = chart;
    } else if (type === 'donors') {
      summary = [['المتبرعون',rows.length],['متاحون',rows.filter(r=>r.available).length],['غير متاحين',rows.filter(r=>!r.available).length],['فصائل مسجلة',new Set(rows.map(r=>r.bloodType).filter(Boolean)).size]];
      chart = groups(rows,'bloodType'); table = groups(rows,'governorate');
    } else if (type === 'donations') {
      summary = [['تبرعات فعلية',rows.length],['من نداءات',rows.filter(r=>r.sourceType==='call').length],['من حملات',rows.filter(r=>r.sourceType==='campaign').length],['طوعية ومباشرة',rows.filter(r=>['direct','voluntary'].includes(r.sourceType)).length]];
      chart = groups(rows,'bloodType'); table = groups(rows.map(r=>({...r,month:r.completedAt.slice(0,7)})),'month');
    } else if (type === 'calls') {
      summary = [['إجمالي النداءات',rows.length],['نداءات نشطة',rows.filter(r=>['Active','Awaiting'].includes(r.status)).length],['استجابات مهتمة',sum('interested')],['دعوات مرسلة',rows.some(r=>r.invitations===null)?'غير مسجل':sum('invitations')]];
      chart = groups(rows,'bloodType'); table = groups(rows,'priority');
    } else if (type === 'campaigns') {
      summary = [['إجمالي الحملات',rows.length],['قادمة ونشطة',rows.filter(r=>['Upcoming','Active'].includes(r.status)).length],['مشاركون مسجلون',sum('participants')],['تبرعات فعلية',sum('donations')]];
      chart = groups(rows,'status').map(g=>({...g,label:campaignLabels[g.label]||g.label})); table = groups(rows,'governorate');
    }
    const breakdowns=[];
    if(type==='institutions'){
      breakdowns.push({title:'حسب نوع المؤسسة',items:groups(rows,'type')});
      breakdowns.push({title:'الخدمات المعتمدة',items:[{label:'طلب دم',value:rows.filter(r=>r.approvedServices.includes('blood_request')).length},{label:'بنك دم',value:rows.filter(r=>r.approvedServices.includes('blood_bank')).length},{label:'الخدمتان',value:rows.filter(r=>r.approvedServices.length===2).length}]});
    }else if(type==='requests'){
      breakdowns.push({title:'حسب المؤسسة الطالبة',items:groups(rows,'institution')});
      breakdowns.push({title:'حسب درجة الاستعجال',items:groups(rows,'priority')});
    }else if(type==='inventory'){
      breakdowns.push({title:'حالات وحدات الدم',items:[['متاحة','available'],['محجوزة','reserved'],['منتهية','expired'],['مسلّمة','delivered'],['مستبعدة','discarded']].map(([label,field])=>({label,value:sum(field)}))});
      breakdowns.push({title:'الوحدات المتاحة حسب البنك',items:groups(rows,'institution',r=>r.available)});
    }else if(type==='donations'){
      breakdowns.push({title:'التبرعات حسب المؤسسة',items:groups(rows,'institution')});
    }else if(type==='calls'){
      breakdowns.push({title:'حالة النداءات',items:groups(rows,'status').map(g=>({...g,label:callLabels[g.label]||g.label}))});
    }else if(type==='campaigns'){
      breakdowns.push({title:'المشاركون المسجلون',items:groups(rows,'name',r=>r.participants)});
      breakdowns.push({title:'التبرعات الفعلية',items:groups(rows,'name',r=>r.donations)});
    }
    return {type, rows, summary, chart, table, breakdowns, error:validRange(filters)};
  }
  const api = {bloodTypes, requestLabels, callLabels, campaignLabels, reportLabels, services, requestStatus, snapshot, matches, filterRows, validRange, groups, report};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QatraSupervisorData = api;
})(typeof window !== 'undefined' ? window : globalThis);
