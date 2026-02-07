async function renderStudentScreen() {
        if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(true);
        studentScreen.classList.add("flat-list");
        selectedTeacherId = null;
        openedStudentCourseId = null;
        openedLessonNumber = null;
        const [teachers, styles] = await Promise.all([apiFetch("/api/teachers"), apiFetch("/api/styles")]);
        currentStudentTeachers = teachers;
        currentStyles = styles;
        const styleQuery = selectedStyleId ? `&styleId=${selectedStyleId}` : "";
        const teacherQuery = selectedTeacherFilterId ? `&teacherId=${selectedTeacherFilterId}` : "";
        const purchasedQuery = studentCatalogMode === "subscriptions" ? "&purchased=1" : "";
        const courses = await apiFetch(`/api/student/courses?1=1${styleQuery}${teacherQuery}${purchasedQuery}`);
        currentStudentCourses = courses;
        studentScreen.innerHTML = `
          <div class="catalog-surface">
            <div class="catalog-head">
              ${renderStyleFilterChips(styles)}
            </div>
            <div class="catalog-inner">
              <div class="catalog-bar">
                <div class="catalog-row">
                  <div class="teacher-filter-wrap">
                    ${renderTeacherFilterControl(teachers)}
                  </div>
                </div>
                ${renderTeacherPicker(teachers)}
              </div>
              <div class="catalog-courses-grid">
              ${
                courses.length
                  ? courses
                      .map(
                        (course) => {
                          const levelClass = getCourseLevelClass(course.level);
                          const directionClass = getCourseDirectionClass(course);
                          const levelLabel = getCourseLevelLabel(course.level);
                          const teacherName = String(course.teacher_name || "Преподаватель");
                          const teacherAbout = String(course.teacher_about_short || "").trim();
                          const progressPercent = Number(course.progress_percent || 0);
                          return `
                    <div class="course-card catalog-course-card dir-${directionClass}" onclick="openCourse(${course.id})">
                      <div class="course-head">
                        <div class="course-card-title">${escapeHtml(course.title)}</div>
                        <div class="course-head-side">
                          <span class="course-level-badge ${levelClass}">${levelLabel}</span>
                        </div>
                      </div>
                      <div class="course-top-row">
                        <div class="course-author">
                          ${renderCourseAuthorAvatar(course)}
                          <div class="course-author-text">
                            <div class="course-author-name" title="${escapeHtml(teacherName)}">${escapeHtml(teacherName)}</div>
                            ${
                              teacherAbout
                                ? `<div class="course-author-about" title="${escapeHtml(teacherAbout)}">${escapeHtml(teacherAbout)}</div>`
                                : ""
                            }
                          </div>
                        </div>
                        ${
                          progressPercent > 0
                            ? `<div class="course-progress-inline">
                                <div class="course-progress-track">
                                  <div class="course-progress-fill" style="width:${Math.max(0, Math.min(100, progressPercent))}%"></div>
                                </div>
                                <div class="course-progress-label">${progressPercent}%</div>
                              </div>`
                            : ""
                        }
                      </div>
                    </div>
                  `;
                        }
                      )
                      .join("")
                  : `<small class="muted">Курсы не найдены.</small>`
              }
              </div>
            </div>
          </div>
        `;
      }

      async function loadCourses(teacherId) {
        if (typeof setUserHeaderVisible === "function") setUserHeaderVisible(true);
        studentScreen.classList.remove("flat-list");
        selectedTeacherId = teacherId;
        openedStudentCourseId = null;
        openedLessonNumber = null;
        const selectedTeacher = currentStudentTeachers.find((teacher) => Number(teacher.id) === Number(teacherId));
        studentScreen.innerHTML = `
          ${renderStudentHeader(S.coursesTitle, S.loadingCourses, "renderStudentScreen()")}
        `;
        const styleQuery = selectedStyleId ? `?styleId=${selectedStyleId}` : "";
        const courses = await apiFetch(`/api/courses/${teacherId}${styleQuery}`);
        currentStudentCourses = courses;
        const coursesSubtitle = selectedTeacher
          ? `Преподаватель: ${selectedTeacher.name}${
              selectedStyleId
                ? ` • ${currentStyles.find((item) => String(item.id) === String(selectedStyleId))?.name || ""}`
                : ""
            }`
          : "Выбери курс для старта.";

        studentScreen.innerHTML = `
          ${renderStudentHeader(S.coursesTitle, coursesSubtitle, "renderStudentScreen()")}
          <div class="stack">
            ${
              courses.length
                ? courses
                    .map(
                      (course) => `
                  <div class="course-card">
                    <div class="course-card-title">${escapeHtml(course.title)}</div>
                    <small class="muted">${escapeHtml(course.description || "")}</small>
                    <div class="course-card-meta">
                      <small class="muted">${S.priceLabel}: ${formatRub(course.price)}</small>
                      <small class="pill ${course.is_purchased ? "free" : "paid"}">${course.is_purchased ? S.purchased : S.notPurchased}</small>
                    </div>
                    <button onclick="openCourse(${course.id})">Открыть уроки</button>
                  </div>
                `
                    )
                    .join("")
                : `<small class="muted">По выбранным фильтрам курсы не найдены.</small>`
            }
          </div>
        `;
      }

