let coursePurchaseOverlayOpen = false;
let coursePurchaseOverlayCourseId = null;

function shareCourse(courseId) {
  const course = currentStudentCourses.find((item) => Number(item.id) === Number(courseId));
  const title = String(course?.title || "Курс");
  const teacher = String(course?.teacher_name || "Преподаватель");
  const price = formatRub(course?.price || 0);
  const shareLink = buildCourseShareLink(courseId);
  if (!shareLink) {
    if (tg && typeof tg.showAlert === "function") {
      tg.showAlert("Шаринг Mini App не настроен: добавь TG_BOT_USERNAME в env web-сервиса.");
      return;
    }
    alert("Шаринг Mini App не настроен: добавь TG_BOT_USERNAME в env web-сервиса.");
    return;
  }
  const shareDescription = `${title} — ${teacher}. ${price}`;
  const sharePayload = shareDescription;

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(sharePayload)}`;
  if (tg && typeof tg.openTelegramLink === "function") {
    tg.openTelegramLink(shareUrl);
    return;
  }
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

function openCoursePurchaseOverlay(courseId) {
  coursePurchaseOverlayOpen = true;
  coursePurchaseOverlayCourseId = Number(courseId);
  if (openedStudentCourseId) {
    openCourse(openedStudentCourseId);
  }
}

function closeCoursePurchaseOverlay() {
  coursePurchaseOverlayOpen = false;
  coursePurchaseOverlayCourseId = null;
  if (openedStudentCourseId) {
    openCourse(openedStudentCourseId);
  }
}

async function purchaseCourseFromOverlay(courseId) {
  coursePurchaseOverlayOpen = false;
  coursePurchaseOverlayCourseId = null;
  await purchaseCourse(courseId);
}

async function openCourse(courseId) {
        if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(false);
        studentScreen.classList.add("flat-list");
        selectedTeacherId = null;
        openedStudentCourseId = courseId;
        openedLessonNumber = null;
        studentScreen.innerHTML = renderCenteredLoader(S.loadingLessons);

        const freshCourse = await apiFetch(`/api/student/course/${courseId}`);
        const cacheIndex = currentStudentCourses.findIndex((item) => Number(item.id) === Number(courseId));
        if (cacheIndex >= 0) {
          currentStudentCourses[cacheIndex] = { ...currentStudentCourses[cacheIndex], ...freshCourse };
        } else {
          currentStudentCourses.push(freshCourse);
        }

        const lessons = await apiFetch(`/api/lessons/${courseId}`);
        currentCourseLessons = lessons;
        const course = freshCourse;
        const directionClass = getCourseDirectionClass(course);
        const levelLabel = getCourseLevelLabel(course?.level);
        const progressPercent = Number(course?.progress_percent || 0);
        const safeProgress = Math.max(0, Math.min(100, progressPercent));
        const completedLessons = Number(course?.completed_lessons || 0);
        const totalLessons = Number(course?.total_lessons || lessons.length || 0);
        const directionLabel =
          (Array.isArray(course?.styles) && course.styles[0] && course.styles[0].name) ||
          (directionClass === "bachata" ? "Бачата" : directionClass === "kizomba" ? "Кизомба" : "Сальса");

        const teacherFullName = String(course?.teacher_name || "Преподаватель").trim();
        const teacherAbout = String(course?.teacher_about_short || "О себе не указано").trim();
        const priceLead = `₽ ${Number(course?.price || 0)}`;
        const buyerAvatarPool = Array.isArray(currentStudentTeachers)
          ? currentStudentTeachers.map((item) => item?.avatar_url).filter(Boolean)
          : [];
        const buyerAvatars = buyerAvatarPool.slice(0, 3);
        const buyerExtra = Math.max(0, 24 - buyerAvatars.length);

        const targetLesson =
          lessons.find((lesson) => Number(lesson.lesson_number) === completedLessons + 1) ||
          lessons.find((lesson) => lesson.is_unlocked) ||
          lessons[0] ||
          null;

        const requiresPurchaseOverlay = Boolean(
          targetLesson &&
            !course.is_purchased &&
            !targetLesson.is_free
        );

        const hasStarted = completedLessons > 0 || safeProgress > 0;
        const ctaLabel = hasStarted ? "Продолжить занятия" : "Начать занятия";

        const ctaAction = requiresPurchaseOverlay
          ? `openCoursePurchaseOverlay(${courseId})`
          : targetLesson && targetLesson.is_unlocked
            ? `openLessonPage(${courseId}, ${targetLesson.lesson_number})`
            : targetLesson
              ? `openCoursePurchaseOverlay(${courseId})`
              : "openStudentScreen()";

        const progressRadius = 17;
        const progressCircumference = 2 * Math.PI * progressRadius;
        const progressDash = (safeProgress / 100) * progressCircumference;

        studentScreen.innerHTML = `
          <div class="course-view">
            <section class="course-hero dir-${directionClass}">
              <div class="course-hero-top">
                <button class="secondary course-hero-icon-btn course-hero-back" onclick="openStudentScreen()" aria-label="Другие курсы" title="Другие курсы">
                  <img src="/assets/back.svg" alt="" class="course-hero-icon" aria-hidden="true" />
                </button>
                <button class="secondary course-hero-icon-btn course-hero-share" onclick="shareCourse(${courseId})" aria-label="Поделиться курсом" title="Поделиться">
                  <img src="/assets/share.svg" alt="" class="course-hero-icon" aria-hidden="true" />
                </button>
              </div>
              <div class="course-hero-meta">
                <div class="course-hero-meta-card">
                  ${renderCourseAuthorAvatar(course || {})}
                  <div class="course-hero-meta-copy">
                    <span class="course-hero-meta-label">${escapeHtml(teacherAbout)}</span>
                    <span class="course-hero-meta-value course-hero-author-name">${escapeHtml(teacherFullName)}</span>
                  </div>
                </div>
                <div class="course-hero-meta-progress" title="${safeProgress}%">
                  <svg viewBox="0 0 44 44" aria-hidden="true">
                    <circle class="course-progress-ring-bg" cx="22" cy="22" r="${progressRadius}"></circle>
                    <circle
                      class="course-progress-ring-val"
                      cx="22"
                      cy="22"
                      r="${progressRadius}"
                      stroke-dasharray="${progressDash} ${progressCircumference}"
                    ></circle>
                  </svg>
                  <span>${safeProgress}%</span>
                </div>
              </div>

              <h2 class="course-hero-title">${escapeHtml(course?.title || "Курс")}</h2>

              <div class="course-hero-stats">
                <span class="course-stat-pill">${escapeHtml(directionLabel)}</span>
                <span class="course-stat-pill">${escapeHtml(levelLabel)}</span>
                <span class="course-stat-pill">${totalLessons} ${pluralizeRu(totalLessons, ["урок", "урока", "уроков"])}</span>
              </div>
              <div class="course-hero-bottom">
                <div class="course-buyers-preview">
                  <div class="course-mini-avatars">
                    ${
                      buyerAvatars.length
                        ? buyerAvatars.map((url) => `<img src="${escapeHtml(url)}" alt="buyer" />`).join("")
                        : `
                          <span></span>
                          <span></span>
                          <span></span>
                        `
                    }
                    ${buyerExtra ? `<span>+${buyerExtra}</span>` : ""}
                  </div>
                </div>
                <div class="course-hero-price-row">
                  ${course.is_purchased ? `<span class="course-purchased-badge">Курс куплен</span>` : ""}
                  <span class="course-hero-meta-value course-hero-price-value">${escapeHtml(priceLead)}</span>
                </div>
              </div>
            </section>

            <section class="course-lessons">
              ${
                lessons.length
                  ? lessons
                      .map((lesson) => {
                        const isCompleted = Number(lesson.lesson_number) <= Number(completedLessons);
                        const isCurrent = targetLesson && Number(targetLesson.lesson_number) === Number(lesson.lesson_number);
                        const nodeState = isCurrent ? "current" : isCompleted ? "completed" : "future";
                        const nodeIcon = isCurrent
                          ? `<span class="course-lesson-node-dot">•</span>`
                          : isCompleted
                            ? `<span class="course-lesson-node-check">✓</span>`
                            : `<svg class="course-lesson-node-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1zm2 0h6V8a3 3 0 0 0-6 0v2zm3 4a1.5 1.5 0 0 1 1.5 1.5c0 .6-.35 1.13-.86 1.37V19h-1.28v-2.13A1.5 1.5 0 0 1 12 14z"/></svg>`;
                        const durationText = lesson.duration_sec
                          ? `${Math.floor(lesson.duration_sec / 60)}:${String(lesson.duration_sec % 60).padStart(2, "0")}`
                          : "--:--";
                        const title = normalizeLessonTitle(lesson);
                        const action = lesson.is_unlocked ? `onclick="openLessonPage(${courseId}, ${lesson.lesson_number})"` : "";
                        return `
                  <div class="course-lesson-row ${isCurrent ? "current" : ""} ${isCompleted ? "completed" : ""}">
                    <div class="course-lesson-node ${nodeState}">${nodeIcon}</div>
                    <div class="course-lesson-card ${lesson.is_unlocked ? "" : "is-locked"}" ${action}>
                      <div class="course-lesson-title-row">
                        <div class="course-lesson-title">${escapeHtml(title)}</div>
                        ${lesson.is_free ? `<span class="course-lesson-free">free</span>` : ""}
                      </div>
                      <div class="course-lesson-time">${durationText}</div>
                    </div>
                  </div>
                `;
                      })
                      .join("")
                  : `<small class="muted">В этом курсе пока нет уроков.</small>`
              }
            </section>

            <div class="course-cta-wrap">
              <button class="course-cta" onclick="${ctaAction}">${ctaLabel}</button>
            </div>

            ${
              coursePurchaseOverlayOpen && Number(coursePurchaseOverlayCourseId) === Number(courseId)
                ? `<div class="teacher-picker-overlay" onclick="closeCoursePurchaseOverlay()">
                    <div class="teacher-picker course-buy-overlay" onclick="event.stopPropagation()">
                      <div class="teacher-picker-head">
                        <div class="course-buy-title">Курс требует подписку</div>
                        <button class="secondary teacher-picker-close" onclick="closeCoursePurchaseOverlay()">×</button>
                      </div>
                      <div class="course-buy-text">Следующий урок платный. Чтобы продолжить, купи курс.</div>
                      <button class="course-buy-btn" onclick="purchaseCourseFromOverlay(${courseId})">${S.buyCourse} ${formatRub(course?.price || 0)}</button>
                    </div>
                  </div>`
                : ""
            }
          </div>
        `;
      }

async function purchaseCourse(courseId) {
        await apiFetch(`/api/courses/${courseId}/purchase`, { method: "POST" });
        const selectedCourse = currentStudentCourses.find((item) => item.id === courseId);
        if (selectedCourse) selectedCourse.is_purchased = true;
        tg.showAlert(S.coursePurchaseSuccess);
        await openCourse(courseId);
      }
