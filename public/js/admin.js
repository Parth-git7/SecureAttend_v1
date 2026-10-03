// ============================================================
// STATE
// ============================================================

let jwtToken = localStorage.getItem("sa_admin_token");

let currentUser = JSON.parse(
    localStorage.getItem("sa_admin_user") || "null"
);

let currentPage = "overview";
let deleteCallback = null;

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();
    setupEventListeners();
});


// ============================================================
// AUTH STATE
// ============================================================

function checkAuthState() {
    if (jwtToken && currentUser && currentUser.role === "ADMIN") {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById("login-section").classList.add("active");
    document.getElementById("dashboard-section").classList.remove("active");
}

function showDashboard() {
    document.getElementById("login-section").classList.remove("active");
    document.getElementById("dashboard-section").classList.add("active");

    // Populate sidebar profile
    const initials = currentUser.name
        ? currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : "A";
    document.getElementById("admin-avatar-initials").textContent = initials;
    document.getElementById("sidebar-admin-name").textContent = currentUser.name || "Admin";
    document.getElementById("topbar-email").textContent = currentUser.email || "";
    document.getElementById("topbar-subtitle").textContent = `Welcome back, ${currentUser.name || "Admin"}`;

    navigateTo("overview");
    loadDropdowns();
}


// ============================================================
// GOOGLE LOGIN
// ============================================================

async function handleGoogleCredential(response) {
    try {
        const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Authentication failed");
        if (data.user.role !== "ADMIN") throw new Error("Access denied. Admin privileges required.");

        jwtToken = data.token;
        currentUser = data.user;
        localStorage.setItem("sa_admin_token", jwtToken);
        localStorage.setItem("sa_admin_user", JSON.stringify(currentUser));
        checkAuthState();

    } catch (error) {
        const el = document.getElementById("login-error");
        el.textContent = error.message;
        el.style.display = "block";
    }
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {
    localStorage.removeItem("sa_admin_token");
    localStorage.removeItem("sa_admin_user");
    jwtToken = null;
    currentUser = null;
    checkAuthState();
}


// ============================================================
// NAVIGATION
// ============================================================

function navigateTo(page) {
    currentPage = page;

    // Update sidebar items
    document.querySelectorAll(".nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.page === page);
    });

    // Hide all sections, show target
    document.querySelectorAll(".page-section").forEach(el => {
        el.classList.remove("active");
    });
    const section = document.getElementById("page-" + page);
    if (section) section.classList.add("active");

    // Update topbar
    const titles = {
        overview:  ["Dashboard Overview", `Welcome back, ${currentUser?.name || "Admin"}`],
        users:     ["User Management", "Manage student & teacher accounts"],
        teachers:  ["Teachers", "All registered teachers"],
        periods:   ["Academic Periods", "Manage semesters and sessions"],
        groups:    ["Groups", "Create and manage groups"],
        subjects:  ["Subjects", "Manage course subjects"]
    };
    const [title, sub] = titles[page] || ["Dashboard", ""];
    document.getElementById("topbar-title").textContent = title;
    document.getElementById("topbar-subtitle").textContent = sub;

    // Lazy-load data for each page
    if (page === "overview") loadOverviewStats();
    if (page === "users")    loadStudents();
    if (page === "teachers") loadTeachers();
    if (page === "periods")  loadAcademicPeriods();
    if (page === "groups")   loadGroups();
    if (page === "subjects") loadSubjects();
}


// ============================================================
// API HELPER
// ============================================================

async function apiRequest(method, path, body) {
    const opts = {
        method,
        headers: {
            "Authorization": `Bearer ${jwtToken}`,
            "Content-Type": "application/json"
        }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(path, opts);
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }

    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
}


// ============================================================
// ALERT HELPER
// ============================================================

function showAlert(alertId, type, message) {
    const el = document.getElementById(alertId);
    if (!el) return;
    el.className = `alert alert-${type} show`;
    el.querySelector(".alert-icon").textContent = type === "success" ? "âœ…" : type === "error" ? "âŒ" : "â„¹ï¸";
    el.querySelector(".alert-msg").textContent = message;
    setTimeout(() => { el.classList.remove("show"); }, 5000);
}


// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(id) {
    document.getElementById(id).classList.add("open");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
}


