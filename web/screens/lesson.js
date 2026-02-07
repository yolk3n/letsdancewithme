function openLessonPage(courseId, lessonNumber) {
        const lesson = currentCourseLessons.find((item) => Number(item.lesson_number) === Number(lessonNumber));
        const course = currentStudentCourses.find((item) => Number(item.id) === Number(courseId));
        if (!lesson) return;
        openedLessonNumber = lessonNumber;

        const durationText = lesson.duration_sec ? `${Math.round(lesson.duration_sec / 60)} ${S.minutes}` : S.noDuration;
        const previewHtml = lesson.preview_url
          ? `<p class="lesson-page-description"><a href="${escapeHtml(
              lesson.preview_url
            )}" target="_blank" rel="noopener noreferrer">${S.preview}</a></p>`
          : "";
        const hasNextLesson = currentCourseLessons.some((item) => Number(item.lesson_number) === Number(lesson.lesson_number) + 1);

        studentScreen.innerHTML = `
          <div class="lesson-page-nav">
            <button class="secondary hero-icon-btn" onclick="openCourse(${courseId})">←</button>
            <div class="lesson-page-nav-title">Урок ${lesson.lesson_number}</div>
            <span class="lesson-page-nav-dots">⋮</span>
          </div>
          <div class="lesson-media">
            <div class="lesson-media-play">▶</div>
          </div>
          <div class="lesson-page-wrap">
            <div class="lesson-page-card">
              <div class="lesson-page-meta">
                <span class="lesson-type-icon" title="${lesson.is_free ? S.free : S.paid}">${lesson.is_free ? "🆓" : "💳"}</span>
                <span class="lesson-duration-pill">⏱ ${durationText}</span>
              </div>
              <h3>${escapeHtml(normalizeLessonTitle(lesson))}</h3>
              <p class="lesson-page-description">${escapeHtml(lesson.description || "Описание будет добавлено позже.")}</p>
              ${previewHtml}
              <div class="lesson-materials">
                <h4>Материалы</h4>
                <div class="lesson-material-item">
                  <span class="lesson-material-icon">♫</span>
                  <span class="lesson-material-main"><b>Трек для тренировки.mp3</b><small>4.2 MB</small></span>
                  <span class="lesson-material-download">⇩</span>
                </div>
                <div class="lesson-material-item">
                  <span class="lesson-material-icon">📄</span>
                  <span class="lesson-material-main"><b>Памятка по шагам.pdf</b><small>1.5 MB</small></span>
                  <span class="lesson-material-download">⇩</span>
                </div>
              </div>
              <button class="lesson-next-btn" onclick="doLesson(${courseId}, ${lesson.lesson_number})">${hasNextLesson ? "Следующий урок →" : "Завершить урок"}</button>
            </div>
          </div>
        `;
      }

async function doLesson(courseId, lessonNumber) {
        const data = await apiFetch("/api/lesson", {
          method: "POST",
          body: JSON.stringify({ telegramId: tgUser.id, courseId, lessonNumber }),
        });

        if (data.blocked) {
          const message =
            data.reason === "course_purchase_required" ? S.lessonLockedNeedPurchase : S.lessonLockedGeneric;
          tg.showPopup({ title: S.lessonLockedTitle, message, buttons: [{ type: "ok" }] });
          return;
        }

        await loadCurrentUser();
        if (openedStudentCourseId) {
          await openCourse(openedStudentCourseId);
          const nextLesson = currentCourseLessons.find((item) => Number(item.lesson_number) === Number(lessonNumber) + 1 && item.is_unlocked);
          if (nextLesson) {
            openLessonPage(openedStudentCourseId, nextLesson.lesson_number);
            return;
          }
          if (openedLessonNumber) openLessonPage(openedStudentCourseId, openedLessonNumber);
        }
      }

