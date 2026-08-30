(function () {
  const STORAGE_KEY = 'qatraAccounts';
  const REMOVED_KEY = 'qatraRemovedAccounts';
  const BRIDGE_MARKER = 'qatra-local-session-v1';
  const CREATABLE_ROLES = ['donor', 'hospital', 'hospital_bloodbank', 'bloodbank'];
  const SYSTEM_ACCOUNTS = [
    {
      id: 'SYS-HEALTH-SUPERVISOR',
      role: 'supervisor',
      name: 'مشرف الصحة',
      email: 'supervisor@qatra.ps',
      phone: '0599000002',
      password: 'Health@123',
      organization: 'الجهة الصحية المشرفة',
      isPrimary: true,
      isSystem: true,
      status: 'active'
    }
  ];

  function readBridge() {
    try {
      const bridge = JSON.parse(window.name || 'null');
      return bridge?.marker === BRIDGE_MARKER ? bridge : null;
    } catch {
      return null;
    }
  }

  function writeBridge(changes) {
    const current = readBridge() || { marker: BRIDGE_MARKER, accounts: [], sessionId: null };
    window.name = JSON.stringify({ ...current, ...changes, marker: BRIDGE_MARKER });
  }

  function normalizeIdentifier(value = '') {
    const normalized = String(value).trim().toLowerCase();
    return normalized.includes('@') ? normalized : normalized.replace(/[\s-]/g, '');
  }

  function readRemovedIds() {
    try {
      const localIds = JSON.parse(localStorage.getItem(REMOVED_KEY) || '[]');
      const bridgeIds = readBridge()?.removedIds;
      return [...new Set([...(Array.isArray(localIds) ? localIds : []), ...(Array.isArray(bridgeIds) ? bridgeIds : [])])];
    } catch {
      return [];
    }
  }

  function accountTimestamp(account) {
    return new Date(account.updatedAt || account.createdAt || 0).getTime() || 0;
  }

  function isRetiredAccount(account) {
    return account?.id === 'SYS-QATRA-ADMIN' || account?.role === 'admin';
  }

  function getAll() {
    const bridge = readBridge();
    let localAccounts = [];
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      localAccounts = Array.isArray(saved) ? saved : [];
    } catch {}
    const removedIds = readRemovedIds();
    const merged = new Map();
    [...localAccounts, ...(Array.isArray(bridge?.accounts) ? bridge.accounts : [])].forEach(account => {
      if (!account?.id || removedIds.includes(account.id) || isRetiredAccount(account)) return;
      const existing = merged.get(account.id);
      if (!existing || accountTimestamp(account) >= accountTimestamp(existing)) merged.set(account.id, account);
    });
    const accounts = [...merged.values()];
    const retiredSession = isRetiredAccount({
      id: localStorage.getItem('qatraSessionAccount') || bridge?.sessionId,
      role: localStorage.getItem('qatraRole')
    });
    if (retiredSession) {
      localStorage.removeItem('qatraRole');
      localStorage.removeItem('qatraLoginId');
      localStorage.removeItem('qatraSessionAccount');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    writeBridge({ accounts, removedIds, ...(retiredSession ? { sessionId: null } : {}) });
    return accounts;
  }

  function saveAll(accounts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    writeBridge({ accounts, removedIds: readRemovedIds() });
  }

  function ensureSystemAccounts() {
    const accounts = getAll();
    let changed = false;
    SYSTEM_ACCOUNTS.forEach(systemAccount => {
      const index = accounts.findIndex(account =>
        account.id === systemAccount.id || normalizeIdentifier(account.email) === normalizeIdentifier(systemAccount.email)
      );
      if (index < 0) {
        accounts.push({ ...systemAccount, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        changed = true;
        return;
      }
      const existing = accounts[index];
      const synchronized = { ...existing, ...systemAccount, createdAt: existing.createdAt || new Date().toISOString(), updatedAt: existing.updatedAt || existing.createdAt || new Date().toISOString() };
      if (JSON.stringify(existing) !== JSON.stringify(synchronized)) {
        accounts[index] = synchronized;
        changed = true;
      }
    });
    if (changed) saveAll(accounts);
  }

  function demoInstitutionAccount(role, index, options) {
    const number = String(index).padStart(2, '0');
    const createdAt = `2026-08-${number}T09:00:00.000Z`;
    const organization = `${options.organizationPrefix} ${number}`;
    const email = `${options.emailPrefix}${number}@qatra.test`;
    const phone = `${options.phonePrefix}${String(index).padStart(4, '0')}`;
    const profile = {
      role,
      name: organization,
      institutionType: options.institutionType,
      scope: options.scope,
      license: `DEMO-${options.licensePrefix}-${number}`,
      address: `شارع المركز الطبي، ${options.governorate}`,
      governorate: options.governorate,
      phone,
      email,
      representativeName: `ممثل المؤسسة التجريبي ${number}`,
      representativeRole: 'الممثل الرسمي ومدير الحساب',
      representativePhone: phone,
      representativeEmail: email,
      documents: {
        license: { name: `license-${options.emailPrefix}${number}.pdf`, type: 'application/pdf', size: 245760 },
        authorization: { name: `authorization-${options.emailPrefix}${number}.pdf`, type: 'application/pdf', size: 184320 },
        quality: { name: `quality-${options.emailPrefix}${number}.pdf`, type: 'application/pdf', size: 204800 }
      }
    };
    return {
      id: `DEMO-${options.idPrefix}-${number}`,
      role,
      name: profile.representativeName,
      email,
      phone,
      password: options.password,
      organization,
      isPrimary: true,
      isDemo: true,
      institutionProfile: profile,
      approvalStatus: 'approved',
      rejectionCount: 0,
      rejectionReason: '',
      submittedAt: createdAt,
      reviewedAt: createdAt,
      reviewedBy: 'مشرف الصحة',
      status: 'active',
      createdAt,
      updatedAt: createdAt
    };
  }

  function buildDemoAccounts() {
    const governors = ['رام الله والبيرة', 'القدس', 'نابلس', 'الخليل', 'جنين', 'غزة', 'شمال غزة', 'دير البلح', 'خان يونس', 'رفح'];
    const donorNames = ['أحمد خالد', 'ليان محمود', 'محمد علي', 'نور سمير', 'يوسف إبراهيم', 'سارة عمر', 'آدم حسن', 'مريم ناصر', 'كريم جمال', 'هبة طارق'];
    const bloodTypes = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
    const donors = Array.from({ length: 10 }, (_, offset) => {
      const index = offset + 1;
      const number = String(index).padStart(2, '0');
      const createdAt = `2026-08-${number}T08:00:00.000Z`;
      return {
        id: `DEMO-DONOR-${number}`,
        role: 'donor',
        name: donorNames[offset],
        email: `donor${number}@qatra.test`,
        phone: `056100${String(index).padStart(4, '0')}`,
        password: 'Donor@123',
        organization: '',
        isPrimary: true,
        isDemo: true,
        identity: `900000${String(index).padStart(3, '0')}`,
        bloodType: bloodTypes[offset % bloodTypes.length],
        governorate: governors[offset],
        available: true,
        status: 'active',
        createdAt,
        updatedAt: createdAt
      };
    });
    const institutions = Array.from({ length: 10 }, (_, offset) => {
      const index = offset + 1;
      const governorate = governors[offset];
      return [
        demoInstitutionAccount('hospital', index, {
          idPrefix: 'HOSPITAL', emailPrefix: 'hospital', phonePrefix: '056200', password: 'Hospital@123',
          organizationPrefix: 'المستشفى التجريبي', institutionType: offset % 2 ? 'مستشفى ميداني' : 'مستشفى مركزي',
          scope: 'مؤسسة تطلب الدم فقط', licensePrefix: 'HOSP', governorate
        }),
        demoInstitutionAccount('hospital_bloodbank', index, {
          idPrefix: 'HOSPITAL-BANK', emailPrefix: 'hospitalbank', phonePrefix: '056300', password: 'HospitalBank@123',
          organizationPrefix: 'مستشفى بنك الدم التجريبي', institutionType: 'مستشفى مركزي',
          scope: 'مستشفى لديه بنك دم', licensePrefix: 'HBANK', governorate
        }),
        demoInstitutionAccount('bloodbank', index, {
          idPrefix: 'BLOOD-BANK', emailPrefix: 'bloodbank', phonePrefix: '056400', password: 'BloodBank@123',
          organizationPrefix: 'مركز الدم التجريبي', institutionType: offset % 2 ? 'جمعية بنك دم' : 'مركز دم مستقل',
          scope: 'بنك الدم المركزي', licensePrefix: 'BANK', governorate
        })
      ];
    }).flat();
    return [...donors, ...institutions];
  }

  function demoInventory(index, centralBank) {
    const increase = index % 5;
    const base = centralBank ? 20 : 12;
    return {
      'A+': base + 8 + increase,
      'A−': base + 2 + increase,
      'B+': base + 6 + increase,
      'B−': base + 1 + increase,
      'AB+': base + 3 + increase,
      'AB−': base - 2 + increase,
      'O+': base + 10 + increase,
      'O−': base + 4 + increase
    };
  }

  function ensureDemoData() {
    const demoAccounts = buildDemoAccounts();
    const removedIds = readRemovedIds();
    const accounts = getAll();
    let accountsChanged = false;
    demoAccounts.forEach(demoAccount => {
      const exists = accounts.some(account =>
        account.id === demoAccount.id || normalizeIdentifier(account.email) === normalizeIdentifier(demoAccount.email)
      );
      if (!exists && !removedIds.includes(demoAccount.id)) {
        accounts.push(demoAccount);
        accountsChanged = true;
      }
    });
    if (accountsChanged) saveAll(accounts);

    let inventory = {};
    try {
      inventory = JSON.parse(localStorage.getItem('qatraInventory') || '{}') || {};
    } catch {}
    let inventoryChanged = false;
    accounts.filter(account => account.isDemo && ['hospital_bloodbank', 'bloodbank'].includes(account.role)).forEach(account => {
      if (Object.prototype.hasOwnProperty.call(inventory, account.organization)) return;
      const index = Number(account.id.slice(-2));
      inventory[account.organization] = demoInventory(index, account.role === 'bloodbank');
      inventoryChanged = true;
    });
    if (inventoryChanged) localStorage.setItem('qatraInventory', JSON.stringify(inventory));
  }

  function create(data) {
    if (!CREATABLE_ROLES.includes(data.role)) {
      return { ok: false, error: 'نوع الحساب غير مسموح' };
    }
    const accounts = getAll();
    const email = String(data.email || '').trim().toLowerCase();
    const phone = String(data.phone || '').trim();
    const duplicate = accounts.some(account =>
      normalizeIdentifier(account.email) === normalizeIdentifier(email) ||
      normalizeIdentifier(account.phone) === normalizeIdentifier(phone)
    );
    if (duplicate) return { ok: false, error: 'البريد الإلكتروني أو رقم الجوال مستخدم في حساب آخر' };

    const account = {
      ...data,
      id: `ACC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email,
      phone,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    accounts.push(account);
    saveAll(accounts);
    return { ok: true, account };
  }

  function authenticate(identifier, password) {
    const normalized = normalizeIdentifier(identifier);
    return getAll().find(account =>
      account.status === 'active' &&
      (normalizeIdentifier(account.email) === normalized || normalizeIdentifier(account.phone) === normalized) &&
      account.password === password
    ) || null;
  }

  function findById(id) {
    return getAll().find(account => account.id === id) || null;
  }

  function setSession(account) {
    localStorage.setItem('qatraRole', account.role);
    localStorage.setItem('qatraLoginId', account.email || account.phone);
    localStorage.setItem('qatraSessionAccount', account.id);
    writeBridge({ accounts: getAll(), sessionId: account.id });
  }

  function getSession() {
    const bridge = readBridge();
    const sessionId = bridge ? bridge.sessionId : localStorage.getItem('qatraSessionAccount');
    if (!sessionId) return null;
    const account = findById(sessionId);
    if (account) {
      localStorage.setItem('qatraRole', account.role);
      localStorage.setItem('qatraLoginId', account.email || account.phone);
      localStorage.setItem('qatraSessionAccount', account.id);
    }
    return account;
  }

  function clearSession() {
    localStorage.removeItem('qatraRole');
    localStorage.removeItem('qatraLoginId');
    localStorage.removeItem('qatraSessionAccount');
    writeBridge({ accounts: getAll(), sessionId: null });
  }

  function update(id, changes) {
    const accounts = getAll();
    const index = accounts.findIndex(account => account.id === id);
    if (index < 0) return null;
    accounts[index] = { ...accounts[index], ...changes, updatedAt: new Date().toISOString() };
    saveAll(accounts);
    return accounts[index];
  }

  function removeByEmail(email, organization) {
    const accounts = getAll();
    const index = accounts.findIndex(account =>
      normalizeIdentifier(account.email) === normalizeIdentifier(email) && account.organization === organization && !account.isPrimary
    );
    if (index < 0) return false;
    const [removed] = accounts.splice(index, 1);
    const removedIds = [...new Set([...readRemovedIds(), removed.id])];
    localStorage.setItem(REMOVED_KEY, JSON.stringify(removedIds));
    writeBridge({ removedIds });
    saveAll(accounts);
    return true;
  }

  function removeInstitution(accountId) {
    const accounts = getAll();
    const primary = accounts.find(account => account.id === accountId && account.isPrimary && ['hospital', 'hospital_bloodbank', 'bloodbank'].includes(account.role));
    if (!primary) return false;
    const removed = accounts.filter(account => account.organization === primary.organization);
    const remaining = accounts.filter(account => account.organization !== primary.organization);
    const removedIds = [...new Set([...readRemovedIds(), ...removed.map(account => account.id)])];
    localStorage.setItem(REMOVED_KEY, JSON.stringify(removedIds));
    writeBridge({ removedIds });
    saveAll(remaining);
    return true;
  }

  function removeAccount(accountId) {
    const accounts = getAll();
    const index = accounts.findIndex(account => account.id === accountId && !account.isSystem);
    if (index < 0) return false;
    const [removed] = accounts.splice(index, 1);
    const removedIds = [...new Set([...readRemovedIds(), removed.id])];
    localStorage.setItem(REMOVED_KEY, JSON.stringify(removedIds));
    writeBridge({ removedIds });
    saveAll(accounts);
    return true;
  }

  window.QatraAccounts = { create, authenticate, findById, update, removeByEmail, removeInstitution, removeAccount, getAll, setSession, getSession, clearSession };
  ensureSystemAccounts();
  ensureDemoData();
})();
