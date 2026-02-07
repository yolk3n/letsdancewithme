let coursePurchaseOverlayOpen = false;
let coursePurchaseOverlayCourseId = null;

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
        studentScreen.innerHTML = `<div class="section-subtitle">${S.loadingLessons}</div>`;

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
        const hasPaidLessons = lessons.some((lesson) => !lesson.is_free);
        const showBuyButton = hasPaidLessons && course && !course.is_purchased;
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
        const teacherSurname = teacherFullName.split(/\s+/).filter(Boolean)[0] || teacherFullName;
        const teacherAbout = String(course?.teacher_about_short || "О себе не указано").trim();

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
        const ctaLabel = showBuyButton
          ? `${S.buyCourse} ${formatRub(course.price)}`
          : hasStarted
            ? "Продолжить занятия"
            : "Начать занятия";

        const ctaAction = showBuyButton
          ? `purchaseCourse(${courseId})`
          : requiresPurchaseOverlay
            ? `openCoursePurchaseOverlay(${courseId})`
            : targetLesson
              ? `openLessonPage(${courseId}, ${targetLesson.lesson_number})`
              : "openStudentScreen()";

        const progressRadius = 17;
        const progressCircumference = 2 * Math.PI * progressRadius;
        const progressDash = (safeProgress / 100) * progressCircumference;

        studentScreen.innerHTML = `
          <div class="course-view">
            <section class="course-hero dir-${directionClass}">
              <button class="secondary hero-icon-btn course-hero-back" onclick="openStudentScreen()">&larr;</button>
              <div class="course-hero-meta">
                <div class="course-hero-meta-card">
                  ${renderCourseAuthorAvatar(course || {})}
                  <div class="course-hero-meta-copy">
                    <span class="course-hero-meta-value">${escapeHtml(teacherSurname)}</span>
                    <span class="course-hero-meta-label">${escapeHtml(teacherAbout)}</span>
                  </div>
                </div>
                <div class="course-hero-meta-card course-hero-meta-card-price">
                  <div class="course-hero-meta-copy right">
                    <span class="course-hero-meta-value">${formatRub(course?.price || 0)}</span>
                    <span class="course-hero-meta-label">Цена</span>
                  </div>
                </div>
              </div>

              <h2 class="course-hero-title">${escapeHtml(course?.title || "Курс")}</h2>

              <div class="course-hero-stats">
                <span class="course-stat-pill">${escapeHtml(directionLabel)}</span>
                <span class="course-stat-pill">${escapeHtml(levelLabel)}</span>
                <span class="course-stat-pill">${totalLessons} ${pluralizeRu(totalLessons, ["урок", "урока", "уроков"])}</span>
                <div class="course-progress-ring" title="${safeProgress}%">
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
            </section>

            <section class="course-lessons">
              ${
                lessons.length
                  ? lessons
                      .map((lesson) => {
                        const isCurrent = targetLesson && Number(targetLesson.lesson_number) === Number(lesson.lesson_number);
                        const durationText = lesson.duration_sec
                          ? `${Math.floor(lesson.duration_sec / 60)}:${String(lesson.duration_sec % 60).padStart(2, "0")}`
                          : "--:--";
                        const title = normalizeLessonTitle(lesson);
                        const action = lesson.is_unlocked ? `onclick="openLessonPage(${courseId}, ${lesson.lesson_number})"` : "";
                        return `
                  <div class="course-lesson-row ${isCurrent ? "current" : ""}">
                    <div class="course-lesson-node ${lesson.is_unlocked ? "unlocked" : "locked"}"></div>
                    <div class="course-lesson-card ${lesson.is_unlocked ? "" : "is-locked"}" ${action}>
                      <div class="course-lesson-title">${escapeHtml(title)}</div>
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
