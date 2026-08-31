const form = document.querySelector('#register-form');
const toastElement = document.querySelector('#toast');
const progressElement = document.querySelector('#register-progress');
const steps = [...document.querySelectorAll('[data-step]')];

const flows = {
  donor: ['choose', 'donor-data', 'donor-verify'],
  institution: ['choose', 'institution-data', 'institution-services', 'institution-verify']
};

const stepLabels = {
  choose: 'اختيار المسار',
  'donor-data': 'بيانات المتبرع',
  'donor-verify': 'التحقق',
  'institution-data': 'بيانات المؤسسة',
  'institution-services': 'الخدمات والوثائق',
  'institution-verify': 'إرسال الطلب'
};

const serviceGroups = {
  blood_request_only: ['طلب الدم من مستشفى لديه بنك دم', 'طلب الدم من بنك الدم المركزي', 'متابعة حالة الطلب', 'تأكيد استلام وحدات الدم'],
  hospital_blood_bank: ['استقبال المتبرعين وتسجيل تبرعاتهم', 'إرسال نداءات التبرع للمتبرعين', 'طلب الدم من بنك الدم المركزي', 'إدارة مخزون وحدات الدم', 'استقبال طلبات المؤسسات التي لا تملك بنك دم', 'تجهيز وحدات الدم وتسليمها'],
  central_blood_bank: ['استقبال المتبرعين وتسجيل تبرعاتهم', 'إرسال نداءات التبرع للمتبرعين', 'إدارة المخزون المركزي', 'استقبال طلبات الدم من المستشفيات', 'تجهيز وحدات الدم وإرسالها للمستشفيات']
};

let currentPath = null;
let currentStep = 'choose';

function showToast(message, error = false) {
  toastElement.textContent = `${error ? '!' : '✓'}  ${message}`;
  toastElement.classList.toggle('error-toast', error);
  toastElement.classList.add('show');
  setTimeout(() => toastElement.classList.remove('show'), 2600);
}

function normalizeAccountIdentifier(value = '') {
  const normalized = String(value).trim().toLowerCase();
  return normalized.includes('@') ? normalized : normalized.replace(/[\s-]/g, '');
}

function accountAlreadyExists(email, phone) {
  const normalizedEmail = normalizeAccountIdentifier(email);
  const normalizedPhone = normalizeAccountIdentifier(phone);
  return QatraAccounts.getAll().some(account =>
    normalizeAccountIdentifier(account.email) === normalizedEmail ||
    normalizeAccountIdentifier(account.phone) === normalizedPhone
  );
}

function currentFlow() {
  return currentPath ? flows[currentPath] : ['choose'];
}

function renderProgress() {
  const flow = currentFlow();
  const currentIndex = Math.max(0, flow.indexOf(currentStep));
  progressElement.innerHTML = flow.map((step, index) => `
    <div class="progress-step ${index <= currentIndex ? 'active' : ''}">
      <b>${index < currentIndex ? '✓' : index + 1}</b><span>${stepLabels[step]}</span>
    </div>${index < flow.length - 1 ? `<i class="${index < currentIndex ? 'active' : ''}"></i>` : ''}
  `).join('');
}

