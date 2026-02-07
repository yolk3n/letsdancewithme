let teacherStudioTab = "overview";
let teacherStudioEditCourseId = null;
let teacherStudioEditLessonId = null;
let teacherStudioCreateCourseOpen = false;
let teacherStudioLessonFormOpen = false;

function studioLevelLabel(level) {
  if (level === "advanced") return "Продвинутый";
  if (level === "professional") return "Профессионал";
  return "Новичок";
}

function studioDirectionClass(course) {
  const styles = Array.isArray(course?.styles) ? course.styles.map((item) => String(item?.name || "")) : [];
  const haystack = `${styles.join(" ")} ${String(course?.title || "")}`.toLowerCase();
  if (haystack.includes("salsa") || haystack.includes("сальс")) return "salsa";
  if (haystack.includes("bachata") || haystack.includes("бачат")) return "bachata";
  if (haystack.includes("kizomba") || haystack.includes("кизомб")) return "kizomba";
  return "salsa";
}

function studioFormatMoney(value) {
  const num = Number(value || 0);
  return `₽ ${new Intl.NumberFormat("ru-RU").format(Math.round(num))}`;
}

function studioInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "T";
}

function studioFormatDuration(sec) {
  const value = Number(sec || 0);
  if (!value) return "--:--";
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function studioBuildOverview(courses, studentsCount) {
  const publishedCourses = courses.filter((c) => c.is_published);
  const earnings = publishedCourses.reduce((sum, item) => sum + Number(item.price || 0), 0);

  return `
    <section class="studio-overview">
      <div class="studio-stats-grid">
        <article class="studio-stat-card">
          <div class="studio-stat-icon earnings">$</div>
          <div class="studio-stat-label">Доход</div>
          <div class="studio-stat-value">${studioFormatMoney(earnings)}</div>
        </article>
        <article class="studio-stat-card">
          <div class="studio-stat-icon students">👥</div>
          <div class="studio-stat-label">Студенты</div>
          <div class="studio-stat-value">${Number(studentsCount || 0)}</div>
        </article>
      </div>

      <button class="studio-create-course-btn" onclick="teacherStudioOpenCreate()">+ Создать новый курс</button>

      <div class="studio-courses-list">
        ${
          courses.length
            ? courses
                .slice(0, 6)
                .map((course) => {
                  const directionClass = studioDirectionClass(course);
                  const level = studioLevelLabel(course.level);
                  return `
                    <article class="studio-course-card dir-${directionClass}">
                      <div class="studio-course-title">${escapeHtml(course.title || "Курс")}</div>
                      <div class="studio-course-meta-row">
                        <span class="studio-course-mini">${escapeHtml(level)}</span>
                        <span class="studio-course-mini">${course.is_published ? "Опубликован" : "Скрыт"}</span>
                      </div>
                      <div class="studio-course-foot">
                        <div class="studio-course-price">${studioFormatMoney(course.price)}</div>
                        <button class="secondary studio-edit-btn" onclick="teacherStudioEditCourse(${course.id})">✎</button>
                      </div>
                    </article>
                  `;
                })
                .join("")
            : `<div class="studio-empty muted">Курсов пока нет</div>`
        }
      </div>
    </section>
  `;
}

function studioBuildCreateCourseForm() {
  return `
    <section class="studio-panel" id="studioCreateCourseCard">
      <h3>Новый курс</h3>
      <input id="studioCreateCourseTitle" placeholder="${S.courseNamePh}" />
      <input id="studioCreateCourseDescription" placeholder="${S.courseDescriptionPh}" />
      <div class="row">
        <input id="studioCreateCoursePrice" type="number" min="199" placeholder="${S.coursePricePh}" />
        <select id="studioCreateCourseLevel">
          <option value="beginner">Новичок</option>
          <option value="advanced">Продвинутый</option>
          <option value="professional">Профессионал</option>
        </select>
      </div>
      <div class="row">
        <select id="studioCreateCoursePublished">
          <option value="true">${S.published}</option>
          <option value="false">${S.hidden}</option>
        </select>
      </div>
      <button onclick="teacherStudioCreateCourse()">${S.createCourse}</button>
    </section>
  `;
}

function studioBuildCoursesList(courses) {
  return `
    <section class="studio-panel">
      <div class="studio-curriculum-head">
        <h3>Мои курсы</h3>
        <button class="secondary studio-add-lesson-btn" onclick="teacherStudioToggleCreateCourse()">
          ${teacherStudioCreateCourseOpen ? "Закрыть" : "+ Курс"}
        </button>
      </div>
      <div class="studio-courses-compact-list">
        ${
          courses.length
            ? courses
                .map(
                  (course) => `
                    <button class="studio-course-row" onclick="teacherStudioEditCourse(${course.id})">
                      <span class="studio-course-row-main">
                        <span class="studio-course-row-title">${escapeHtml(course.title || "Курс")}</span>
                        <span class="studio-course-row-sub muted">${studioLevelLabel(course.level)} • ${course.is_published ? "Опубликован" : "Скрыт"}</span>
                      </span>
                      <span class="studio-course-row-price">${studioFormatMoney(course.price)}</span>
                    </button>
                  `
                )
                .join("")
            : `<div class="studio-empty muted">Курсов пока нет</div>`
        }
      </div>
    </section>
  `;
}

function studioBuildLessonForm(courseId, editingLesson) {
  return `
    <div class="studio-lesson-form">
      <div class="row">
        <input id="studioLessonNumber" type="number" min="1" placeholder="${S.lessonNumberPh}" value="${editingLesson ? Number(editingLesson.lesson_number || "") : ""}" />
        <input id="studioLessonDuration" type="number" min="1" placeholder="${S.lessonDurationPh}" value="${editingLesson ? Number(editingLesson.duration_sec || "") : ""}" />
      </div>
      <input id="studioLessonTitle" placeholder="${S.lessonNamePh}" value="${editingLesson ? escapeHtml(editingLesson.title || "") : ""}" />
      <input id="studioLessonPreviewUrl" placeholder="${S.lessonPreviewPh}" value="${editingLesson ? escapeHtml(editingLesson.preview_url || "") : ""}" />
      <textarea id="studioLessonDescription" placeholder="${S.lessonDescriptionPh}">${editingLesson ? escapeHtml(editingLesson.description || "") : ""}</textarea>

      <input id="studioLessonTipText" placeholder="Текст подсказки" value="${editingLesson ? escapeHtml(editingLesson.tip_text || "") : ""}" />
      <div class="row">
        <input id="studioLessonAudioTitle" placeholder="Название mp3" value="${editingLesson ? escapeHtml(editingLesson.audio_title || "") : ""}" />
        <input id="studioLessonAudioDuration" type="number" min="1" placeholder="Длительность mp3 (сек)" value="${editingLesson ? Number(editingLesson.audio_duration_sec || "") : ""}" />
      </div>
      <input id="studioLessonAudioUrl" placeholder="Ссылка на mp3" value="${editingLesson ? escapeHtml(editingLesson.audio_url || "") : ""}" />

      <select id="studioLessonIsFree">
        <option value="true" ${editingLesson?.is_free ? "selected" : ""}>${S.lessonFree}</option>
        <option value="false" ${editingLesson && !editingLesson.is_free ? "selected" : ""}>${S.lessonPaid}</option>
      </select>

      <div class="studio-lesson-actions">
        <button onclick="teacherStudioSaveLesson(${courseId})">${editingLesson ? S.updateLesson : S.saveLesson}</button>
        <button class="secondary" onclick="teacherStudioResetLessonEdit()">Отмена</button>
      </div>
    </div>
  `;
}

function studioBuildEditCourse(course, lessons, editingLesson) {
  return `
    <section class="studio-edit-course">
      <div class="studio-edit-head">
        <button class="secondary studio-back-btn" onclick="teacherStudioCloseEditCourse()">← Назад</button>
        <h3>Редактирование курса</h3>
      </div>

      <section class="studio-panel">
        <small class="studio-section-kicker">BASIC INFORMATION</small>
        <input id="studioEditCourseTitle" value="${escapeHtml(course.title || "")}" placeholder="${S.courseNamePh}" />
        <input id="studioEditCourseDescription" value="${escapeHtml(course.description || "")}" placeholder="${S.courseDescriptionPh}" />
        <div class="row">
          <input id="studioEditCoursePrice" type="number" min="199" value="${Number(course.price || 0)}" placeholder="${S.coursePricePh}" />
          <select id="studioEditCourseLevel">
            <option value="beginner" ${course.level === "beginner" ? "selected" : ""}>Новичок</option>
            <option value="advanced" ${course.level === "advanced" ? "selected" : ""}>Продвинутый</option>
            <option value="professional" ${course.level === "professional" ? "selected" : ""}>Профессионал</option>
          </select>
        </div>
        <div class="row">
          <select id="studioEditCoursePublished">
            <option value="true" ${course.is_published ? "selected" : ""}>${S.published}</option>
            <option value="false" ${!course.is_published ? "selected" : ""}>${S.hidden}</option>
          </select>
        </div>
        <button onclick="teacherStudioSaveCourse(${course.id})">Сохранить курс</button>
      </section>

      <section class="studio-panel">
        <div class="studio-curriculum-head">
          <small class="studio-section-kicker">CURRICULUM</small>
          <button class="secondary studio-add-lesson-btn" onclick="teacherStudioOpenLessonCreate()">
            ${teacherStudioLessonFormOpen ? "Закрыть" : "+ Урок"}
          </button>
        </div>

        <div class="studio-lessons-list">
          ${
            lessons.length
              ? lessons
                  .map(
                    (lesson) => `
                      <button class="studio-lesson-row" onclick="teacherStudioStartLessonEdit(${lesson.id})">
                        <span class="studio-lesson-row-main">
                          <span class="studio-lesson-row-title">${escapeHtml(lesson.title || `Урок ${lesson.lesson_number}`)}</span>
                          <span class="studio-lesson-row-sub muted">${studioFormatDuration(lesson.duration_sec)} • ${lesson.is_free ? "free" : "paid"}</span>
                        </span>
                      </button>
                    `
                  )
                  .join("")
              : `<div class="studio-empty muted">Уроков пока нет</div>`
          }
        </div>

        ${teacherStudioLessonFormOpen ? studioBuildLessonForm(course.id, editingLesson) : ""}
      </section>
    </section>
  `;
}

async function renderTeacherScreen() {
  if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(true);
  teacherScreen.classList.remove("flat-list");
  teacherScreen.innerHTML = renderCenteredLoader(S.loading);

  const [profile, courses, teachers] = await Promise.all([
    apiFetch("/api/teacher/profile"),
    apiFetch("/api/teacher/courses"),
    apiFetch("/api/teachers"),
  ]);

  currentTeacherCourses = courses;
  const teacherPublicData = teachers.find((item) => Number(item.id) === Number(profile.id));
  const studentsCount = Number(teacherPublicData?.students_count || 0);

  const avatar = profile.avatar_url
    ? `<img class="studio-avatar" src="${escapeHtml(profile.avatar_url)}" alt="avatar" />`
    : `<span class="studio-avatar-fallback">${escapeHtml(studioInitials(profile.name || "T"))}</span>`;

  let editCourse = null;
  let lessons = [];
  let editingLesson = null;

  if (teacherStudioEditCourseId) {
    editCourse = courses.find((item) => Number(item.id) === Number(teacherStudioEditCourseId)) || null;
    if (!editCourse) {
      teacherStudioEditCourseId = null;
      teacherStudioEditLessonId = null;
      teacherStudioLessonFormOpen = false;
    } else {
      lessons = await apiFetch(`/api/teacher/courses/${editCourse.id}/lessons`);
      currentTeacherLessons = lessons;
      editingLesson = lessons.find((item) => Number(item.id) === Number(teacherStudioEditLessonId)) || null;
    }
  }

  teacherScreen.innerHTML = `
    <div class="studio-screen">
      <section class="studio-header-card">
        <div class="studio-top-row">
          <button class="secondary course-hero-icon-btn" onclick="openStudentScreen()" aria-label="Назад">
            <img src="/assets/back.svg" alt="" class="course-hero-icon" aria-hidden="true" />
          </button>
          <h2>Instructor Studio</h2>
        </div>

        <div class="studio-profile-row">
          ${avatar}
          <div class="studio-profile-copy">
            <div class="studio-profile-name">${escapeHtml(profile.name || "Преподаватель")}</div>
            <div class="studio-profile-sub">${escapeHtml(profile.about_short || "Dance Specialist")}</div>
          </div>
        </div>

        <div class="studio-tabs" role="tablist" aria-label="Разделы кабинета">
          <button class="${teacherStudioTab === "overview" ? "active" : ""}" onclick="teacherStudioSetTab('overview')">Overview</button>
          <button class="${teacherStudioTab === "courses" ? "active" : ""}" onclick="teacherStudioSetTab('courses')">My Courses</button>
        </div>
      </section>

      ${
        teacherStudioTab === "overview"
          ? studioBuildOverview(courses, studentsCount)
          : `
            <section class="studio-body">
              ${teacherStudioCreateCourseOpen ? studioBuildCreateCourseForm() : ""}
              ${studioBuildCoursesList(courses)}
              ${editCourse ? studioBuildEditCourse(editCourse, lessons, editingLesson) : ""}
            </section>
          `
      }
    </div>
  `;
}

async function teacherStudioSetTab(tab) {
  teacherStudioTab = tab === "courses" ? "courses" : "overview";
  teacherStudioCreateCourseOpen = false;
  teacherStudioLessonFormOpen = false;
  if (teacherStudioTab !== "courses") {
    teacherStudioEditCourseId = null;
    teacherStudioEditLessonId = null;
  }
  await renderTeacherScreen();
}

async function teacherStudioOpenCreate() {
  teacherStudioTab = "courses";
  teacherStudioCreateCourseOpen = true;
  teacherStudioLessonFormOpen = false;
  teacherStudioEditCourseId = null;
  teacherStudioEditLessonId = null;
  await renderTeacherScreen();
  const node = document.getElementById("studioCreateCourseCard");
  if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function teacherStudioToggleCreateCourse() {
  teacherStudioCreateCourseOpen = !teacherStudioCreateCourseOpen;
  if (teacherStudioCreateCourseOpen) {
    teacherStudioEditCourseId = null;
    teacherStudioEditLessonId = null;
    teacherStudioLessonFormOpen = false;
  }
  await renderTeacherScreen();
}

async function teacherStudioEditCourse(courseId) {
  teacherStudioTab = "courses";
  teacherStudioCreateCourseOpen = false;
  teacherStudioLessonFormOpen = false;
  teacherStudioEditCourseId = Number(courseId);
  teacherStudioEditLessonId = null;
  await renderTeacherScreen();
}

async function teacherStudioCloseEditCourse() {
  teacherStudioEditCourseId = null;
  teacherStudioEditLessonId = null;
  teacherStudioLessonFormOpen = false;
  await renderTeacherScreen();
}

async function teacherStudioCreateCourse() {
  const title = document.getElementById("studioCreateCourseTitle")?.value.trim();
  const description = document.getElementById("studioCreateCourseDescription")?.value.trim() || "";
  const price = Number(document.getElementById("studioCreateCoursePrice")?.value || 0);
  const level = document.getElementById("studioCreateCourseLevel")?.value || "beginner";
  const isPublished = (document.getElementById("studioCreateCoursePublished")?.value || "true") === "true";

  if (!title) return tg.showAlert(S.needCourseName);
  if (!Number.isFinite(price) || price < 199) return tg.showAlert(S.minCoursePriceError);

  await apiFetch("/api/teacher/courses", {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      price,
      level,
      isPublished,
      styleIds: [],
    }),
  });

  tg.showAlert(S.courseCreated);
  teacherStudioCreateCourseOpen = false;
  await renderTeacherScreen();
}

