let profileOverlayOpen = false;

function getProfileDisplayName() {
  const fullName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (currentUser?.username) return `@${currentUser.username}`;
  return S.userDefaultName || "Пользователь";
}

function getCourseRankTitle(coursesCount) {
  const count = Math.max(0, Number(coursesCount) || 0);
  if (count >= 13) return "Мегазвезда";
  if (count >= 12) return "Икона";
  if (count >= 11) return "Легенда";
  if (count >= 10) return "Наставник";
  if (count >= 9) return "Преподаватель";
  if (count >= 8) return "Мастер";
  if (count >= 7) return "Артист";
  if (count >= 5) return "Импровизатор";
  if (count >= 4) return "Танцор";
  if (count >= 3) return "Практик";
  if (count >= 2) return "Ученик";
  return "Новичок";
}

function getDirectionRankPrefix(directionName) {
  const raw = String(directionName || "").trim();
  return raw || "Универсал";
}

function getProfileRank(topDirection, coursesCount) {
  return `${getDirectionRankPrefix(topDirection)} ${getCourseRankTitle(coursesCount)}`.trim();
}

function buildProgressRingSvg(progressPercent) {
  const safe = Math.max(0, Math.min(100, Number(progressPercent) || 0));
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;

  return `
    <div class="profile-stat-ring" aria-label="Средний прогресс ${safe}%">
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle class="profile-stat-ring-bg" cx="28" cy="28" r="${radius}"></circle>
        <circle class="profile-stat-ring-val" cx="28" cy="28" r="${radius}" stroke-dasharray="${dash} ${circumference}"></circle>
      </svg>
      <span>${safe}%</span>
    </div>
  `;
}

async function loadProfileStats() {
  const purchasedCourses = await apiFetch("/api/student/courses?purchased=1");
  const purchasedCount = purchasedCourses.length;

  const averageProgress = purchasedCount
    ? Math.round(
        purchasedCourses.reduce((sum, item) => sum + Number(item?.progress_percent || 0), 0) /
          purchasedCount
      )
    : 0;

  const lessonLists = await Promise.all(
    purchasedCourses.map((course) => apiFetch(`/api/lessons/${course.id}`))
  );
  const totalDurationSec = lessonLists
    .flat()
    .reduce((sum, lesson) => sum + Number(lesson?.duration_sec || 0), 0);
  const hours = Math.round(totalDurationSec / 3600);

  const directionCounter = new Map();
  for (const course of purchasedCourses) {
    const styles = Array.isArray(course?.styles) ? course.styles : [];
    for (const style of styles) {
      const styleName = String(style?.name || "").trim();
      if (!styleName) continue;
      directionCounter.set(styleName, (directionCounter.get(styleName) || 0) + 1);
    }
  }

  let topDirection = "";
  let topCount = -1;
  for (const [name, count] of directionCounter.entries()) {
    if (count > topCount) {
      topCount = count;
      topDirection = name;
    }
  }

  const rank = getProfileRank(topDirection, purchasedCount);
  return {
    purchasedCount,
    averageProgress,
    hours,
    rank,
  };
}

