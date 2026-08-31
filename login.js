const form = document.querySelector('#login-form');
const password = document.querySelector('#login-password');
const loginId = document.querySelector('#login-id');
const toastElement = document.querySelector('#toast');
const demoAccountSelect = document.querySelector('#demo-account');
const demoCredentialsList = document.querySelector('#demo-credentials-list');
const roleFolder = role => ({donor: 'donor', hospital: 'hospital', hospital_bloodbank: 'hospital-bloodbank', bloodbank: 'bloodbank', supervisor: 'supervisor'}[role] || 'donor');

const demoRoleLabels = {
  supervisor: 'مشرف الصحة',
  donor: 'متبرعون',
  hospital: 'مستشفيات تطلب الدم',
  hospital_bloodbank: 'مستشفيات لديها بنك دم',
  bloodbank: 'بنوك الدم المركزية'
};

Object.entries(demoRoleLabels).forEach(([role, label]) => {
  const accounts = QatraAccounts.getAll().filter(account => (account.isDemo || account.isSystem) && account.role === role);
  if (!accounts.length) return;
  const group = document.createElement('optgroup');
  group.label = label;
  accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = `${account.organization || account.name} — ${account.email}`;
    group.appendChild(option);
  });
  demoAccountSelect.appendChild(group);
});

function fillDemoAccount(account) {
  if (!account) return;
  loginId.value = account.email;
  password.value = account.password;
  demoAccountSelect.value = account.id;
  showToast(`تم تعبئة بيانات ${account.organization || account.name}`);
}

demoAccountSelect.addEventListener('change', () => {
  fillDemoAccount(QatraAccounts.findById(demoAccountSelect.value));
});

const quickDemoAccounts = Object.keys(demoRoleLabels)
  .map(role => QatraAccounts.getAll().find(account => (account.isDemo || account.isSystem) && account.role === role))
  .filter(Boolean);

quickDemoAccounts.forEach(account => {
  const row = document.createElement('article');
  row.className = 'demo-credential-row';
  row.innerHTML = `<div><strong>${demoRoleLabels[account.role]}</strong><span dir="ltr">${account.email}</span><small dir="ltr">${account.password}</small></div><button type="button" class="demo-use-btn" data-account-id="${account.id}">استخدام</button>`;
  demoCredentialsList.appendChild(row);
});

demoCredentialsList.addEventListener('click', event => {
  const button = event.target.closest('[data-account-id]');
  if (button) fillDemoAccount(QatraAccounts.findById(button.dataset.accountId));
});

function showToast(message, error = false) {
  toastElement.textContent = `${error ? '!' : '✓'}  ${message}`;
  toastElement.classList.toggle('error-toast', error);
  toastElement.classList.add('show');
  setTimeout(() => toastElement.classList.remove('show'), 2200);
}

document.querySelector('.password-toggle').addEventListener('click', () => {
  password.type = password.type === 'password' ? 'text' : 'password';
});

document.querySelector('#forgot-password').addEventListener('click', () => {
  showToast('استعادة كلمة المرور غير متاحة حاليًا', true);
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const account = QatraAccounts.authenticate(loginId.value, password.value);
  if (!account) {
    showToast('البريد أو رقم الجوال أو كلمة المرور غير صحيحة', true);
    return;
  }
  QatraAccounts.setSession(account);
  showToast('تم تسجيل الدخول بنجاح');
  setTimeout(() => window.location.href = `${roleFolder(account.role)}/dashboard.html`, 450);
});
