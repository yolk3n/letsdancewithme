async function openCourse(courseId) {
        if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(false);
        studentScreen.classList.add("flat-list");
        selectedTeacherId = null;
        openedStudentCourseId = courseId;
        openedLessonNumber = null;
        studentScreen.innerHTML = `
          <div class="section-subtitle">${S.loadingLessons}</div>
        `;
        const lessons = await apiFetch(`/api/lessons/${courseId}`);
        currentCourseLessons = lessons;
        const course = currentStudentCourses.find((item) => item.id === courseId);
        const hasPaidLessons = lessons.some((lesson) => !lesson.is_free);
        const showBuyButton = hasPaidLessons && course && !course.is_purchased;
        const levelClass = getCourseLevelClass(course?.level);
        const styleChips = Array.isArray(course?.styles) ? course.styles : [];
        const progressPercent = Number(course?.progress_percent || 0);
        const completedLessons = Number(course?.completed_lessons || 0);

        studentScreen.innerHTML = `
          <div class="lesson-hero level-${levelClass}">
            <div class="lesson-hero-nav">
              <button class="secondary hero-icon-btn" onclick="openStudentScreen()">←</button>
            </div>
            ${
              styleChips.length
                ? `<div class="lesson-hero-tags">${styleChips
                    .slice(0, 2)
                    .map((style) => `<span class="lesson-hero-tag">${escapeHtml(style.name)}</span>`)
                    .join("")}</div>`
                : ""
            }
            <h2 class="lesson-hero-title">${escapeHtml(course?.title || "Курс")}</h2>
            <div class="lesson-hero-author">
              ${renderCourseAuthorAvatar(course || {})}
              <div>
                <div class="lesson-hero-name">${escapeHtml(course?.teacher_name || "Преподаватель")}</div>
                <div class="lesson-hero-role">Преподаватель</div>
              </div>
            </div>
          </div>
          <div class="lesson-list-wrap">
            ${showBuyButton ? `<button onclick="purchaseCourse(${courseId})">${S.buyCourse} ${formatRub(course.price)}</button>` : ""}
            <div class="lesson-program-header">
              <h3>Программа</h3>
              <span>${Math.max(0, Math.min(100, progressPercent))}% пройдено</span>
            </div>
            <div class="lesson-roadmap">
              ${
                lessons.length
                  ? lessons
                      .map((lesson) => {
                        const typeIcon = lesson.is_free ? "🆓" : "💳";
                        const durationText = lesson.duration_sec
                          ? `${Math.round(lesson.duration_sec / 60)} ${S.minutes}`
                          : S.noDuration;
                        const isCompleted = lesson.lesson_number <= completedLessons;
                        const stateIcon = lesson.is_unlocked ? (isCompleted ? "↻" : "▶") : "🔒";
                        const previewHtml = lesson.preview_url
                          ? `<small><a href="${escapeHtml(
                              lesson.preview_url
                            )}" target="_blank" rel="noopener noreferrer">${S.preview}</a></small>`
                          : "";
                        const title = normalizeLessonTitle(lesson);
                        const action = lesson.is_unlocked ? `onclick="openLessonPage(${courseId}, ${lesson.lesson_number})"` : "";
                        return `
                  <div class="lesson-node ${lesson.is_unlocked ? "unlocked" : ""}">
                    <div class="lesson-card ${lesson.is_unlocked ? "" : "locked"}" ${action}>
                      <div class="lesson-card-head">
                        <h3 class="lesson-card-title">${escapeHtml(title)}</h3>
                        <span class="lesson-state-icon">${stateIcon}</span>
                      </div>
                      <div class="lesson-card-meta">
                        <span class="lesson-type-icon" title="${lesson.is_free ? S.free : S.paid}">${typeIcon}</span>
                        <small class="muted">${durationText}</small>
                        ${previewHtml}
                      </div>
                    </div>
                  </div>
                `;
                      })
                      .join("")
                  : `<small class="muted">В этом курсе пока нет уроков.</small>`
              }
            </div>
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

