const form = document.querySelector('#login-form');
const password = document.querySelector('#login-password');
const loginId = document.querySelector('#login-id');
const toastElement = document.querySelector('#toast');

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