async function teacherStudioSaveCourse(courseId) {
  const title = document.getElementById("studioEditCourseTitle")?.value.trim();
  const description = document.getElementById("studioEditCourseDescription")?.value.trim() || "";
  const price = Number(document.getElementById("studioEditCoursePrice")?.value || 0);
  const level = document.getElementById("studioEditCourseLevel")?.value || "beginner";
  const isPublished = (document.getElementById("studioEditCoursePublished")?.value || "true") === "true";

  if (!title) return tg.showAlert(S.needCourseName);
  if (!Number.isFinite(price) || price < 199) return tg.showAlert(S.minCoursePriceError);

  await apiFetch(`/api/teacher/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify({
      title,
      description,
      price,
      level,
      isPublished,
    }),
  });

  tg.showAlert("Курс обновлён");
  await renderTeacherScreen();
}

async function teacherStudioStartLessonEdit(lessonId) {
  teacherStudioEditLessonId = Number(lessonId);
  teacherStudioLessonFormOpen = true;
  teacherStudioCreateCourseOpen = false;
  await renderTeacherScreen();
}

async function teacherStudioOpenLessonCreate() {
  if (teacherStudioLessonFormOpen && !teacherStudioEditLessonId) {
    teacherStudioLessonFormOpen = false;
  } else {
    teacherStudioLessonFormOpen = true;
    teacherStudioEditLessonId = null;
  }
  await renderTeacherScreen();
}

async function teacherStudioResetLessonEdit() {
  teacherStudioEditLessonId = null;
  teacherStudioLessonFormOpen = false;
  await renderTeacherScreen();
}

async function teacherStudioSaveLesson(courseId) {
  const payload = {
    lessonNumber: Number(document.getElementById("studioLessonNumber")?.value || 0),
    title: (document.getElementById("studioLessonTitle")?.value || "").trim(),
    description: (document.getElementById("studioLessonDescription")?.value || "").trim(),
    isFree: (document.getElementById("studioLessonIsFree")?.value || "true") === "true",
    durationSec: document.getElementById("studioLessonDuration")?.value
      ? Number(document.getElementById("studioLessonDuration").value)
      : null,
    previewUrl: (document.getElementById("studioLessonPreviewUrl")?.value || "").trim() || null,
    tipText: (document.getElementById("studioLessonTipText")?.value || "").trim() || null,
    audioTitle: (document.getElementById("studioLessonAudioTitle")?.value || "").trim() || null,
    audioUrl: (document.getElementById("studioLessonAudioUrl")?.value || "").trim() || null,
    audioDurationSec: document.getElementById("studioLessonAudioDuration")?.value
      ? Number(document.getElementById("studioLessonAudioDuration").value)
      : null,
  };

  if (!payload.lessonNumber || !payload.title) return tg.showAlert(S.fillLessonError);

  if (teacherStudioEditLessonId) {
    await apiFetch(`/api/teacher/lessons/${teacherStudioEditLessonId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  } else {
    await apiFetch(`/api/teacher/courses/${courseId}/lessons`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  teacherStudioEditLessonId = null;
  teacherStudioLessonFormOpen = false;
  tg.showAlert(S.lessonSaved);
  await renderTeacherScreen();
}

window.teacherStudioSetTab = teacherStudioSetTab;
window.teacherStudioOpenCreate = teacherStudioOpenCreate;
window.teacherStudioToggleCreateCourse = teacherStudioToggleCreateCourse;
window.teacherStudioEditCourse = teacherStudioEditCourse;
window.teacherStudioCloseEditCourse = teacherStudioCloseEditCourse;
window.teacherStudioCreateCourse = teacherStudioCreateCourse;
window.teacherStudioSaveCourse = teacherStudioSaveCourse;
window.teacherStudioStartLessonEdit = teacherStudioStartLessonEdit;
window.teacherStudioOpenLessonCreate = teacherStudioOpenLessonCreate;
window.teacherStudioResetLessonEdit = teacherStudioResetLessonEdit;
window.teacherStudioSaveLesson = teacherStudioSaveLesson;