function goTo(step) {
  currentStep = step;
  steps.forEach(section => section.classList.toggle('active', section.dataset.step === step));
  renderProgress();
  document.querySelector('.register-content').scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function choosePath(path) {
  currentPath = path;
  localStorage.setItem('qatraRegisterPath', path);
  document.querySelector('#aside-title').textContent = path === 'donor' ? 'تبرعك قد يمنح شخصًا فرصة جديدة للحياة.' : 'اربط مؤسستك بمنظومة الدم الوطنية.';
  document.querySelector('#aside-copy').textContent = path === 'donor' ? 'سجّل بياناتك لتصلك النداءات المتوافقة مع فصيلتك وموقعك.' : 'سجّل بيانات المؤسسة، حدد خدماتها، وارفع الوثائق المطلوبة للاعتماد.';
  goTo(path === 'donor' ? 'donor-data' : 'institution-data');
}

function requiredInputs(sectionName) {
  return [...document.querySelector(`[data-step="${sectionName}"]`).querySelectorAll('input[required], select[required]')];
}

function validateStep(step) {
  const inputs = requiredInputs(step);
  const invalid = inputs.find(input => !input.checkValidity());
  if (invalid) {
    invalid.reportValidity();
    invalid.focus();
    showToast('يرجى تعبئة جميع الحقول المطلوبة بصورة صحيحة', true);
    return false;
  }

  if (step === 'donor-data') {
    const identity = form.elements.donorIdentity.value.replace(/\D/g, '');
    if (identity.length < 9) {
      form.elements.donorIdentity.focus();
      showToast('يرجى إدخال رقم هوية صحيح مكوّن من 9 أرقام على الأقل', true);
      return false;
    }
    if (form.elements.donorPassword.value !== form.elements.donorConfirm.value) {
      form.elements.donorConfirm.focus();
      showToast('كلمة المرور وتأكيدها غير متطابقين', true);
      return false;
    }
    if (accountAlreadyExists(form.elements.donorEmail.value, form.elements.donorPhone.value)) {
      form.elements.donorEmail.focus();
      showToast('البريد الإلكتروني أو رقم الجوال مستخدم في حساب آخر', true);
      return false;
    }
  }

  if (step === 'institution-data') {
    if (form.elements.institutionPassword.value !== form.elements.institutionConfirm.value) {
      form.elements.institutionConfirm.focus();
      showToast('كلمة المرور وتأكيدها غير متطابقين', true);
      return false;
    }
    if (accountAlreadyExists(form.elements.institutionEmail.value, form.elements.institutionPhone.value)) {
      form.elements.institutionEmail.focus();
      showToast('البريد الإلكتروني أو رقم الجوال مستخدم في حساب آخر', true);
      return false;
    }
  }

  if (step === 'institution-services') {
    const oversized = [...document.querySelectorAll('.document-upload input')].find(input => input.files[0]?.size > 5 * 1024 * 1024);
    if (oversized) {
      oversized.value = '';
      showToast('حجم الوثيقة يجب ألا يتجاوز 5MB', true);
      return false;
    }
  }
  return true;
}

function updateServiceDetails(value) {
  const container = document.querySelector('#service-details');
  const grid = container.querySelector('.service-check-grid');
  if (!value) {
    container.classList.add('hidden');
    return;
  }
  grid.innerHTML = serviceGroups[value].map(service => `<span><i>✓</i>${service}</span>`).join('');
  container.classList.remove('hidden');
}

document.querySelectorAll('[data-choose-path]').forEach(button => {
  button.addEventListener('click', () => choosePath(button.dataset.choosePath));
});

document.querySelectorAll('[data-next]').forEach(button => {
  button.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    goTo(button.dataset.next);
  });
});

document.querySelectorAll('[data-back]').forEach(button => {
  button.addEventListener('click', () => {
    const flow = currentFlow();
    goTo(flow[Math.max(0, flow.indexOf(currentStep) - 1)]);
  });
});

document.querySelectorAll('input[name="serviceScope"]').forEach(input => {
  input.addEventListener('change', () => updateServiceDetails(input.value));
});

document.querySelectorAll('.document-upload input').forEach(input => {
  input.addEventListener('change', () => {
    const label = input.closest('.document-upload');
    const button = label.querySelector('b');
    const file = input.files[0];
    label.classList.toggle('has-file', Boolean(file));
    button.textContent = file ? file.name : 'اختيار ملف';
  });
});

document.querySelectorAll('.otp-inputs').forEach(group => {
  const inputs = [...group.querySelectorAll('input')];
  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      if (input.value) inputs[index + 1]?.focus();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value) inputs[index - 1]?.focus();
    });
  });
});

