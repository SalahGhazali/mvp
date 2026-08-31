const dashboardFont = document.createElement('link');
dashboardFont.rel = 'stylesheet';
dashboardFont.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap';
document.head.appendChild(dashboardFont);

document.querySelector('#dashboard-shell-root').outerHTML = `
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <div id="app-shell" class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-head"><a class="brand" href="dashboard.html"><span class="brand-mark">ق</span><span>قطرة</span></a><button id="close-sidebar" class="icon-btn mobile-only" aria-label="إغلاق القائمة">×</button></div>
      <div class="role-card"><div class="avatar">—</div><div><strong id="sidebar-name">الحساب</strong><span id="sidebar-role">قطرة</span></div><span class="online-dot"></span></div>
      <nav id="side-nav" class="side-nav" aria-label="القائمة الرئيسية"></nav>
      <div class="sidebar-footer"><div class="support-card"><span class="support-icon">♡</span><div><strong>بحاجة للمساعدة؟</strong><small>فريق الدعم متاح على مدار الساعة</small></div></div><button id="logout-btn" class="logout-btn">↪ تسجيل الخروج</button></div>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <div class="topbar-start"><button id="open-sidebar" class="icon-btn mobile-only" aria-label="فتح القائمة">☰</button><div><h1 id="page-title">لوحة التحكم</h1><p id="today-label"></p></div></div>
        <div class="top-actions"><div class="search"><span>⌕</span><input id="global-search" type="search" placeholder="ابحث في النظام..."><kbd>⌘ K</kbd></div><button class="icon-btn notify-btn" data-page="notifications" aria-label="الإشعارات">♢<b id="notify-count">0</b></button><button class="profile-button" id="profile-menu"><span class="avatar small">—</span><span><strong id="header-name">الحساب</strong><small id="header-role">قطرة</small></span><span>⌄</span></button></div>
      </header>
      <section id="page-content" class="page-content"></section>
    </main>
    <div id="sidebar-overlay" class="overlay"></div>
  </div>
  <div id="modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal"><div class="modal-head"><div><span class="eyebrow" id="modal-kicker">إجراء جديد</span><h2 id="modal-title">عنوان</h2></div><button class="icon-btn" id="close-modal" aria-label="إغلاق">×</button></div><div id="modal-body" class="modal-body"></div></div></div>`;
