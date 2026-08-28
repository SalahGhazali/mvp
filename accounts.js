(function () {
  const STORAGE_KEY = 'qatraAccounts';
  const REMOVED_KEY = 'qatraRemovedAccounts';
  const BRIDGE_MARKER = 'qatra-local-session-v1';
  const SYSTEM_ACCOUNTS = [
    {
      id: 'SYS-QATRA-ADMIN',
      role: 'admin',
      name: 'إدارة قطرة',
      email: 'admin@qatra.ps',
      phone: '0599000001',
      password: 'Admin@123',
      organization: 'إدارة قطرة',
      isPrimary: true,
      isSystem: true,
      status: 'active'
    },
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
      if (!account?.id || removedIds.includes(account.id)) return;
      const existing = merged.get(account.id);
      if (!existing || accountTimestamp(account) >= accountTimestamp(existing)) merged.set(account.id, account);
    });
    const accounts = [...merged.values()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    writeBridge({ accounts, removedIds });
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

  function create(data) {
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
})();
