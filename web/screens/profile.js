async function renderProfileScreen() {
        profileScreen.innerHTML = `
          ${renderStudentHeader("Профиль", "", "openStudentScreen()")}
          <div class="profile-menu">
            <button onclick="openMySubscriptions()">Мои подписки</button>
            ${currentUser.role === "teacher" || currentUser.role === "admin" ? `<button onclick="openTeacherCabinet()">Мои курсы</button>` : ""}
            ${currentUser.role === "admin" ? `<button onclick="openAdminPanel()">Администрирование</button>` : ""}
            <button class="secondary" onclick="openSupport()">Поддержка</button>
            <button class="secondary" onclick="openAllCourses()">Все курсы</button>
          </div>
        `;
      }

      async function completeOnboarding() {
        await apiFetch("/api/onboarding/complete", { method: "POST" });
        await loadCurrentUser();
        await routeByRole();
      }

      async function routeByRole() {
        onboardingCard.classList.add("hidden");
        studentScreen.classList.add("hidden");
        profileScreen.classList.add("hidden");
        teacherScreen.classList.add("hidden");
        adminScreen.classList.add("hidden");

        if (selectedAppScreen === "profile") {
          profileScreen.classList.remove("hidden");
          await renderProfileScreen();
          return;
        }

        const canUseTeacher = currentUser.role === "teacher" || currentUser.role === "admin";
        const canUseAdmin = currentUser.role === "admin";
        const showTeacherScreen = selectedAppScreen === "teacher" && canUseTeacher;
        const showAdminScreen = selectedAppScreen === "admin" && canUseAdmin;

        if (!currentUser.is_onboarded && !(showTeacherScreen || showAdminScreen)) {
          onboardingCard.classList.remove("hidden");
        }

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