document.querySelectorAll('[data-verify]').forEach(button => {
  button.addEventListener('click', () => {
    const code = [...button.closest('[data-step]').querySelectorAll('.otp-inputs input')].map(input => input.value).join('');
    if (code.length !== 4) {
      showToast('يرجى إدخال رمز التحقق المكوّن من 4 أرقام', true);
      return;
    }
    let role = 'donor';
    let profileToSave = null;
    let accountData;
    if (currentPath === 'institution') {
      const scope = form.elements.serviceScope.value;
      role = scope === 'central_blood_bank' ? 'bloodbank' : scope === 'hospital_blood_bank' ? 'hospital_bloodbank' : 'hospital';
      const scopeLabels = {blood_request_only:'مؤسسة تطلب الدم فقط',hospital_blood_bank:'مستشفى لديه بنك دم',central_blood_bank:'بنك الدم المركزي'};
      const documentMeta = input => {
        const file = input?.files?.[0];
        return file ? { name: file.name, type: file.type || 'غير محدد', size: file.size } : null;
      };
      profileToSave = {
        role,
        name: form.elements.institutionName.value.trim(),
        institutionType: form.elements.institutionType.selectedOptions[0].textContent,
        scope: scopeLabels[scope],
        license: form.elements.licenseNumber.value.trim(),
        address: form.elements.institutionAddress.value.trim(),
        governorate: form.elements.institutionGovernorate.value,
        phone: form.elements.institutionPhone.value.trim(),
        email: form.elements.institutionEmail.value.trim(),
        representativeName: form.elements.representativeName.value.trim(),
        representativeRole: 'الممثل الرسمي ومدير الحساب',
        representativePhone: form.elements.institutionPhone.value.trim(),
        representativeEmail: form.elements.institutionEmail.value.trim(),
        documents: {
          license: documentMeta(form.elements.licenseDocument),
          authorization: documentMeta(form.elements.authorizationDocument),
          quality: documentMeta(form.elements.qualityDocument)
        }
      };
      accountData = {
        role,
        name: profileToSave.representativeName,
        email: profileToSave.representativeEmail,
        phone: profileToSave.representativePhone,
        password: form.elements.institutionPassword.value,
        organization: profileToSave.name,
        isPrimary: true,
        institutionProfile: profileToSave,
        approvalStatus: 'pending',
        rejectionCount: 0,
        rejectionReason: '',
        submittedAt: new Date().toISOString()
      };
    } else {
      accountData = {
        role: 'donor',
        name: form.elements.donorName.value.trim(),
        email: form.elements.donorEmail.value.trim(),
        phone: form.elements.donorPhone.value.trim(),
        password: form.elements.donorPassword.value,
        organization: '',
        isPrimary: true,
        identity: form.elements.donorIdentity.value.replace(/\D/g, ''),
        bloodType: form.elements.donorBlood.value,
        governorate: form.elements.donorGovernorate.value
      };
    }
    const created = QatraAccounts.create(accountData);
    if (!created.ok) {
      showToast(created.error, true);
      return;
    }
    if (profileToSave) localStorage.setItem('qatraInstitutionProfile', JSON.stringify(profileToSave));
    else localStorage.setItem('qatraDonorProfile', JSON.stringify(accountData));
    QatraAccounts.setSession(created.account);
    localStorage.removeItem('qatraRegisterPath');
    showToast(profileToSave ? 'تم إرسال طلب المؤسسة إلى مشرف الصحة للمراجعة' : 'تم إنشاء الحساب وتسجيل الدخول بنجاح');
    const folder = {donor: 'donor', hospital: 'hospital', hospital_bloodbank: 'hospital-bloodbank', bloodbank: 'bloodbank'}[created.account.role] || 'donor';
    setTimeout(() => window.location.href = `${folder}/dashboard.html`, 700);
  });
});

document.querySelectorAll('[data-resend]').forEach(button => button.addEventListener('click', () => showToast('تم إرسال رمز تحقق جديد')));

const requestedPath = new URLSearchParams(location.search).get('type');
if (requestedPath === 'donor' || requestedPath === 'institution') choosePath(requestedPath);
else renderProgress();
