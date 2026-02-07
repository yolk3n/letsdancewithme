async function renderTeacherScreen() {
        teacherScreen.innerHTML = `
          <b>${S.teacherCabinet}</b>
          <p class="muted">${S.profileTitle}</p>
          <input id="teacherName" placeholder="${S.teacherNamePh}" />
          <input id="teacherDescription" placeholder="${S.teacherDescriptionPh}" />
          <input id="teacherAvatarUrl" placeholder="${S.teacherAvatarPh}" />
          <button id="saveTeacherProfileBtn">${S.saveProfile}</button>
          <hr />
          <p class="muted">${S.newCourseTitle}</p>
          <input id="courseTitle" placeholder="${S.courseNamePh}" />
          <input id="courseDescription" placeholder="${S.courseDescriptionPh}" />
          <div class="row">
            <input id="coursePrice" type="number" placeholder="${S.coursePricePh}" min="199" />
            <select id="courseLevel">
              <option value="beginner">Новичок</option>
              <option value="advanced">Продвинутый</option>
              <option value="professional">Профессионал</option>
            </select>
          </div>
          <div class="row">
            <select id="coursePublished">
              <option value="true">${S.published}</option>
              <option value="false">${S.hidden}</option>
            </select>
          </div>
          <button id="createCourseBtn">${S.createCourse}</button>
          <hr />
          <p class="muted">${S.teacherLessonsTitle}</p>
          <select id="teacherCourseSelect"></select>
          <div class="row">
            <input id="lessonNumber" type="number" min="1" placeholder="${S.lessonNumberPh}" />
            <input id="lessonDuration" type="number" min="1" placeholder="${S.lessonDurationPh}" />
          </div>
          <input id="lessonTitle" placeholder="${S.lessonNamePh}" />
          <input id="lessonPreviewUrl" placeholder="${S.lessonPreviewPh}" />
          <textarea id="lessonDescription" placeholder="${S.lessonDescriptionPh}"></textarea>
          <select id="lessonIsFree">
            <option value="true">${S.lessonFree}</option>
            <option value="false">${S.lessonPaid}</option>
          </select>
          <button id="saveLessonBtn">${S.saveLesson}</button>
          <div id="teacherCourses" class="muted">${S.loading}</div>
          <div id="teacherLessons" class="muted">${S.chooseCourse}</div>
        `;

        const teacherNameInput = document.getElementById("teacherName");
        const teacherDescriptionInput = document.getElementById("teacherDescription");
        const teacherAvatarInput = document.getElementById("teacherAvatarUrl");
        const saveTeacherProfileBtn = document.getElementById("saveTeacherProfileBtn");
        const courseTitleInput = document.getElementById("courseTitle");
        const courseDescriptionInput = document.getElementById("courseDescription");
        const coursePriceInput = document.getElementById("coursePrice");
        const courseLevelInput = document.getElementById("courseLevel");
        const coursePublishedInput = document.getElementById("coursePublished");
        const createCourseBtn = document.getElementById("createCourseBtn");
        const teacherCourseSelect = document.getElementById("teacherCourseSelect");
        const lessonNumberInput = document.getElementById("lessonNumber");
        const lessonDurationInput = document.getElementById("lessonDuration");
        const lessonTitleInput = document.getElementById("lessonTitle");
        const lessonPreviewInput = document.getElementById("lessonPreviewUrl");
        const lessonDescriptionInput = document.getElementById("lessonDescription");
        const lessonIsFreeInput = document.getElementById("lessonIsFree");
        const saveLessonBtn = document.getElementById("saveLessonBtn");
        const teacherCoursesBlock = document.getElementById("teacherCourses");
        const teacherLessonsBlock = document.getElementById("teacherLessons");

        const profile = await apiFetch("/api/teacher/profile");
        teacherNameInput.value = profile.name || "";
        teacherDescriptionInput.value = profile.description || "";
        teacherAvatarInput.value = profile.avatar_url || "";

        saveTeacherProfileBtn.addEventListener("click", async () => {
          await apiFetch("/api/teacher/profile", {
            method: "PUT",
            body: JSON.stringify({
              name: teacherNameInput.value.trim(),
              description: teacherDescriptionInput.value.trim(),
              avatarUrl: teacherAvatarInput.value.trim(),
            }),
          });
          tg.showAlert(S.profileSaved);
        });

        async function loadTeacherCoursesData() {
          currentTeacherCourses = await apiFetch("/api/teacher/courses");
          teacherCoursesBlock.innerHTML =
            `<b>${S.yourCourses}</b><br/><br/>` +
            (currentTeacherCourses.length
              ? currentTeacherCourses
                  .map(
                    (course) =>
                      `• ${escapeHtml(course.title)} — ${getCourseLevelLabel(course.level)} — ${Number(course.price || 0)} ₽ (${
                        course.is_published ? S.published.toLowerCase() : S.hidden.toLowerCase()
                      })`
                  )
                  .join("<br/>")
              : S.noCoursesYet);

          teacherCourseSelect.innerHTML = currentTeacherCourses.length
            ? currentTeacherCourses.map((course) => `<option value="${course.id}">${escapeHtml(course.title)}</option>`).join("")
            : `<option value="">${S.noCourses}</option>`;
        }

        async function loadTeacherLessonsData() {
          const courseId = Number(teacherCourseSelect.value);
          if (!courseId) {
            teacherLessonsBlock.textContent = S.chooseCourse;
            return;
          }

          const lessons = await apiFetch(`/api/teacher/courses/${courseId}/lessons`);
          currentTeacherLessons = lessons;
          teacherLessonsBlock.innerHTML =
            `<b>${S.selectedCourseLessons}</b><br/><br/>` +
            (lessons.length
              ? lessons
                  .map(
                    (lesson) => `
                      <div class="lesson-row">
                        <b>${lesson.lesson_number}. ${escapeHtml(lesson.title)}</b><br/>
                        <small class="muted">${escapeHtml(lesson.description || "")}</small><br/>
                        <small class="muted">${lesson.is_free ? S.free : S.paid} • ${
                          lesson.duration_sec ? `${lesson.duration_sec} ${S.seconds}` : S.noDuration
                        }</small><br/>
                        ${
                          lesson.preview_url
                            ? `<small><a href="${escapeHtml(lesson.preview_url)}" target="_blank" rel="noopener noreferrer">${S.preview}</a></small><br/>`
                            : ""
                        }
                        <button class="secondary" onclick="editLessonById(${lesson.id})">${S.editLesson}</button>
                      </div>
                    `
                  )
                  .join("")
              : S.noLessonsYet);
        }

        createCourseBtn.addEventListener("click", async () => {
          const title = courseTitleInput.value.trim();
          const price = Number(coursePriceInput.value || 0);
          if (!title) return tg.showAlert(S.needCourseName);
          if (!Number.isFinite(price) || price < 199) return tg.showAlert(S.minCoursePriceError);

          await apiFetch("/api/teacher/courses", {
            method: "POST",
            body: JSON.stringify({
              title,
              description: courseDescriptionInput.value.trim(),
              price,
              level: courseLevelInput.value,
              isPublished: coursePublishedInput.value === "true",
              styleIds: [],
            }),
          });
          courseTitleInput.value = "";
          courseDescriptionInput.value = "";
          coursePriceInput.value = "";
          courseLevelInput.value = "beginner";
          await loadTeacherCoursesData();
          await loadTeacherLessonsData();
          tg.showAlert(S.courseCreated);
        });

        teacherCourseSelect.addEventListener("change", loadTeacherLessonsData);

        function resetLessonForm() {
          editingLessonId = null;
          lessonNumberInput.value = "";
          lessonDurationInput.value = "";
          lessonTitleInput.value = "";
          lessonPreviewInput.value = "";
          lessonDescriptionInput.value = "";
          lessonIsFreeInput.value = "true";
          saveLessonBtn.textContent = S.saveLesson;
        }

        window.editLessonById = function editLessonById(lessonId) {
          const lesson = currentTeacherLessons.find((item) => item.id === lessonId);
          if (!lesson) return;
          editingLessonId = lesson.id;
          lessonNumberInput.value = lesson.lesson_number;
          lessonDurationInput.value = lesson.duration_sec || "";
          lessonTitleInput.value = lesson.title || "";
          lessonPreviewInput.value = lesson.preview_url || "";
          lessonDescriptionInput.value = lesson.description || "";
          lessonIsFreeInput.value = lesson.is_free ? "true" : "false";
          saveLessonBtn.textContent = S.updateLesson;
        };

        saveLessonBtn.addEventListener("click", async () => {
          const courseId = Number(teacherCourseSelect.value);
          if (!courseId) return tg.showAlert(S.chooseCourseError);

          const payload = {
            lessonNumber: Number(lessonNumberInput.value),
            title: lessonTitleInput.value.trim(),
            description: lessonDescriptionInput.value.trim(),
            isFree: lessonIsFreeInput.value === "true",
            durationSec: lessonDurationInput.value ? Number(lessonDurationInput.value) : null,
            previewUrl: lessonPreviewInput.value.trim() || null,
          };

          if (!payload.lessonNumber || !payload.title) return tg.showAlert(S.fillLessonError);

          if (editingLessonId) {
            await apiFetch(`/api/teacher/lessons/${editingLessonId}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
          } else {
            await apiFetch(`/api/teacher/courses/${courseId}/lessons`, {
              method: "POST",
              body: JSON.stringify(payload),
            });
          }

          resetLessonForm();
          await loadTeacherLessonsData();
          tg.showAlert(S.lessonSaved);
        });

        await loadTeacherCoursesData();
        await loadTeacherLessonsData();
      }
