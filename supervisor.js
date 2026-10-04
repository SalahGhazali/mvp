(function () {
  'use strict';
  const Data = window.QatraSupervisorData;
  const monitoredPages = ['dashboard','organizations','bloodbanks','inventory','requests','donors','donations','appeals','campaigns','reports','users','donation-requests'];
  const pageTypes = {organizations:'institutions', bloodbanks:'banks', inventory:'inventory', requests:'requests', donors:'donors', users:'donors', donations:'donations', 'donation-requests':'donations', appeals:'calls', campaigns:'campaigns'};
  const titles = {organizations:'متابعة المؤسسات الصحية', bloodbanks:'متابعة بنوك الدم', inventory:'متابعة المخزون', requests:'متابعة طلبات الدم', donors:'متابعة المتبرعين', users:'متابعة المتبرعين', donations:'التبرعات الفعلية', appeals:'متابعة نداءات التبرع', campaigns:'متابعة حملات التبرع', reports:'التقارير والإحصائيات'};
  const descriptions = {organizations:'حالات الاعتماد والخدمات المطلوبة والمعتمدة لكل مؤسسة.', bloodbanks:'بنوك الدم المعتمدة ومؤشرات توفر الوحدات والنقص.', inventory:'المخزون حسب البنك والفصيلة، مع فصل الوحدات المحجوزة والمنتهية.', requests:'متابعة حالة الطلب وتسلسلها من دون تغييرها.', donors:'الفصائل والمناطق والتوفر ونشاط التبرع باستخدام معرّفات المتبرعين.', donations:'العمليات المؤكدة فقط؛ الاستجابة للنداء أو التسجيل في حملة لا يُحسب تبرعًا.', appeals:'الدعوات والاستجابات والتبرعات مؤشرات مستقلة.', campaigns:'متابعة الحملات والمشاركين والتبرعات المسجلة فعليًا.', reports:'ملخص ورسوم وجداول تعتمد جميعها على الفلاتر نفسها.'};
  const settings = new Map();
  let currentPage = '', currentData = null, searchTimer;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => typeof value === 'number' ? value.toLocaleString('ar-PS') : esc(value ?? '—');
  const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('ar-PS',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'غير مسجل';
  const expiry=value=>value.expiring===null?(value.knownExpiring?`${number(value.knownExpiring)} موثق · بيانات ناقصة`:'غير مسجل'):number(value.expiring);
  const badge = (text, kind = 'blue') => `<span class="status ${kind}">${esc(text || 'غير محدد')}</span>`;
  const statusLabel = (row,type) => type==='institutions' ? ({pending:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض'}[row.status]||row.status) : (type==='requests'?Data.requestLabels:type==='calls'?Data.callLabels:Data.campaignLabels)[row.status] || 'حالة غير معروفة';
  const statusBadge = (row,type) => badge(statusLabel(row,type), /Completed|approved/.test(row.status)?'green':/Rejected|rejected|Cancelled|Expired/.test(row.status)?'gray':'amber');
  const services = values => values.length ? values.map(v=>badge(v==='blood_bank'?'بنك دم':'طلب دم')).join(' ') : '<span class="muted">لا توجد</span>';
  const detailButton = (type,id) => `<button class="secondary-btn supervisor-detail" data-supervisor="details" data-kind="${esc(type)}" data-id="${esc(id)}">التفاصيل</button>`;
  const card = (label,value,href='',hint='') => `${href?`<a href="${esc(href)}"`:'<article'} class="stat-card supervisor-stat"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${number(value)}</strong>${hint?`<small class="muted">${esc(hint)}</small>`:''}${href?'</a>':'</article>'}`;
  const panel = (title,body,description='') => `<article class="card supervisor-panel"><div class="card-head"><div><h3>${esc(title)}</h3>${description?`<p>${esc(description)}</p>`:''}</div></div>${body}</article>`;
  const empty = (title='لا توجد نتائج',message='لا توجد بيانات تطابق الفلاتر الحالية. جرّب إعادة ضبط الفلاتر.') => `<div class="empty"><div class="empty-icon">⌁</div><h3>${esc(title)}</h3><p class="muted">${esc(message)}</p></div>`;
  function permitted() {return window.QatraAccounts?.getSession()?.role === 'supervisor';}
  function read(key,fallback,warnings,label) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      if (Array.isArray(fallback) ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid data');
      if(Array.isArray(value)&&value.some(record=>!record||typeof record!=='object'||Array.isArray(record))){warnings.push(label);return value.filter(record=>record&&typeof record==='object'&&!Array.isArray(record));}
      return value;
    } catch {warnings.push(label);return fallback;}
  }
  function load() {
    const warnings = [];
    const input = {accounts:QatraAccounts.getAll(), warnings};
    [['requests','qatraRequests','طلبات الدم'],['calls','qatraAppeals','نداءات التبرع'],['voluntary','qatraVoluntaryDonationRequests','التبرع الطوعي'],['campaigns','qatraCampaigns','الحملات'],['donations','qatraDonations','سجل التبرعات'],['units','qatraBloodUnits','تفاصيل وحدات الدم'],['activity','qatraInstitutionActivity','سجل النشاط']].forEach(([field,key,label])=>input[field]=read(key,[],warnings,label));
    input.inventory = read('qatraInventory',{},warnings,'المخزون');
    input.settings = read('qatraInventorySettings',{},warnings,'إعدادات المخزون');
    return Data.snapshot(input);
  }
  function options(rows,field) {return [...new Set(rows.map(r=>r[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));}
  function select(label,key,values,filters,all='الكل') {
    return `<label class="supervisor-filter"><span>${esc(label)}</span><select name="${key}" class="filter-control"><option value="">${esc(all)}</option>${values.map(v=>{const [value,text]=Array.isArray(v)?v:[v,v];return `<option value="${esc(value)}" ${filters[key]===value?'selected':''}>${esc(text)}</option>`;}).join('')}</select></label>`;
  }
  function typeForPage() {return currentPage==='reports'?settings.get(currentPage).report:pageTypes[currentPage];}
  function filtersHtml(data,type,filters) {
    const rows = data[type] || [];
    let html = `<label class="supervisor-filter supervisor-search"><span>بحث</span><input class="filter-control" name="search" type="search" value="${esc(filters.search)}" placeholder="${type==='donors'?'معرّف المتبرع':type==='requests'?'رقم الطلب أو المؤسسة':'الاسم أو المعرّف'}"></label>`;
    if (['institutions','requests','calls','campaigns'].includes(type)) {
      const labels = type==='institutions'?{pending:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض'}:type==='requests'?Data.requestLabels:type==='calls'?Data.callLabels:Data.campaignLabels;
      html += select('الحالة','status',Object.entries(labels),filters);
    }
    html += select('المحافظة','governorate',options(rows,'governorate'),filters);
    if (type==='institutions') html += select('نوع المؤسسة','type',options(rows,'type'),filters)+select('الخدمة المعتمدة','service',[['blood_request','طلب دم'],['blood_bank','بنك دم']],filters);
    if (['requests','inventory','donors','donations','calls','campaigns'].includes(type)) html += select('فصيلة الدم','bloodType',Data.bloodTypes,filters);
    if (['requests','calls'].includes(type)) html += select('الاستعجال','priority',options(rows,'priority'),filters);
    if (['requests','inventory','donations','calls','campaigns'].includes(type)) html += select('المؤسسة','institution',options(rows,'institution'),filters);
    if (type==='requests') html += select('البنك المورّد','bank',options(rows,'bank'),filters);
    if (type==='donors') html += select('التوفر','available',[['true','متاح'],['false','غير متاح']],filters);
    if (type==='donations') html += select('مصدر التبرع','sourceType',[['call','نداء'],['campaign','حملة'],['voluntary','طوعي'],['direct','مباشر']],filters);
    if (type!=='banks') html += `<label class="supervisor-filter"><span>من تاريخ</span><input class="filter-control" type="date" name="from" value="${esc(filters.from)}"></label><label class="supervisor-filter"><span>إلى تاريخ</span><input class="filter-control" type="date" name="to" value="${esc(filters.to)}"></label>`;
    html += select('ترتيب','sort',[['newest','الأحدث'],['oldest','الأقدم'],['name','الاسم / المعرّف']],filters);
    return `<form id="supervisor-filters" class="supervisor-filters">${html}<div class="supervisor-filter-actions"><button class="primary-btn" type="submit">تطبيق</button><button class="secondary-btn" type="button" data-supervisor="reset">إعادة ضبط</button></div></form>`;
  }
  function chart(items) {
    if (!items.length || !items.some(i=>i.value>0)) return empty('لا توجد بيانات للرسم','يظهر التوزيع عند توفر بيانات تطابق الفلاتر.');
    const max = Math.max(1,...items.map(i=>i.value));
    return `<div class="supervisor-chart" role="list" aria-label="توزيع البيانات">${items.map(i=>`<div class="supervisor-chart-row" role="listitem"><span>${esc(i.label)}</span><div class="supervisor-chart-track"><span style="width:${Math.max(0,Math.min(100,i.value/max*100))}%"></span></div><strong>${number(i.value)}</strong></div>`).join('')}</div>`;
  }
  function table(headers,rows) {
    return `<div class="table-wrap"><table class="data-table supervisor-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function pagination(total,view) {
    const pages = Math.max(1,Math.ceil(total/10));
    view.page = Math.min(view.page,pages);
    return `<div class="supervisor-pagination"><span>${number(total)} نتيجة · صفحة ${number(view.page)} من ${number(pages)}</span><div><button class="secondary-btn" data-supervisor="previous" ${view.page<=1?'disabled':''}>السابق</button><button class="secondary-btn" data-supervisor="next" ${view.page>=pages?'disabled':''}>التالي</button></div></div>`;
  }
  function monitoringTable(type,rows) {
    const e = esc;
    if (type==='institutions') return table(['المؤسسة','النوع / المحافظة','الاعتماد','الخدمات المطلوبة','الخدمات المعتمدة','التسجيل',''],rows.map(r=>[e(r.name),`${e(r.type)}<small class="activity-actor-role">${e(r.governorate||'غير محدد')}</small>`,statusBadge(r,type),services(r.requestedServices),services(r.approvedServices),date(r.createdAt),detailButton(type,r.id)]));
    if (type==='banks') return table(['بنك الدم','المحافظة','وحدات متاحة','محجوزة','الفصائل المنخفضة','تنتهي خلال 7 أيام',''],rows.map(r=>[e(r.name),e(r.governorate||'غير محدد'),number(r.available),number(r.reserved),r.lowTypes.length?badge(r.lowTypes.join('، '),'red'):badge('مخزون متوفر','green'),expiry(r),detailButton(type,r.id)]));
    if (type==='inventory') return table(['بنك الدم','الفصيلة','متاحة','محجوزة','منتهية','مسلّمة','مستبعدة','تنتهي خلال 7 أيام','المخزون'],rows.map(r=>[e(r.institution),e(r.bloodType),number(r.available),number(r.reserved),number(r.expired),number(r.delivered),number(r.discarded),expiry(r),badge(r.low?'منخفض':'متوفر',r.low?'red':'green')]));
    if (type==='requests') return table(['رقم الطلب','المؤسسة الطالبة','البنك المورّد','الفصيلة','الوحدات','الاستعجال','موعد الحاجة','الحالة',''],rows.map(r=>[e(r.id),e(r.institution),e(r.bank),e(r.bloodType),number(r.units),e(r.priority),date(r.neededAt),statusBadge(r,type),detailButton(type,r.id)]));
    if (type==='donors') return table(['معرّف المتبرع','الفصيلة','المحافظة','التوفر','تبرعات فعلية','آخر تبرع'],rows.map(r=>[e(r.id),e(r.bloodType||'غير محدد'),e(r.governorate||'غير محدد'),badge(r.available?'متاح':'غير متاح',r.available?'green':'gray'),number(r.donationCount),date(r.lastDonationAt)]));
    if (type==='donations') return table(['معرّف التبرع','معرّف المتبرع','المؤسسة','الفصيلة','التاريخ','المصدر',''],rows.map(r=>[e(r.id),e(r.donorId),e(r.institution),e(r.bloodType),date(r.completedAt),e({call:'نداء',campaign:'حملة',voluntary:'طوعي',direct:'مباشر'}[r.sourceType]),detailButton(type,r.id)]));
    if (type==='calls') return table(['النداء','المؤسسة','الفصيلة / الوحدات','الاستعجال','الحالة','الدعوات','المهتمون','تبرعات فعلية',''],rows.map(r=>[e(r.id),e(r.institution),`${e(r.bloodType)} · ${number(r.units)}`,e(r.priority),statusBadge(r,type),number(r.invitations??'غير مسجل'),number(r.interested),number(r.donations),detailButton(type,r.id)]));
    if (type==='campaigns') return table(['الحملة','الجهة المنظمة','الموعد','الفصائل','الحالة','المسجلون','تبرعات فعلية',''],rows.map(r=>[e(r.name),e(r.institution),date(r.date),e(r.bloodTypes.join('، ')),statusBadge(r,type),number(r.participants),number(r.donations),detailButton(type,r.id)]));
    return '';
  }
  function notices(data) {
    return data.warnings.length?`<div class="privacy-note warning-note" role="alert"><span>!</span><div><strong>تعذر قراءة بعض البيانات</strong><small>${esc(data.warnings.join('، '))}. البيانات الأخرى متاحة. أعد المحاولة بعد تصحيح مصدر البيانات.</small></div><button class="secondary-btn" data-supervisor="refresh">إعادة المحاولة</button></div>`:'';
  }
  function dashboard(data) {
    const institutionCount = s=>data.institutions.filter(i=>i.status===s).length;
    const actual = data.donations.length, activeRequests=data.requests.filter(r=>['Accepted','Preparing','Ready','Sent'].includes(r.status)).length;
    const activeCalls=data.calls.filter(c=>['Active','Awaiting'].includes(c.status)).length;
    const activeCampaigns=data.campaigns.filter(c=>['Upcoming','Active'].includes(c.status)).length;
    const inventoryReport=Data.report(data,'inventory');
    const quick=[['approvals','مراجعة الاعتماد','✓'],['organizations','المؤسسات','⌂'],['bloodbanks','بنوك الدم','◉'],['requests','طلبات الدم','◫'],['donors','المتبرعون','♙'],['appeals','النداءات','♡'],['campaigns','الحملات','◷'],['reports','التقارير','⌁']];
    const stats=[['إجمالي المؤسسات',data.institutions.length,'organizations.html'],['قيد المراجعة',institutionCount('pending'),'organizations.html?status=pending'],['مؤسسات معتمدة',institutionCount('approved'),'organizations.html?status=approved'],['مؤسسات مرفوضة',institutionCount('rejected'),'organizations.html?status=rejected'],['خدمة طلب الدم',data.institutions.filter(i=>i.approvedServices.includes('blood_request')).length,'organizations.html?service=blood_request'],['خدمة بنك الدم',data.banks.length,'bloodbanks.html'],['المتبرعون المسجلون',data.donors.length,'donors.html'],['المتبرعون المتاحون',data.donors.filter(d=>d.available).length,'donors.html?available=true'],['إجمالي طلبات الدم',data.requests.length,'requests.html'],['طلبات بانتظار الاستجابة',data.requests.filter(r=>r.status==='Pending').length,'requests.html?status=Pending'],['طلبات قيد المعالجة',activeRequests,'requests.html'],['طلبات مكتملة',data.requests.filter(r=>r.status==='Completed').length,'requests.html?status=Completed'],['وحدات متاحة',data.inventory.reduce((n,r)=>n+r.available,0),'inventory.html'],['نداءات نشطة',activeCalls,'appeals.html'],['حملات قادمة ونشطة',activeCampaigns,'campaigns.html'],['تبرعات فعلية',actual,'donations.html']];
    const low=data.inventory.filter(r=>r.low);
    const recent=[...data.requests.map(r=>({id:r.id,institution:r.institution,kind:'طلب دم',status:statusLabel(r,'requests'),at:r.updatedAt,type:'requests'})),...data.calls.map(r=>({id:r.id,institution:r.institution,kind:'نداء تبرع',status:statusLabel(r,'calls'),at:r.createdAt,type:'calls'})),...data.donations.map(r=>({id:r.id,institution:r.institution,kind:'تبرع فعلي',status:'تم التبرع',at:r.completedAt,type:'donations'})),...data.institutions.filter(r=>r.reviewedAt||r.status==='pending').map(r=>({id:r.id,institution:r.name,kind:'اعتماد مؤسسة',status:statusLabel(r,'institutions'),at:r.reviewedAt||r.createdAt,type:'institutions'}))].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)).slice(0,8);
    return `${notices(data)}<div class="welcome"><div><h2>لوحة الإشراف الصحي</h2><p>رؤية شاملة للمؤسسات والمخزون والطلبات ونشاط التبرع.</p></div><button class="secondary-btn" data-supervisor="refresh">تحديث البيانات</button></div><nav class="supervisor-quick-actions" aria-label="الوصول السريع">${quick.map(([page,label,icon])=>`<a href="${page}.html"><span>${icon}</span>${label}</a>`).join('')}</nav><div class="stats-grid supervisor-stats">${stats.map(s=>card(...s)).join('')}</div><div class="dashboard-grid">${panel('المخزون المتاح حسب الفصيلة',chart(inventoryReport.chart),'تُحسب الوحدات المتاحة فقط.')}${panel('تنبيهات المخزون',low.length?`<ul class="supervisor-alert-list">${low.slice(0,6).map(r=>`<li><a href="bloodbanks.html?search=${encodeURIComponent(r.institution)}"><strong>${esc(r.institution)}</strong><span>${esc(r.bloodType)} · ${number(r.available)} وحدة متاحة</span></a></li>`).join('')}</ul><a class="supervisor-text-link" href="inventory.html">عرض جميع حالات النقص (${number(low.length)})</a>`:empty('لا توجد حالات نقص','المخزون الحالي فوق حد التنبيه.'),'يستخدم حد النقص المحفوظ؛ الافتراضي ينبه عند نفاد الفصيلة.')}</div><div class="dashboard-grid">${panel('حالة طلبات الدم',chart(Data.report(data,'requests').chart))}${panel('توزيع المتبرعين حسب الفصيلة',chart(Data.report(data,'donors').chart))}</div>${panel('أحدث الأنشطة المهمة',recent.length?table(['النشاط','المرجع','المؤسسة','الحالة','التاريخ',''],recent.map(r=>[esc(r.kind),esc(r.id),esc(r.institution),esc(r.status),date(r.at),detailButton(r.type,r.id)])):empty('لا توجد أنشطة بعد','ستظهر العمليات عند استخدام المنصة.'))}<p class="supervisor-updated">آخر تحديث: ${date(data.now)}</p>`;
  }
  function results(data,type,view) {
    const error=Data.validRange(view.filters);
    if (error) return `<div class="privacy-note warning-note" role="alert">${esc(error)}</div>`;
    const report=Data.report(data,type,view.filters),rows=report.rows;
    if (currentPage==='reports') {
      const privacy='<p class="supervisor-privacy">تعرض التقارير بيانات مجمعة لحماية معلومات المتبرعين.</p>';
      const undated=type==='inventory'&&(view.filters.from||view.filters.to)?'<div class="privacy-note"><span>i</span><div><small>فترة المخزون تعتمد على تاريخ جمع الوحدة. الإجماليات القديمة التي لا تحمل تواريخ لا تدخل في نتائج هذه الفترة.</small></div></div>':'';
      return `${undated}<div class="stats-grid">${report.summary.map(([label,value])=>card(label,value)).join('')}</div>${rows.length?`<div class="dashboard-grid">${panel('توزيع النتائج',chart(report.chart))}${panel('جدول التقرير المجمّع',table(['التصنيف',type==='inventory'?'وحدات متاحة':'العدد'],report.table.map(r=>[esc(r.label),number(r.value)])))}</div><div class="dashboard-grid">${report.breakdowns.map(group=>panel(group.title,chart(group.items))).join('')}</div>`:panel('نتائج التقرير',empty('لا توجد بيانات للتقرير'))}${privacy}`;
    }
    let summary=report.summary.length?`<div class="stats-grid">${report.summary.map(([label,value])=>card(label,value)).join('')}</div>`:'';
    if (type==='banks') summary=`<div class="stats-grid">${card('بنوك الدم',rows.length)}${card('وحدات متاحة',rows.reduce((n,r)=>n+r.available,0))}${card('بنوك بها نقص',rows.filter(r=>r.lowTypes.length).length)}${card('تنتهي خلال 7 أيام',rows.some(r=>r.expiring===null)?'غير مسجل':rows.reduce((n,r)=>n+r.expiring,0))}</div>`;
    if (type==='requests') summary+=`<div class="supervisor-status-counts">${Object.entries(Data.requestLabels).map(([s,label])=>`<span>${esc(label)} <b>${number(rows.filter(r=>r.status===s).length)}</b></span>`).join('')}</div>`;
    if (type==='donors') summary+=`<div class="dashboard-grid">${panel('حسب الفصيلة',chart(Data.groups(rows,'bloodType')))}${panel('حسب المحافظة',chart(Data.groups(rows,'governorate')))}</div><p class="supervisor-privacy">التوفر هو اختيار المتبرع، ولا يعبّر عن أهليته الطبية. تعرض هذه الصفحة المعرّف فقط دون بيانات الاتصال.</p>`;
    if (type==='campaigns'&&!data.campaigns.length) summary+='<p class="supervisor-privacy">لا توجد حملات محفوظة في هذه النسخة بعد. ستظهر هنا عند توفر سجلات حملات؛ التسجيل وحده لا يُحسب تبرعًا.</p>';
    if (['banks','inventory'].includes(type)&&data.inventory.some(r=>!r.detailed)) summary+='<p class="supervisor-privacy">المخزون القديم محفوظ كإجماليات دون تواريخ انتهاء؛ تظهر بيانات الانتهاء «غير مسجل» حتى تتوفر سجلات الوحدات.</p>';
    const pager=pagination(rows.length,view),visible=rows.slice((view.page-1)*10,view.page*10);
    return `${summary}${panel('السجلات المطابقة',rows.length?monitoringTable(type,visible)+pager:empty())}`;
  }
  function initialView(page) {
    const query=new URLSearchParams(location.search), filters={sort:'newest'};
    ['status','service','available','search','bloodType','governorate','institution','bank','from','to'].forEach(k=>{if(query.has(k))filters[k]=query.get(k);});
    if(page==='donation-requests')filters.sourceType='voluntary';
    return {page:1, report:Data.reportLabels[query.get('report')]?query.get('report'):'institutions',filters};
  }
  function render(page) {
    if (!monitoredPages.includes(page)) return null;
    if (!permitted()) return empty('الوصول غير مسموح','هذه الصفحات متاحة لمشرف الجهة الصحية فقط.');
    currentPage=page;
    if (!settings.has(page)) settings.set(page,initialView(page));
    try {
      currentData=load();
      if(page==='dashboard') return `<div class="supervisor-workspace">${dashboard(currentData)}</div>`;
      const view=settings.get(page),type=typeForPage();
      const tabs=page==='reports'?`<nav class="supervisor-report-tabs" aria-label="أنواع التقارير">${Object.entries(Data.reportLabels).map(([id,label])=>`<button class="${view.report===id?'active':''}" data-supervisor="report" data-report="${id}" aria-pressed="${view.report===id}">${esc(label)}</button>`).join('')}</nav>`:'';
      return `<div class="supervisor-workspace"><div class="page-heading"><div><h2>${esc(titles[page]||titles.donations)}</h2><p>${esc(descriptions[page]||descriptions.donations)}</p></div><div class="button-row"><button class="secondary-btn" data-supervisor="refresh">تحديث</button>${page==='reports'?'<button class="primary-btn" data-supervisor="export">تصدير CSV</button>':''}</div></div>${notices(currentData)}${tabs}${filtersHtml(currentData,type,view.filters)}<div id="supervisor-results" aria-live="polite">${results(currentData,type,view)}</div><p class="supervisor-updated">آخر تحديث: ${date(currentData.now)}</p></div>`;
    } catch {return `<div class="supervisor-workspace">${empty('تعذر تحميل البيانات','أعد المحاولة لتحميل البيانات المحلية.')}<button class="primary-btn" data-supervisor="refresh">إعادة المحاولة</button></div>`;}
  }
  function updateResults() {
    if (!permitted()) return;
    const form=document.querySelector('#supervisor-filters');
    if(!form) return;
    const view=settings.get(currentPage);
    view.filters=Object.fromEntries(new FormData(form));
    document.querySelector('#supervisor-results').innerHTML=results(currentData,typeForPage(),view);
  }
  function refreshPage() {
    if (!permitted()) return;
    const content=document.querySelector('#page-content');
    const scroll=window.scrollY;
    content.innerHTML=render(currentPage);
    window.scrollTo(0,scroll);
  }
  function fields(items) {return `<dl class="supervisor-detail-grid">${items.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value ?? 'غير مسجل')}</dd></div>`).join('')}</dl>`;}
  function details(type,id) {
    if(!permitted()) return;
    const data=load(),row=(data[type]||[]).find(r=>r.id===id);
    if(!row){toast('السجل غير موجود أو لم يعد متاحًا');return;}
    let body='',title='تفاصيل السجل';
    if(type==='institutions'||type==='banks') {
      title=row.name;
      body=fields([['معرّف المؤسسة',row.id],['نوع المؤسسة',row.type],['المحافظة',row.governorate],['العنوان',row.address],['الاعتماد',statusLabel(row,'institutions')],['تاريخ التسجيل',date(row.createdAt)],['تاريخ الاعتماد / الرفض',date(row.reviewedAt)],['آخر تحديث',date(row.updatedAt)]])+`<div class="supervisor-service-details"><strong>الخدمات المطلوبة</strong>${services(row.requestedServices)}<strong>الخدمات المعتمدة</strong>${services(row.approvedServices)}</div>`;
      if(row.status==='pending') body+=`<div class="modal-actions"><button class="primary-btn" data-action="review-approval" data-id="${esc(row.id)}">فتح طلب الاعتماد</button></div>`;
      if(type==='banks') body+=monitoringTable('inventory',data.inventory.filter(r=>r.bankId===row.id));
    } else if(type==='requests') {
      title=`تفاصيل الطلب ${row.id}`;
      body=fields([['المؤسسة الطالبة',row.institution],['البنك المورّد',row.bank],['الفصيلة',row.bloodType],['الوحدات',row.units],['الاستعجال',row.priority],['موعد الحاجة',date(row.neededAt)],['الحالة',statusLabel(row,type)],['آخر تحديث',date(row.updatedAt)],['اكتمال الطلب',date(row.completedAt)]]);
      const history=row.history.length?row.history:Object.entries(row.timestamps).filter(([,at])=>at).map(([s,at])=>({status:s,at}));
      body+=`<h3 class="section-subtitle">تسلسل حالة الطلب</h3>${history.length?`<ol class="supervisor-timeline">${[...history].sort((a,b)=>new Date(a.at)-new Date(b.at)).map(h=>`<li><strong>${esc(Data.requestLabels[h.status]||h.status)}</strong><span>${date(h.at)}</span></li>`).join('')}</ol>`:empty('لا يوجد تسلسل محفوظ','السجلات القديمة قد لا تتضمن تاريخ كل مرحلة.')}<p class="supervisor-privacy">تغيير حالة الطلب يتم عبر المؤسسة والبنك ضمن دورة العمل المعتمدة.</p>`;
    } else if(type==='donations') {
      title=`تبرع فعلي ${row.id}`;
      body=fields([['معرّف المتبرع',row.donorId],['المؤسسة',row.institution],['الفصيلة',row.bloodType],['تاريخ التبرع',date(row.completedAt)],['نوع المصدر',{call:'نداء',campaign:'حملة',voluntary:'طوعي',direct:'مباشر'}[row.sourceType]],['المرجع المرتبط',row.sourceId],['وحدة الدم المرتبطة',row.unitId||'غير مسجل']]);
    } else if(type==='calls') {
      title=`نداء التبرع ${row.id}`;
      body=fields([['المؤسسة',row.institution],['الفصيلة',row.bloodType],['الوحدات المطلوبة',row.units],['الاستعجال',row.priority],['مكان التبرع',row.location],['موعد الحاجة',date(row.neededAt)],['الحالة',statusLabel(row,type)],['الدعوات المسجلة',row.invitations??'غير مسجل'],['استجابات مهتمة',row.interested],['تبرعات فعلية',row.donations]]);
    } else if(type==='campaigns') {
      title=row.name;
      body=fields([['معرّف الحملة',row.id],['الجهة المنظمة',row.institution],['المحافظة',row.governorate],['المكان',row.location],['الموعد',date(row.date)],['الفصائل',row.bloodTypes.join('، ')],['الحالة',statusLabel(row,type)],['مشاركون مسجلون',row.participants],['تبرعات فعلية',row.donations]]);
    }
    showCustomModal(title,'متابعة إشرافية',body);
  }
  function exportCsv() {
    if(!permitted()) return;
    const view=settings.get('reports'),report=Data.report(load(),view.report,view.filters);
    if(report.error){toast(report.error);return;}
    if(!report.rows.length){toast('لا توجد بيانات لتصديرها');return;}
    const cell=value=>`"${String(value??'').replace(/^\s*[=+@\-\t\r\n]/,"'").replace(/"/g,'""')}"`;
    const breakdownRows=report.breakdowns.flatMap(group=>[[],[group.title,'العدد'],...group.items.map(r=>[r.label,r.value])]);
    const csv=[['التقرير',Data.reportLabels[view.report]],['من تاريخ',view.filters.from||'الكل'],['إلى تاريخ',view.filters.to||'الكل'],...report.summary,[],['التصنيف',view.report==='inventory'?'وحدات متاحة':'العدد'],...report.table.map(r=>[r.label,r.value]),...breakdownRows].map(r=>r.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download=`qatra-${view.report}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('تم تصدير التقرير المصفّى');
  }
  document.addEventListener('submit',event=>{if(event.target.id!=='supervisor-filters')return;event.preventDefault();settings.get(currentPage).page=1;updateResults();});
  document.addEventListener('change',event=>{if(!event.target.closest('#supervisor-filters'))return;settings.get(currentPage).page=1;updateResults();});
  document.addEventListener('input',event=>{if(event.target.name!=='search'||!event.target.closest('#supervisor-filters'))return;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{settings.get(currentPage).page=1;updateResults();},180);});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-supervisor]');
    if(!button||!permitted())return;
    const action=button.dataset.supervisor,view=settings.get(currentPage);
    if(action==='details')details(button.dataset.kind,button.dataset.id);
    else if(action==='refresh')refreshPage();
    else if(action==='reset'){view.filters={sort:'newest'};view.page=1;refreshPage();}
    else if(action==='report'&&Data.reportLabels[button.dataset.report]){view.report=button.dataset.report;view.filters={sort:'newest'};view.page=1;refreshPage();}
    else if(action==='previous'||action==='next'){view.page=Math.max(1,view.page+(action==='next'?1:-1));updateResults();}
    else if(action==='export')exportCsv();
  });
  window.QatraSupervisorUI={render,details,monitoredPages};
})();
