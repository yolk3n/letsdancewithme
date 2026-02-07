function openLessonPage(courseId, lessonNumber) {
        if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(false);
        const lesson = currentCourseLessons.find((item) => Number(item.lesson_number) === Number(lessonNumber));
        const course = currentStudentCourses.find((item) => Number(item.id) === Number(courseId));
        if (!lesson) return;
        openedLessonNumber = lessonNumber;
        const directionClass = getCourseDirectionClass(course || {});

        const durationText = lesson.duration_sec
          ? `${Math.floor(lesson.duration_sec / 60)}:${String(lesson.duration_sec % 60).padStart(2, "0")}`
          : "--:--";
        const previewHtml = lesson.preview_url
          ? `<p class="lesson-page-description"><a href="${escapeHtml(
              lesson.preview_url
            )}" target="_blank" rel="noopener noreferrer">${escapeHtml(S.lessonPreviewLink)}</a></p>`
          : "";
        const hasNextLesson = currentCourseLessons.some((item) => Number(item.lesson_number) === Number(lesson.lesson_number) + 1);

        studentScreen.innerHTML = `
          <div class="lesson-page dir-${directionClass}">
            <div class="lesson-media-hero">
              <div class="lesson-page-nav">
                <button class="secondary course-hero-icon-btn lesson-back-btn" onclick="openCourse(${courseId})" aria-label="${escapeHtml(S.lessonBackAria)}" title="${escapeHtml(S.lessonBackAria)}">
                  <img src="/assets/back.svg" alt="" class="course-hero-icon" aria-hidden="true" />
                </button>
              </div>
              <button class="lesson-media-play" aria-label="${escapeHtml(S.lessonPlayAria)}">&#9654;</button>
            </div>
            <div class="lesson-page-wrap">
              <div class="lesson-page-card">
                <div class="lesson-page-kicker">
                  <span>${escapeHtml(S.lessonKicker)} ${lesson.lesson_number}</span>
                  <span class="lesson-page-kicker-sep">&bull;</span>
                  <span>${durationText}</span>
                </div>
                <h3>${escapeHtml(normalizeLessonTitle(lesson))}</h3>
                <h4 class="lesson-section-title">${escapeHtml(S.lessonDescriptionTitle)}</h4>
                <p class="lesson-page-description">${escapeHtml(lesson.description || S.lessonDescriptionFallback)}</p>
                ${previewHtml}

                <div class="lesson-tip-card">
                  <div class="lesson-tip-icon">i</div>
                  <div class="lesson-tip-main">
                    <div class="lesson-tip-title">${escapeHtml(S.lessonTipTitle)}</div>
                    <div class="lesson-tip-text">${escapeHtml(S.lessonTipText)}</div>
                  </div>
                </div>

                <div class="lesson-audio-card">
                  <div class="lesson-audio-icon">MP3</div>
                  <div class="lesson-audio-main">
                    <div class="lesson-audio-name">${escapeHtml(S.lessonAudioName)}</div>
                    <div class="lesson-audio-meta">2:34</div>
                  </div>
                  <button class="lesson-audio-action" type="button" aria-label="${escapeHtml(S.lessonAudioDownloadAria)}">&#8681;</button>
                </div>

                <button class="lesson-next-btn" onclick="doLesson(${courseId}, ${lesson.lesson_number})">${hasNextLesson ? S.lessonNext : S.lessonFinish}</button>
              </div>
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
