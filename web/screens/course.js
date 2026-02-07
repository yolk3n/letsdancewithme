async function openCourse(courseId) {
        if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(false);
        studentScreen.classList.add("flat-list");
        selectedTeacherId = null;
        openedStudentCourseId = courseId;
        openedLessonNumber = null;
        studentScreen.innerHTML = `<div class="section-subtitle">${S.loadingLessons}</div>`;

        const lessons = await apiFetch(`/api/lessons/${courseId}`);
        currentCourseLessons = lessons;
        const course = currentStudentCourses.find((item) => item.id === courseId);
        const hasPaidLessons = lessons.some((lesson) => !lesson.is_free);
        const showBuyButton = hasPaidLessons && course && !course.is_purchased;
        const directionClass = getCourseDirectionClass(course);
        const levelLabel = getCourseLevelLabel(course?.level);
        const progressPercent = Number(course?.progress_percent || 0);
        const completedLessons = Number(course?.completed_lessons || 0);
        const unlockedLessons = lessons.filter((lesson) => lesson.is_unlocked).length;
        const firstUnlocked = lessons.find((lesson) => lesson.is_unlocked);

        studentScreen.innerHTML = `
          <div class="course-view">
            <section class="course-hero dir-${directionClass}">
              <button class="secondary hero-icon-btn course-hero-back" onclick="openStudentScreen()">&larr;</button>
              <div class="course-hero-meta">
                <div class="course-hero-instructor">
                  ${renderCourseAuthorAvatar(course || {})}
                  <div class="course-hero-instructor-text">
                    <span class="course-hero-label">INSTRUCTOR</span>
                    <span class="course-hero-value">${escapeHtml(course?.teacher_name || "Преподаватель")}</span>
                  </div>
                </div>
                <div class="course-hero-price">
                  <span class="course-hero-label">PRICE</span>
                  <span class="course-hero-value">${formatRub(course?.price || 0)}</span>
                </div>
              </div>
              <h2 class="course-hero-title">${escapeHtml(course?.title || "Курс")}</h2>
              <div class="course-hero-stats">
                <span class="course-stat-pill">${escapeHtml(levelLabel)}</span>
                <span class="course-stat-pill">${unlockedLessons} lessons</span>
                <span class="course-hero-progress">${Math.max(0, Math.min(100, progressPercent))}% Done</span>
              </div>
            </section>

            <section class="course-lessons">
              ${
                lessons.length
                  ? lessons
                      .map((lesson) => {
                        const isCompleted = lesson.lesson_number <= completedLessons;
                        const icon = lesson.is_unlocked ? "&#10003;" : "&#128274;";
                        const durationText = lesson.duration_sec
                          ? `${Math.floor(lesson.duration_sec / 60)}:${String(lesson.duration_sec % 60).padStart(2, "0")}`
                          : "--:--";
                        const title = normalizeLessonTitle(lesson);
                        const action = lesson.is_unlocked ? `onclick="openLessonPage(${courseId}, ${lesson.lesson_number})"` : "";
                        return `
                  <div class="course-lesson-row">
                    <div class="course-lesson-node ${lesson.is_unlocked ? "unlocked" : ""} ${isCompleted ? "completed" : ""}">${icon}</div>
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
              ${
                showBuyButton
                  ? `<button class="course-cta" onclick="purchaseCourse(${courseId})">${S.buyCourse} ${formatRub(course.price)}</button>`
                  : `<button class="course-cta" onclick="${
                      firstUnlocked ? `openLessonPage(${courseId}, ${firstUnlocked.lesson_number})` : "openStudentScreen()"
                    }">Continue Learning</button>`
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