// ============================================================
// LOAD DROPDOWNS (called on dashboard load)
// ============================================================

async function loadDropdowns() {
    await Promise.all([
        loadAcademicPeriodsForGroup(),
        loadBranches(),
        loadSemestersForGroup(),
        loadGroupsForDropdowns(),
        loadSubjectsForDropdowns(),
        loadStudentsForDropdowns()
    ]);
}

async function loadAcademicPeriodsForGroup() {
    try {
        const data = await apiRequest("GET", "/api/academic/academic-periods");
        const selects = ["group-academic-period"];
        selects.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = `<option value="">â€” Select Period â€”</option>`;
            data.academicPeriods.forEach(p => {
                sel.innerHTML += `<option value="${p._id}">${p.name}</option>`;
            });
        });
    } catch (e) { console.error("Load periods for group:", e); }
}

async function loadGroupsForDropdowns() {
    try {
        const data = await apiRequest("GET", "/api/admin/groups");
        const selects = ["assign-subject-group", "assign-student-group"];
        selects.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = `<option value="">-- Select Group --</option>`;
            data.groups.forEach(g => {
                const parts = [
                    g.academicPeriodId?.name,
                    g.branchId?.code,
                    g.semesterId ? `Sem ${g.semesterId.number}` : null
                ].filter(Boolean).join(", ");
                sel.innerHTML += `<option value="${g._id}">${esc(g.name)}${parts ? ` (${esc(parts)})` : ""}</option>`;
            });
        });
    } catch (e) { console.error("Load groups for dropdown:", e); }
}

async function loadSubjectsForDropdowns() {
    try {
        const data = await apiRequest("GET", "/api/admin/subjects");
        const sel = document.getElementById("assign-subject-subject");
        if (!sel) return;
        sel.innerHTML = `<option value="">â€” Select Subject â€”</option>`;
        data.subjects.forEach(s => {
            sel.innerHTML += `<option value="${s._id}">${s.name} (${s.code})</option>`;
        });
    } catch (e) { console.error("Load subjects for dropdown:", e); }
}

async function loadStudentsForDropdowns() {
    try {
        const data = await apiRequest("GET", "/api/admin/students");
        const sel = document.getElementById("assign-student-student");
        if (!sel) return;
        sel.innerHTML = `<option value="">â€” Select Student â€”</option>`;
        data.students.forEach(s => {
            sel.innerHTML += `<option value="${s.studentId}">${s.name} â€” ${s.rollNo}</option>`;
        });
    } catch (e) { console.error("Load students for dropdown:", e); }
}


// ============================================================
// OVERVIEW STATS
// ============================================================

async function loadOverviewStats() {
    document.getElementById("stat-students").textContent = "â€¦";
    document.getElementById("stat-teachers").textContent = "â€¦";
    document.getElementById("stat-groups").textContent = "â€¦";
    document.getElementById("stat-subjects").textContent = "â€¦";

    try {
        const [s, t, g, sub] = await Promise.all([
            apiRequest("GET", "/api/admin/students"),
            apiRequest("GET", "/api/admin/teachers"),
            apiRequest("GET", "/api/admin/groups"),
            apiRequest("GET", "/api/admin/subjects")
        ]);
        document.getElementById("stat-students").textContent = s.students.length;
        document.getElementById("stat-teachers").textContent = t.teachers.length;
        document.getElementById("stat-groups").textContent = g.groups.length;
        document.getElementById("stat-subjects").textContent = sub.subjects.length;
    } catch (e) {
        console.error("Load stats:", e);
    }
}


