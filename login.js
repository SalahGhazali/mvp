const form = document.querySelector('#login-form');
const password = document.querySelector('#login-password');
const loginId = document.querySelector('#login-id');
const toastElement = document.querySelector('#toast');
const demoAccountSelect = document.querySelector('#demo-account');

const demoRoleLabels = {
  donor: 'متبرعون',
  hospital: 'مستشفيات تطلب الدم',
  hospital_bloodbank: 'مستشفيات لديها بنك دم',
  bloodbank: 'بنوك الدم المركزية'
};

Object.entries(demoRoleLabels).forEach(([role, label]) => {
  const accounts = QatraAccounts.getAll().filter(account => account.isDemo && account.role === role);
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

demoAccountSelect.addEventListener('change', () => {
  const account = QatraAccounts.findById(demoAccountSelect.value);
  if (!account) return;
  loginId.value = account.email;
  password.value = account.password;
  showToast(`تم تعبئة بيانات ${account.organization || account.name}`);
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
  setTimeout(() => window.location.href = 'dashboard.html', 450);
});
