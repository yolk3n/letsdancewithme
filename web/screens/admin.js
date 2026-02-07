async function renderAdminScreen() {
        adminScreen.innerHTML = `
          <b>${S.adminPanelTitle}</b>
          <p class="muted">${S.adminPanelText}</p>
          <button class="secondary" id="refreshAdminUsersBtn">${S.refreshUsers}</button>
          <div id="adminUsersList" class="muted">${S.loadingUsers}</div>
        `;

        const refreshAdminUsersBtn = document.getElementById("refreshAdminUsersBtn");
        const adminUsersList = document.getElementById("adminUsersList");

        async function loadAdminUsers() {
          currentAdminUsers = await apiFetch("/api/admin/users");
          adminUsersList.innerHTML = currentAdminUsers.length
            ? currentAdminUsers
                .map(
                  (user) => `
                    <div class="user-row">
                      ${
                        user.avatar_url
                          ? `<img class="teacher-avatar" src="${escapeHtml(user.avatar_url)}" alt="avatar" />`
                          : `<span class="teacher-avatar-fallback">${escapeHtml(
                              getInitials(user.first_name || user.username || String(user.telegram_id))
                            )}</span>`
                      }
                      <b>${escapeHtml(
                        [user.first_name, user.last_name].filter(Boolean).join(" ") || "Без имени"
                      )}</b><br/>
                      ${
                        user.username
                          ? `<small class="muted">@${escapeHtml(user.username)}</small><br/>`
                          : ""
                      }
                      <b>${S.userIdLabel}:</b> ${user.telegram_id}<br/>
                      <small class="muted">${S.userRoleLabel}: ${escapeHtml(user.role)} | XP: ${user.xp} | ${S.userLessonsLabel}: ${user.lessons_completed}</small>
                      <div class="role-switch-row">
                        <small>${S.teacherRoleSwitch}${user.telegram_id === currentUser.telegram_id ? " (недоступно для себя)" : ""}</small>
                        <label class="switch">
                          <input
                            type="checkbox"
                            ${user.role === "teacher" ? "checked" : ""}
                            ${user.telegram_id === currentUser.telegram_id ? "disabled" : ""}
                            onchange="setTeacherRoleSwitch(${user.telegram_id}, this.checked)"
                          />
                          <span class="slider"></span>
                        </label>
                      </div>
                    </div>
                  `
                )
                .join("")
            : S.usersEmpty;
        }

        window.setTeacherRoleSwitch = async function setTeacherRoleSwitch(telegramId, checked) {
          if (Number(telegramId) === Number(currentUser.telegram_id)) {
            tg.showAlert("Нельзя изменить свою роль из админ-панели");
            return;
          }
          const role = checked ? "teacher" : "student";
          await apiFetch(`/api/admin/users/${telegramId}/role`, {
            method: "PUT",
            body: JSON.stringify({ role }),
          });
          tg.showAlert(S.roleUpdated);
          await loadAdminUsers();
        };

        refreshAdminUsersBtn.addEventListener("click", loadAdminUsers);
        await loadAdminUsers();
      }