function renderProfileOverlay(stats) {
  const avatarUrl = currentUser?.avatar_url || tgUser?.photo_url || "";
  const displayName = getProfileDisplayName();

  return `
    <div class="profile-overlay-root" onclick="closeProfileOverlay()">
      <div class="profile-overlay-panel" onclick="event.stopPropagation()">
        <div class="profile-overlay-top">
          <button class="secondary course-hero-icon-btn profile-overlay-back" onclick="closeProfileOverlay()" aria-label="Закрыть профиль" title="Закрыть">
            <img src="/assets/back.svg" alt="" class="course-hero-icon" aria-hidden="true" />
          </button>
        </div>

        <div class="profile-overlay-avatar-wrap">
          ${
            avatarUrl
              ? `<img class="profile-overlay-avatar" src="${escapeHtml(avatarUrl)}" alt="avatar" />`
              : `<span class="profile-overlay-avatar-fallback">${escapeHtml(getInitials(displayName))}</span>`
          }
        </div>

        <h3 class="profile-overlay-name">${escapeHtml(displayName)}</h3>
        <div class="profile-overlay-rank">${escapeHtml(stats.rank)}</div>
        <div class="profile-overlay-stats-title">Статистика</div>
        <div class="profile-overlay-stats" role="group" aria-label="Статистика">
          <div class="profile-stat-item">
            <div class="profile-stat-value">${stats.purchasedCount}</div>
            <div class="profile-stat-label">КУРСЫ</div>
          </div>
          <div class="profile-stat-item with-ring">
            ${buildProgressRingSvg(stats.averageProgress)}
            <div class="profile-stat-label">СР. ПРОГРЕСС</div>
          </div>
          <div class="profile-stat-item">
            <div class="profile-stat-value">${stats.hours}</div>
            <div class="profile-stat-label">ЧАСЫ</div>
          </div>
        </div>

        <div class="profile-overlay-menu">
          ${
            currentUser?.role === "teacher" || currentUser?.role === "admin"
              ? `<button class="profile-menu-text profile-menu-text-accent" onclick="openTeacherCabinetFromProfile()">Кабинет преподавателя</button>`
              : ""
          }
          <button class="profile-menu-text" onclick="openPaymentsAndSubscription()">Оплаты и подписка</button>
          <button class="profile-menu-text" onclick="openSupportFromProfile()">Поддержка</button>
        </div>
      </div>
    </div>
  `;
}

async function openProfileOverlay() {
  if (profileOverlayOpen) return;
  profileOverlayOpen = true;

  const existing = document.querySelector(".profile-overlay-root");
  if (existing) existing.remove();

  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="profile-overlay-root"><div class="profile-overlay-panel">${renderCenteredLoader(S.loading)}</div></div>`
  );

  if (typeof setOverlayLock === "function") setOverlayLock(true);

  try {
    const stats = await loadProfileStats();
    const root = document.querySelector(".profile-overlay-root");
    if (root) root.outerHTML = renderProfileOverlay(stats);
  } catch (error) {
    profileOverlayOpen = false;
    closeProfileOverlay();
    tg.showAlert(escapeHtml(error?.message || S.initError));
  }
}

function closeProfileOverlay() {
  profileOverlayOpen = false;
  const root = document.querySelector(".profile-overlay-root");
  if (root) root.remove();
  if (typeof setOverlayLock === "function") setOverlayLock(false);
}

function openPaymentsAndSubscription() {
  closeProfileOverlay();
  openMySubscriptions();
}

function openSupportFromProfile() {
  closeProfileOverlay();
  openSupport();
}

function openTeacherCabinetFromProfile() {
  closeProfileOverlay();
  openTeacherCabinet();
}

async function completeOnboarding() {
  await apiFetch("/api/onboarding/complete", { method: "POST" });
  await loadCurrentUser();
  await routeByRole();
}

async function routeByRole() {
  if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(false);
  onboardingCard.classList.add("hidden");
  studentScreen.classList.add("hidden");
  profileScreen.classList.add("hidden");
  teacherScreen.classList.add("hidden");
  adminScreen.classList.add("hidden");

  const canUseTeacher = currentUser.role === "teacher" || currentUser.role === "admin";
  const canUseAdmin = currentUser.role === "admin";
  const showTeacherScreen = selectedAppScreen === "teacher" && canUseTeacher;
  const showAdminScreen = selectedAppScreen === "admin" && canUseAdmin;

  // Onboarding is temporarily disabled: always route directly to app screens.

  if (showAdminScreen) {
    adminScreen.classList.remove("hidden");
    await renderAdminScreen();
    return;
  }

  if (showTeacherScreen) {
    teacherScreen.classList.remove("hidden");
    await renderTeacherScreen();
    return;
  }

  studentScreen.classList.remove("hidden");
  await renderStudentScreen();
}

window.openProfileOverlay = openProfileOverlay;
window.closeProfileOverlay = closeProfileOverlay;
window.openPaymentsAndSubscription = openPaymentsAndSubscription;
window.openSupportFromProfile = openSupportFromProfile;
window.openTeacherCabinetFromProfile = openTeacherCabinetFromProfile;
