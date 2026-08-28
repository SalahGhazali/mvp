const menuButton = document.querySelector('#public-menu-btn');
const header = document.querySelector('.public-header');

menuButton.addEventListener('click', () => header.classList.toggle('menu-open'));

document.querySelectorAll('.public-nav a').forEach(link => {
  link.addEventListener('click', () => header.classList.remove('menu-open'));
});

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function averageResponseMinutes(requests) {
  const durations = requests
    .filter(request => request.createdAt && request.receivedAt)
    .map(request => new Date(request.receivedAt) - new Date(request.createdAt))
    .filter(duration => duration >= 0);
  if (!durations.length) return 0;
  const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return Math.max(0, Math.round(average / 60000));
}

function renderLandingStats() {
  const accounts = (window.QatraAccounts ? window.QatraAccounts.getAll() : []);
  const requests = readList('qatraRequests');
  const appeals = readList('qatraAppeals');
  const voluntaryDonations = readList('qatraVoluntaryDonationRequests');

  const donors = accounts.filter(account => account.role === 'donor');
  const institutions = accounts.filter(account => account.isPrimary && ['hospital', 'hospital_bloodbank', 'bloodbank'].includes(account.role) && (account.approvalStatus || 'approved') === 'approved');
  const openAppeals = appeals.filter(appeal => appeal.status === 'مفتوح');
  const completedDonations = appeals.reduce((sum, appeal) => sum + (appeal.responses || []).filter(response => response.status === 'تم التبرع').length, 0) + voluntaryDonations.filter(request => request.status === 'تم التبرع').length;
  const responseMinutes = averageResponseMinutes(requests);

  const donorCountText = document.querySelector('#hero-donor-count');
  const donorSubText = document.querySelector('#hero-donor-sub');
  if (donorCountText) donorCountText.textContent = `${donors.length} متبرع`;
  if (donorSubText) donorSubText.textContent = donors.length ? 'متبرع منضم إلى منصة قطرة' : 'تبدأ البيانات بعد إنشاء الحسابات';

  const avatarStack = document.querySelector('#hero-avatar-stack');
  if (avatarStack) {
    const initials = donors.slice(0, 4).map(donor => (donor.name || '؟').trim()[0] || '؟');
    while (initials.length < 4) initials.push('—');
    avatarStack.innerHTML = initials.map(letter => `<span>${letter}</span>`).join('');
  }

  const emergencyTitle = document.querySelector('#emergency-title');
  const emergencySub = document.querySelector('#emergency-sub');
  const emergencyCount = document.querySelector('#emergency-count');
  if (emergencyCount) emergencyCount.textContent = String(openAppeals.length);
  if (emergencyTitle && emergencySub) {
    if (openAppeals.length) {
      emergencyTitle.textContent = `${openAppeals.length} ${openAppeals.length === 1 ? 'نداء تبرع نشط' : 'نداءات تبرع نشطة'}`;
      emergencySub.textContent = 'قد تكون فصيلة دمك مطلوبة الآن';
    } else {
      emergencyTitle.textContent = 'لا توجد طلبات دم';
      emergencySub.textContent = 'ستظهر الطلبات بعد إنشائها';
    }
  }

  const donorCardCount = document.querySelector('#donor-card-count');
  const donorCardSub = document.querySelector('#donor-card-sub');
  const donorCardAvatars = document.querySelector('#donor-card-avatars');
  if (donorCardCount) donorCardCount.textContent = `${donors.length} متبرع`;
  if (donorCardSub) donorCardSub.textContent = donors.length ? 'من مختلف المحافظات' : 'لا توجد حسابات بعد';
  if (donorCardAvatars) {
    const initials = donors.slice(0, 3).map(donor => (donor.name || '؟').trim()[0] || '؟');
    while (initials.length < 3) initials.push('—');
    donorCardAvatars.innerHTML = initials.map(letter => `<span>${letter}</span>`).join('');
  }

  const impactDonors = document.querySelector('#impact-donors');
  const impactInstitutions = document.querySelector('#impact-institutions');
  const impactCases = document.querySelector('#impact-cases');
  const impactResponse = document.querySelector('#impact-response');
  if (impactDonors) impactDonors.textContent = String(donors.length);
  if (impactInstitutions) impactInstitutions.textContent = String(institutions.length);
  if (impactCases) impactCases.textContent = String(completedDonations);
  if (impactResponse) impactResponse.textContent = `${responseMinutes} دقيقة`;
}

renderLandingStats();