// ============================================================
// STUDENTS
// ============================================================

async function loadStudents() {
    const tbody = document.getElementById("students-table-body");
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-sm" style="padding:24px;text-align:center;">Loadingâ€¦</td></tr>`;
    try {
        const data = await apiRequest("GET", "/api/admin/students");
        if (!data.students.length) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">ðŸŽ“</div><p>No students yet. Create one from the Dashboard.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.students.map(s => `
            <tr>
                <td><span class="font-medium">${esc(s.name)}</span></td>
                <td class="td-secondary">${esc(s.email)}</td>
                <td><span class="badge badge-student">${esc(s.rollNo)}</span></td>
                <td class="td-secondary">${esc(s.batch)}</td>
                <td>
                    <div class="flex gap-8">
                        <button class="btn btn-secondary btn-sm btn-icon" title="Edit" onclick="openEditUser('${s.userId}','${esc(s.name)}','${esc(s.email)}')">âœï¸</button>
                        <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="confirmDelete('Delete student ${esc(s.name)}?', () => deleteUser('${s.userId}'))">ðŸ—‘ï¸</button>
                    </div>
                </td>
            </tr>`).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}


// ============================================================
// TEACHERS
// ============================================================

async function loadTeachers() {
    const tbody = document.getElementById("teachers-table-body");
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-sm" style="padding:24px;text-align:center;">Loadingâ€¦</td></tr>`;
    try {
        const data = await apiRequest("GET", "/api/admin/teachers");
        if (!data.teachers.length) {
            tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">ðŸ‘¨â€ðŸ«</div><p>No teachers yet.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.teachers.map(t => `
            <tr>
                <td><span class="font-medium">${esc(t.name)}</span></td>
                <td class="td-secondary">${esc(t.email)}</td>
                <td><span class="badge badge-teacher">${esc(t.employeeCode)}</span></td>
                <td>
                    <div class="flex gap-8">
                        <button class="btn btn-secondary btn-sm btn-icon" title="Edit" onclick="openEditUser('${t.userId}','${esc(t.name)}','${esc(t.email)}')">âœï¸</button>
                        <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="confirmDelete('Delete teacher ${esc(t.name)}?', () => deleteUser('${t.userId}'))">ðŸ—‘ï¸</button>
                    </div>
                </td>
            </tr>`).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}


// ============================================================
// ACADEMIC PERIODS
// ============================================================

async function loadAcademicPeriods() {
    const tbody = document.getElementById("periods-table-body");
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-sm" style="padding:24px;text-align:center;">Loadingâ€¦</td></tr>`;
    try {
        const data = await apiRequest("GET", "/api/academic/academic-periods");
        if (!data.academicPeriods.length) {
            tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-state-icon">ðŸ“…</div><p>No academic periods yet.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.academicPeriods.map(p => `
            <tr>
                <td class="font-medium">${esc(p.name)}</td>
                <td class="td-secondary">${formatDate(p.startDate)}</td>
                <td class="td-secondary">${formatDate(p.endDate)}</td>
            </tr>`).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}


// ============================================================
// GROUPS
// ============================================================

async function loadGroups() {
    const tbody = document.getElementById("groups-table-body");
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-sm" style="padding:24px;text-align:center;">Loading...</td></tr>`;
    try {
        const data = await apiRequest("GET", "/api/admin/groups");
        if (!data.groups.length) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>No groups yet.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.groups.map(g => `
            <tr>
                <td class="font-medium">${esc(g.name)}</td>
                <td class="td-secondary">${esc(g.academicPeriodId?.name || "-")}</td>
                <td class="td-secondary">${esc(g.branchId?.name || "-")}</td>
                <td class="td-secondary">${esc(g.semesterId?.name || "-")}</td>
                <td>
                    <div class="flex gap-8">
                        <button class="btn btn-secondary btn-sm" onclick="viewGroupStudents('${g._id}','${esc(g.name)}')">Students</button>
                        <button class="btn btn-secondary btn-sm" onclick="viewGroupSubjects('${g._id}','${esc(g.name)}')">Subjects</button>
                        <button class="btn btn-danger btn-sm btn-icon" title="Delete Group" onclick="confirmDelete('Delete group ${esc(g.name)}?', () => deleteGroup('${g._id}'))">X</button>
                    </div>
                </td>
            </tr>`).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}


// ============================================================
// SUBJECTS
// ============================================================

async function loadSubjects() {
    const tbody = document.getElementById("subjects-table-body");
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-sm" style="padding:24px;text-align:center;">Loadingâ€¦</td></tr>`;
    try {
        const data = await apiRequest("GET", "/api/admin/subjects");
        if (!data.subjects.length) {
            tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-state-icon">ðŸ“š</div><p>No subjects yet.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.subjects.map(s => `
            <tr>
                <td class="font-medium">${esc(s.name)}</td>
                <td><span class="badge badge-active">${esc(s.code)}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="confirmDelete('Delete subject ${esc(s.name)}?', () => deleteSubject('${s._id}'))">ðŸ—‘ï¸</button>
                </td>
            </tr>`).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}


// ============================================================
// VIEW GROUP STUDENTS MODAL
// ============================================================

async function viewGroupStudents(groupId, groupName) {
    document.getElementById("modal-group-students-title").textContent = `Students â€” ${groupName}`;
    const tbody = document.getElementById("modal-group-students-body");
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-sm" style="padding:16px;text-align:center;">Loadingâ€¦</td></tr>`;
    openModal("modal-group-students");

    try {
        const data = await apiRequest("GET", `/api/admin/groups/${groupId}/students`);
        if (!data.students.length) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">ðŸŽ“</div><p>No students in this group.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.students.map(s => `
            <tr>
                <td class="font-medium">${esc(s.name)}</td>
                <td class="td-secondary">${esc(s.email)}</td>
                <td>${esc(s.rollNo)}</td>
                <td class="td-secondary">${esc(s.batch)}</td>
                <td>
                    <button class="btn btn-danger btn-sm btn-icon" title="Remove" onclick="removeStudentFromGroup('${groupId}','${s.studentId}', this)">âœ•</button>
                </td>
            </tr>`).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}


// ============================================================
// VIEW GROUP SUBJECTS MODAL
// ============================================================

async function viewGroupSubjects(groupId, groupName) {
    document.getElementById("modal-group-subjects-title").textContent = `Subjects â€” ${groupName}`;
    const tbody = document.getElementById("modal-group-subjects-body");
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-sm" style="padding:16px;text-align:center;">Loadingâ€¦</td></tr>`;
    openModal("modal-group-subjects");

    try {
        const data = await apiRequest("GET", `/api/academic/groups/${groupId}/subjects`);
        if (!data.subjects.length) {
            tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-state-icon">ðŸ“š</div><p>No subjects assigned to this group.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.subjects.map(s => `
            <tr>
                <td class="font-medium">${esc(s.name)}</td>
                <td><span class="badge badge-active">${esc(s.code)}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm btn-icon" title="Remove" onclick="removeSubjectFromGroup('${groupId}','${s.subjectId}', this)">âœ•</button>
                </td>
            </tr>`).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}


// ============================================================
// REMOVE STUDENT / SUBJECT FROM GROUP
// ============================================================

async function removeStudentFromGroup(groupId, studentId, btn) {
    btn.disabled = true;
    try {
        await apiRequest("DELETE", `/api/admin/groups/${groupId}/students/${studentId}`);
        btn.closest("tr").remove();
    } catch (e) {
        btn.disabled = false;
        alert(e.message);
    }
}

async function removeSubjectFromGroup(groupId, subjectId, btn) {
    btn.disabled = true;
    try {
        await apiRequest("DELETE", `/api/admin/groups/${groupId}/subjects/${subjectId}`);
        btn.closest("tr").remove();
    } catch (e) {
        btn.disabled = false;
        alert(e.message);
    }
}


// ============================================================
// EDIT USER
// ============================================================

function openEditUser(userId, name, email) {
    document.getElementById("edit-user-id").value = userId;
    document.getElementById("edit-user-name").value = name;
    document.getElementById("edit-user-email").value = email;
    document.getElementById("edit-user-alert").classList.remove("show");
    openModal("modal-edit-user");
}

async function saveEditUser() {
    const userId = document.getElementById("edit-user-id").value;
    const name  = document.getElementById("edit-user-name").value.trim();
    const email = document.getElementById("edit-user-email").value.trim();

    try {
        await apiRequest("PUT", `/api/admin/users/${userId}`, { name, email });
        showAlert("edit-user-alert", "success", "User updated successfully.");
        setTimeout(() => {
            closeModal("modal-edit-user");
            if (currentPage === "users") loadStudents();
            if (currentPage === "teachers") loadTeachers();
        }, 1200);
    } catch (e) {
        showAlert("edit-user-alert", "error", e.message);
    }
}


// ============================================================
// DELETE HELPERS
// ============================================================

function confirmDelete(message, callback) {
    document.getElementById("confirm-delete-msg").textContent = message;
    deleteCallback = callback;
    openModal("modal-confirm-delete");
}

async function deleteUser(userId) {
    try {
        await apiRequest("DELETE", `/api/admin/users/${userId}`);
        closeModal("modal-confirm-delete");
        if (currentPage === "users") loadStudents();
        if (currentPage === "teachers") loadTeachers();
        await loadDropdowns();
    } catch (e) { alert(e.message); }
}

async function deleteGroup(groupId) {
    try {
        await apiRequest("DELETE", `/api/admin/groups/${groupId}`);
        closeModal("modal-confirm-delete");
        loadGroups();
        await loadGroupsForDropdowns();
    } catch (e) { alert(e.message); }
}

async function deleteSubject(subjectId) {
    try {
        await apiRequest("DELETE", `/api/admin/subjects/${subjectId}`);
        closeModal("modal-confirm-delete");
        loadSubjects();
        await loadSubjectsForDropdowns();
    } catch (e) { alert(e.message); }
}


// ============================================================
// CREATE USER (shared handler for both forms)
// ============================================================

async function handleCreateUserForm(formPrefix, alertId) {
    const suffix = formPrefix ? "-" + formPrefix : "";
    const name  = document.getElementById(`new-name${suffix}`).value.trim();
    const email = document.getElementById(`new-email${suffix}`).value.trim();
    const role  = document.getElementById(`new-role${suffix}`).value;

    const body = { name, email, role };

    if (role === "STUDENT") {
        body.rollNo = document.getElementById(`new-roll-no${suffix}`).value.trim();
        body.batch  = document.getElementById(`new-batch${suffix}`).value.trim();
    }
    if (role === "TEACHER") {
        body.employeeCode = document.getElementById(`new-employee-code${suffix}`).value.trim();
    }

    try {
        const data = await apiRequest("POST", "/api/admin/users", body);
        showAlert(alertId, "success", data.message || "Account created successfully.");
        document.getElementById(`create-user-form${suffix}`).reset();
        handleRoleChange(suffix);
        await loadDropdowns();
        if (currentPage === "users") loadStudents();
        if (currentPage === "teachers") loadTeachers();
        loadOverviewStats();
    } catch (e) {
        showAlert(alertId, "error", e.message);
    }
}


// ============================================================
// CREATE ACADEMIC PERIOD (shared handler)
// ============================================================

async function handleCreateAcademicPeriod(formId, alertId, nameId, startId, endId) {
    const name      = document.getElementById(nameId).value.trim();
    const startDate = document.getElementById(startId).value;
    const endDate   = document.getElementById(endId).value;

    try {
        const data = await apiRequest("POST", "/api/admin/academic-periods", { name, startDate, endDate });
        showAlert(alertId, "success", data.message || "Academic period created.");
        document.getElementById(formId).reset();
        await loadAcademicPeriodsForGroup();
        if (currentPage === "periods") loadAcademicPeriods();
    } catch (e) {
        showAlert(alertId, "error", e.message);
    }
}


// ============================================================
// ROLE CHANGE TOGGLE
// ============================================================

function handleRoleChange(suffix) {
    const sfx = suffix || "";
    const role     = document.getElementById(`new-role${sfx}`)?.value || "";
    const sfFields = document.getElementById(`student-fields${sfx}`);
    const tfFields = document.getElementById(`teacher-fields${sfx}`);

    if (sfFields) sfFields.style.display = role === "STUDENT" ? "block" : "none";
    if (tfFields) tfFields.style.display = role === "TEACHER" ? "block" : "none";

    // required attributes
    ["new-roll-no", "new-batch"].forEach(id => {
        const el = document.getElementById(id + sfx);
        if (el) el.required = role === "STUDENT";
    });
    const ec = document.getElementById(`new-employee-code${sfx}`);
    if (ec) ec.required = role === "TEACHER";
}


// ============================================================
// CREATE GROUP
// ============================================================

async function handleCreateGroup(event) {
    event.preventDefault();
    const academicPeriodId = document.getElementById("group-academic-period").value;
    const branchId = document.getElementById("group-branch").value;
    const semesterId = document.getElementById("group-semester").value;
    const name = document.getElementById("group-name").value.trim();
    try {
        const data = await apiRequest("POST", "/api/admin/groups", { name, academicPeriodId, branchId, semesterId });
        showAlert("group-create-alert", "success", data.message || "Group created.");
        document.getElementById("group-form").reset();
        await loadGroupsForDropdowns();
        loadGroups();
    } catch (e) {
        showAlert("group-create-alert", "error", e.message);
    }
}


// ============================================================
// BRANCHES + SEMESTERS
// ============================================================

async function loadBranches() {
    const tbody = document.getElementById("branches-table-body");
    const sel = document.getElementById("group-branch");
    try {
        const data = await apiRequest("GET", "/api/admin/branches");

        if (sel) {
            sel.innerHTML = `<option value="">-- Select Branch --</option>` +
                data.branches.map(b => `<option value="${b._id}">${esc(b.name)} (${esc(b.code)})</option>`).join("");
        }

        if (tbody) {
            tbody.innerHTML = data.branches.length
                ? data.branches.map(b => `
                    <tr>
                        <td class="font-medium">${esc(b.name)}</td>
                        <td><span class="badge badge-active">${esc(b.code)}</span></td>
                    </tr>`).join("")
                : `<tr><td colspan="2"><div class="empty-state"><p>No branches yet.</p></div></td></tr>`;
        }
    } catch (e) {
        console.error("Load branches:", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="2" class="text-muted text-sm" style="padding:16px;text-align:center;">Error: ${esc(e.message)}</td></tr>`;
    }
}

async function loadSemestersForGroup() {
    try {
        const data = await apiRequest("GET", "/api/academic/semesters");
        const sel = document.getElementById("group-semester");
        if (!sel) return;
        sel.innerHTML = `<option value="">-- Select Semester --</option>` +
            data.semesters.map(s => `<option value="${s._id}">${esc(s.name)}</option>`).join("");
    } catch (e) { console.error("Load semesters:", e); }
}

async function handleCreateBranch(event) {
    event.preventDefault();
    const name = document.getElementById("branch-name").value.trim();
    const code = document.getElementById("branch-code").value.trim();
    try {
        const data = await apiRequest("POST", "/api/admin/branches", { name, code });
        showAlert("branch-create-alert", "success", data.message || "Branch created.");
        document.getElementById("branch-form").reset();
        await loadBranches();
    } catch (e) {
        showAlert("branch-create-alert", "error", e.message);
    }
}


// ============================================================
// CREATE SUBJECT
// ============================================================

async function handleCreateSubject(event) {
    event.preventDefault();
    const name = document.getElementById("subject-name").value.trim();
    const code = document.getElementById("subject-code").value.trim();
    try {
        const data = await apiRequest("POST", "/api/admin/subjects", { name, code });
        showAlert("subject-create-alert", "success", data.message || "Subject created.");
        document.getElementById("subject-form").reset();
        await loadSubjectsForDropdowns();
        loadSubjects();
    } catch (e) {
        showAlert("subject-create-alert", "error", e.message);
    }
}


// ============================================================
// ASSIGN STUDENT TO GROUP
// ============================================================

async function assignStudentToGroup() {
    const groupId   = document.getElementById("assign-student-group").value;
    const studentId = document.getElementById("assign-student-student").value;

    if (!groupId || !studentId) {
        showAlert("assign-student-alert", "error", "Please select both a group and a student.");
        return;
    }

    try {
        const data = await apiRequest("POST", `/api/admin/groups/${groupId}/students`, { studentId });
        showAlert("assign-student-alert", "success", data.message || "Student assigned.");
        document.getElementById("assign-student-group").value = "";
        document.getElementById("assign-student-student").value = "";
    } catch (e) {
        showAlert("assign-student-alert", "error", e.message);
    }
}


// ============================================================
// ASSIGN SUBJECT TO GROUP
// ============================================================

async function handleAssignSubject(event) {
    event.preventDefault();
    const groupId   = document.getElementById("assign-subject-group").value;
    const subjectId = document.getElementById("assign-subject-subject").value;

    if (!groupId || !subjectId) {
        showAlert("assign-subject-alert", "error", "Please select both a group and a subject.");
        return;
    }

    try {
        const data = await apiRequest("POST", `/api/admin/groups/${groupId}/subjects`, { subjectId });
        showAlert("assign-subject-alert", "success", data.message || "Subject assigned.");
        document.getElementById("assign-subject-form").reset();
    } catch (e) {
        showAlert("assign-subject-alert", "error", e.message);
    }
}

// ============================================================
// BULK FACE PHOTOS
// ============================================================

const FACE_CHUNK_SIZE = 20;
const FACE_MAX_BYTES = 5 * 1024 * 1024;

async function uploadFaceChunk(files) {
    const form = new FormData();
    files.forEach(f => form.append("photos", f, f.name));

    const res = await fetch("/api/admin/students/face-photos", {
        method: "POST",
        headers: { "Authorization": `Bearer ${jwtToken}` },
        body: form
    });
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data;
}

async function handleFacePhotoUpload() {
    const btn = document.getElementById("face-upload-btn");
    const status = document.getElementById("face-upload-status");
    const all = [...document.getElementById("face-files").files].filter(f => f.type.startsWith("image/"));

    if (!all.length) {
        showAlert("face-upload-alert", "error", "Select a folder that contains images.");
        return;
    }

    const failed = [];
    const files = all.filter(f => {
        if (f.size > FACE_MAX_BYTES) {
            failed.push({ file: f.name, reason: "File larger than 5 MB" });
            return false;
        }
        return true;
    });

    let saved = 0;
    btn.disabled = true;

    for (let i = 0; i < files.length; i += FACE_CHUNK_SIZE) {
        const chunk = files.slice(i, i + FACE_CHUNK_SIZE);
        status.textContent = `Uploading ${Math.min(i + FACE_CHUNK_SIZE, files.length)} / ${files.length}...`;
        try {
            const data = await uploadFaceChunk(chunk);
            saved += data.saved;
            failed.push(...data.failed);
        } catch (e) {
            chunk.forEach(f => failed.push({ file: f.name, reason: e.message }));
            if (!jwtToken) break;
        }
    }

    btn.disabled = false;
    status.textContent = "";
    document.getElementById("face-files").value = "";

    document.getElementById("face-failed-body").innerHTML = failed.map(f => `
        <tr>
            <td>${esc(f.file)}</td>
            <td class="td-secondary">${esc(f.reason)}</td>
        </tr>`).join("");
    document.getElementById("face-failed-wrap").style.display = failed.length ? "block" : "none";

    showAlert(
        "face-upload-alert",
        failed.length ? "info" : "success",
        `${saved} saved, ${failed.length} failed.`
    );
}

// ============================================================
// UTILITIES
// ============================================================

function esc(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(dateStr) {
    if (!dateStr) return "â€”";
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    // --- Sidebar navigation ---
    document.querySelectorAll(".nav-item[data-page]").forEach(item => {
        item.addEventListener("click", () => navigateTo(item.dataset.page));
    });

    // --- Logout ---
    document.getElementById("logout-btn").addEventListener("click", logout);

    // --- Modal close buttons ---
    document.querySelectorAll("[data-close]").forEach(btn => {
        btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });

    // Close modal on overlay click
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", e => {
            if (e.target === overlay) overlay.classList.remove("open");
        });
    });

    // --- Confirm delete ---
    document.getElementById("confirm-delete-btn").addEventListener("click", () => {
        if (deleteCallback) deleteCallback();
        deleteCallback = null;
    });

    // --- Edit user save ---
    document.getElementById("save-edit-user-btn").addEventListener("click", saveEditUser);

    // --- Dashboard overview quick-create form ---
    document.getElementById("create-user-form").addEventListener("submit", e => {
        e.preventDefault();
        handleCreateUserForm("", "quick-create-alert");
    });
    document.getElementById("new-role").addEventListener("change", () => handleRoleChange(""));

    // --- Dashboard overview academic period form ---
    document.getElementById("academic-period-form").addEventListener("submit", e => {
        e.preventDefault();
        handleCreateAcademicPeriod("academic-period-form", "quick-period-alert", "academic-period-name", "academic-period-start", "academic-period-end");
    });

    // --- Users page: create form ---
    document.getElementById("create-user-form-2").addEventListener("submit", e => {
        e.preventDefault();
        handleCreateUserForm("2", "create-user-alert");
    });
    document.getElementById("new-role-2").addEventListener("change", () => handleRoleChange("-2"));

    // --- Users page: tab switching ---
    document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).style.display = "block";
        });
    });

    // --- Academic periods page form ---
    document.getElementById("academic-period-form-2").addEventListener("submit", e => {
        e.preventDefault();
        handleCreateAcademicPeriod("academic-period-form-2", "period-alert", "ap-name", "ap-start", "ap-end");
    });

    // --- Groups page ---
    document.getElementById("group-form").addEventListener("submit", handleCreateGroup);
    document.getElementById("branch-form").addEventListener("submit", handleCreateBranch);
    document.getElementById("assign-subject-form").addEventListener("submit", handleAssignSubject);
    document.getElementById("assign-student-btn").addEventListener("click", assignStudentToGroup);

    // --- Subjects page ---
    document.getElementById("face-upload-btn").addEventListener("click", handleFacePhotoUpload);
    document.getElementById("subject-form").addEventListener("submit", handleCreateSubject);


    // --- Refresh buttons ---
    document.getElementById("refresh-overview-btn")?.addEventListener("click", loadOverviewStats);
    document.getElementById("refresh-users-btn")?.addEventListener("click", loadStudents);
    document.getElementById("refresh-teachers-btn")?.addEventListener("click", loadTeachers);
    document.getElementById("refresh-periods-btn")?.addEventListener("click", loadAcademicPeriods);
    document.getElementById("refresh-groups-btn")?.addEventListener("click", loadGroups);
    document.getElementById("refresh-subjects-btn")?.addEventListener("click", loadSubjects);

}

