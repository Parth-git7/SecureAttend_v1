// ============================================================
// STATE
// ============================================================

let jwtToken = localStorage.getItem("sa_teacher_token");

let currentUser = JSON.parse(
    localStorage.getItem("sa_teacher_user") || "null"
);


// ============================================================
// PAGE LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();
    setupEventListeners();
});


// ============================================================
// AUTH STATE
// ============================================================

function checkAuthState() {
    if (jwtToken && currentUser && currentUser.role === "TEACHER") {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById("login-section").style.display = "flex";
    document.getElementById("dashboard-section").style.display = "none";
}

function showDashboard() {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("dashboard-section").style.display = "block";

    document.getElementById("current-teacher-name").textContent = currentUser.name;
    document.getElementById("current-teacher-email").textContent = currentUser.email;
    document.getElementById("current-teacher-role").textContent = currentUser.role;

    loadAcademicPeriods();
}


// ============================================================
// GOOGLE LOGIN CALLBACK
// ============================================================

async function handleGoogleCredential(response) {
    try {
        const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Authentication failed");
        }

        if (data.user.role !== "TEACHER") {
            throw new Error("Access denied. Teacher privileges required.");
        }

        jwtToken = data.token;
        currentUser = data.user;

        localStorage.setItem("sa_teacher_token", jwtToken);
        localStorage.setItem("sa_teacher_user", JSON.stringify(currentUser));

        checkAuthState();

    } catch (error) {
        console.error("Teacher login error:", error);
        showLoginError(error.message);
    }
}

function getToken() {
    return localStorage.getItem("sa_teacher_token");
}


// ============================================================
// HELPERS
// ============================================================

async function apiGet(path) {
    const response = await fetch(path, {
        method: "GET",
        headers: { "Authorization": `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            logout();
            throw new Error("Your session has expired. Please log in again.");
        }
        throw new Error(data.message || "Request failed");
    }

    return data;
}

async function apiPost(path, body) {
    const response = await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getToken()}`
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

async function apiPatch(path, body) {
    const response = await fetch(path, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getToken()}`
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function resetSelect(id, placeholder, disabled = true) {
    const select = document.getElementById(id);
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
    select.disabled = disabled;
    return select;
}

function addOption(select, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
}

function getTeacherLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                const messages = {
                    1: "Location permission denied. Allow location access to start attendance.",
                    2: "Location unavailable. Check GPS/network and try again.",
                    3: "Location request timed out. Try again."
                };
                reject(new Error(messages[error.code] || "Could not get location."));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}


// ============================================================
// 1. ACADEMIC PERIOD
// ============================================================

async function loadAcademicPeriods() {
    try {
        const data = await apiGet("/api/academic/academic-periods");

        const select = resetSelect("academic-period", "Select Academic Period", false);

        data.academicPeriods.forEach((period) => {
            addOption(select, period._id, period.name);
        });

        if (data.currentPeriodId) {
            select.value = data.currentPeriodId;
            await handleAcademicPeriodChange();
        }

    } catch (error) {
        console.error("Academic period loading error:", error);
        showMessage(error.message, "error");
    }
}

async function handleAcademicPeriodChange() {
    const periodId = document.getElementById("academic-period").value;

    resetSelect("branch-select", "Select Branch");
    resetSelect("semester-select", "Select Semester");
    resetSelect("group-select", "Select Group");
    resetSelect("subject-select", "Select Subject");

    if (!periodId) return;

    try {
        const data = await apiGet(
            `/api/academic/academic-periods/${periodId}/branches`
        );

        const select = resetSelect("branch-select", "Select Branch", false);

        data.branches.forEach((branch) => {
            addOption(select, branch._id, branch.name);
        });

        if (!data.branches.length) {
            showMessage("No groups exist for this academic period yet.", "info");
        }

    } catch (error) {
        console.error("Branch loading error:", error);
        showMessage(error.message, "error");
    }
}


// ============================================================
// 2. BRANCH
// ============================================================

async function handleBranchChange() {
    const periodId = document.getElementById("academic-period").value;
    const branchId = document.getElementById("branch-select").value;

    resetSelect("semester-select", "Select Semester");
    resetSelect("group-select", "Select Group");
    resetSelect("subject-select", "Select Subject");

    if (!periodId || !branchId) return;

    try {
        const data = await apiGet(
            `/api/academic/academic-periods/${periodId}/semesters?branchId=${branchId}`
        );

        const select = resetSelect("semester-select", "Select Semester", false);

        data.semesters.forEach((semester) => {
            addOption(select, semester._id, semester.name);
        });

    } catch (error) {
        console.error("Semester loading error:", error);
        showMessage(error.message, "error");
    }
}


// ============================================================
// 3. SEMESTER
// ============================================================

async function handleSemesterChange() {
    const periodId = document.getElementById("academic-period").value;
    const branchId = document.getElementById("branch-select").value;
    const semesterId = document.getElementById("semester-select").value;

    resetSelect("group-select", "Select Group");
    resetSelect("subject-select", "Select Subject");

    if (!periodId || !branchId || !semesterId) return;

    try {
        const data = await apiGet(
            `/api/academic/academic-periods/${periodId}/groups?branchId=${branchId}&semesterId=${semesterId}`
        );

        const select = resetSelect("group-select", "Select Group", false);

        data.groups.forEach((group) => {
            addOption(select, group._id, group.name);
        });

    } catch (error) {
        console.error("Group loading error:", error);
        showMessage(error.message, "error");
    }
}


// ============================================================
// 4. GROUP
// ============================================================

async function handleGroupChange() {
    const groupId = document.getElementById("group-select").value;

    resetSelect("subject-select", "Select Subject");

    if (!groupId) return;

    try {
        const data = await apiGet(`/api/academic/groups/${groupId}/subjects`);

        const select = resetSelect("subject-select", "Select Subject", false);

        data.subjects.forEach((subject) => {
            addOption(select, subject.subjectId, `${subject.name} (${subject.code})`);
        });

        if (!data.subjects.length) {
            showMessage("No subjects are assigned to this group.", "info");
        }

    } catch (error) {
        console.error("Subject loading error:", error);
        showMessage(error.message, "error");
    }
}


// ============================================================
// CREATE SESSION  (was "Start Attendance")
// ============================================================

async function handleStartAttendance(event) {
    event.preventDefault();

    const groupId   = document.getElementById("group-select").value;
    const subjectId = document.getElementById("subject-select").value;

    if (!groupId || !subjectId) {
        showMessage("Please select a group and subject.", "error");
        return;
    }

    const btn = document.getElementById("create-session-btn");
    btn.disabled = true;
    btn.textContent = "Creating…";

    try {
        showMessage("Getting your location…", "info");
        const teacherLocation = await getTeacherLocation();

        showMessage("Creating attendance session…", "info");

        const data = await apiPost("/api/attendance-sessions", {
            groupId,
            subjectId,
            teacherLocation
        });

        showMessage("Session created! Students can now join the lobby.", "success");

        displayActiveSession(data.session);
        startRosterPolling(data.session._id);

    } catch (error) {
        console.error("Create session error:", error);
        showMessage(error.message, "error");
        btn.disabled = false;
        btn.textContent = "🚀 Create Session";
    }
}


// ============================================================
// PHASE TRANSITIONS
// ============================================================

async function handleStartAttendancePhase(sessionId) {
    const btn = document.getElementById("start-attendance-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Starting…"; }

    try {
        const data = await apiPost(`/api/attendance-sessions/${sessionId}/start-attendance`);
        showMessage("Attendance is now OPEN — students can submit their code.", "success");
        displayActiveSession(data.session);
    } catch (error) {
        showMessage(error.message, "error");
        if (btn) { btn.disabled = false; btn.textContent = "▶ Start Attendance"; }
    }
}

async function handleStopAttendancePhase(sessionId) {
    const btn = document.getElementById("stop-attendance-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Stopping…"; }

    try {
        const data = await apiPost(`/api/attendance-sessions/${sessionId}/stop-attendance`);
        showMessage("Attendance is now CLOSED — no more submissions accepted.", "info");
        displayActiveSession(data.session);
    } catch (error) {
        showMessage(error.message, "error");
        if (btn) { btn.disabled = false; btn.textContent = "⏹ Stop Attendance"; }
    }
}

async function handleEndSession(sessionId) {
    stopRosterPolling();
    const btn = document.getElementById("end-session-btn");
    if (btn) btn.disabled = true;

    try {
        await apiPatch(`/api/attendance-sessions/${sessionId}/end`);

        showMessage("Attendance session ended and records finalised.", "success");

        document.querySelectorAll("#group-students button").forEach((b) => (b.disabled = true));

        const container = getOrCreateModule("active-session");
        container.innerHTML = `
            <h3>📋 Attendance Session</h3>
            <p style="color: var(--text-secondary);">Session has ended. Records have been saved.</p>
        `;

    } catch (error) {
        console.error("End session error:", error);
        if (btn) btn.disabled = false;
        showMessage(error.message, "error");
    }
}


// ============================================================
// DISPLAY ACTIVE SESSION
// ============================================================

function getOrCreateModule(id) {
    let container = document.getElementById(id);

    if (!container) {
        container = document.createElement("div");
        container.id = id;
        container.className = "dashboard-module";
        document.getElementById("dashboard-section").appendChild(container);
    }

    return container;
}

function phaseBadgeHtml(phase) {
    const map = {
        LOBBY:              { cls: "lobby",  label: "Lobby — Waiting" },
        ATTENDANCE_OPEN:    { cls: "open",   label: "Attendance Open" },
        ATTENDANCE_CLOSED:  { cls: "closed", label: "Attendance Closed" },
        ENDED:              { cls: "ended",  label: "Ended" }
    };
    const info = map[phase] || { cls: "ended", label: phase };
    return `<span class="phase-badge ${info.cls}">${info.label}</span>`;
}

function sessionControlsHtml(sessionId, phase) {
    if (phase === "LOBBY") {
        return `
            <div class="session-controls">
                <button id="start-attendance-btn" class="btn-success">▶ Start Attendance</button>
                <button id="end-session-btn" class="btn-danger">✕ End Session</button>
            </div>
            <p style="margin-top:10px; font-size:0.82rem; color:var(--text-muted);">
                💡 Students can join the lobby but cannot submit their code until you start attendance.
            </p>`;
    }

    if (phase === "ATTENDANCE_OPEN") {
        return `
            <div class="session-controls">
                <button id="stop-attendance-btn" class="btn-warn">⏹ Stop Attendance</button>
                <button id="end-session-btn" class="btn-danger">✕ End Session</button>
            </div>
            <p style="margin-top:10px; font-size:0.82rem; color:var(--text-muted);">
                ✅ Attendance is open — students can now submit their room code and face scan.
            </p>`;
    }

    if (phase === "ATTENDANCE_CLOSED") {
        return `
            <div class="session-controls">
                <button id="end-session-btn" class="btn-danger">✕ End &amp; Finalise Session</button>
            </div>
            <p style="margin-top:10px; font-size:0.82rem; color:var(--text-muted);">
                🔒 Attendance collection stopped. Review the roster and end when ready.
            </p>`;
    }

    return "";
}

function displayActiveSession(session) {
    const container = getOrCreateModule("active-session");

    const expiresLabel = new Date(session.expiresAt).toLocaleString();

    container.innerHTML = `
        <h3>🎯 Active Session ${phaseBadgeHtml(session.phase)}</h3>

        <div class="session-info-grid">
            <div class="session-info-item">
                <div class="label">Room Code</div>
                <div class="value room-code-display">${escapeHtml(session.roomCode)}</div>
            </div>
            <div class="session-info-item">
                <div class="label">Phase</div>
                <div class="value">${phaseBadgeHtml(session.phase)}</div>
            </div>
            <div class="session-info-item">
                <div class="label">Expires At</div>
                <div class="value">${expiresLabel}</div>
            </div>
        </div>

        ${sessionControlsHtml(session._id, session.phase)}
    `;

    // Bind phase transition buttons
    document.getElementById("start-attendance-btn")
        ?.addEventListener("click", () => handleStartAttendancePhase(session._id));

    document.getElementById("stop-attendance-btn")
        ?.addEventListener("click", () => handleStopAttendancePhase(session._id));

    document.getElementById("end-session-btn")
        ?.addEventListener("click", () => handleEndSession(session._id));
}


// ============================================================
// ROSTER POLLING
// ============================================================

let rosterTimer     = null;
let rosterSessionId = null;

function startRosterPolling(sessionId) {
    stopRosterPolling();
    rosterSessionId = sessionId;

    const tick = async () => {
        try {
            const data = await apiGet(`/api/attendance-sessions/${sessionId}/roster`);
            displayRoster(data.students, data.session.phase);

            const expired = new Date(data.session.expiresAt) <= new Date();
            if (data.session.phase === "ENDED" || expired) stopRosterPolling();
        } catch (error) {
            console.error("Roster polling error:", error);
            stopRosterPolling();
        }
    };

    tick();
    rosterTimer = setInterval(tick, 3000);
}

function stopRosterPolling() {
    if (rosterTimer) clearInterval(rosterTimer);
    rosterTimer = null;
}


// ============================================================
// DISPLAY ROSTER
// ============================================================

function displayRoster(students, phase) {
    const container = getOrCreateModule("group-students");

    const isActive = ["LOBBY", "ATTENDANCE_OPEN", "ATTENDANCE_CLOSED"].includes(phase);

    if (!container.dataset.bound) {
        container.dataset.bound = "1";
        container.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-status]");
            if (btn) markStudent(btn.dataset.student, btn.dataset.status);
        });
    }

    if (!students.length) {
        container.innerHTML = `<h3>👥 Group Students</h3><p style="color:var(--text-secondary);">No students found in this group.</p>`;
        return;
    }

    const present = students.filter((s) => s.status === "PRESENT").length;
    const joined  = students.filter((s) => s.status === "JOINED").length;
    const review  = students.filter((s) => s.status === "REVIEW").length;
    const absent  = students.filter((s) => s.status === "ABSENT").length;

    const phaseNote = phase === "LOBBY"
        ? `<p style="font-size:0.82rem; color:var(--warn); margin-bottom:14px;">⚠️ Attendance not started yet — students in lobby, but cannot submit code.</p>`
        : "";

    const rows = students.map((s, i) => {
        const rowCls =
            s.status === "REVIEW"   ? "row-review"  :
            s.status === "PRESENT"  ? "row-present"  :
            s.status === "ABSENT"   ? "row-absent"   : "";

        const statusCls = s.status.toLowerCase();
        const pillLabel =
            s.status === "JOINED"  ? "Joined"   :
            s.status === "PRESENT" ? "Present"  :
            s.status === "ABSENT"  ? "Absent"   :
            s.status === "REVIEW"  ? "Review"   : s.status;

        const canApprove = isActive && s.status !== "PRESENT";
        const canReject  = isActive && s.status !== "ABSENT";

        return `
            <tr class="${rowCls}">
                <td>${i + 1}</td>
                <td>${escapeHtml(s.rollNo)}</td>
                <td>${escapeHtml(s.name)}</td>
                <td><span class="status-pill ${statusCls}">${pillLabel}</span></td>
                <td>
                    <div class="action-btns">
                        <button data-student="${s.studentId}" data-status="PRESENT"
                            class="btn-success"
                            ${!canApprove ? "disabled" : ""}>✓ Approve</button>
                        <button data-student="${s.studentId}" data-status="ABSENT"
                            class="btn-danger"
                            ${!canReject ? "disabled" : ""}>✕ Reject</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    container.innerHTML = `
        <h3>👥 Group Students</h3>
        ${phaseNote}
        <div class="stats-bar">
            <div class="stat-chip"><span class="num">${present}</span> Present</div>
            <div class="stat-chip"><span class="num">${joined}</span> Joined</div>
            <div class="stat-chip"><span class="num">${review}</span> Review</div>
            <div class="stat-chip"><span class="num">${absent}</span> Absent</div>
            <div class="stat-chip"><span class="num">${students.length}</span> Total</div>
        </div>
        <div class="roster-table-wrap">
            <table class="roster-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Roll No.</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

async function markStudent(studentId, status) {
    try {
        await fetch(
            `/api/attendance-sessions/${rosterSessionId}/students/${studentId}/attendance`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                },
                body: JSON.stringify({ status })
            }
        ).then(async (res) => {
            const d = await res.json();
            if (!res.ok) throw new Error(d.message || "Failed to update attendance");
        });

        const roster = await apiGet(`/api/attendance-sessions/${rosterSessionId}/roster`);
        displayRoster(roster.students, roster.session.phase);

    } catch (error) {
        showMessage(error.message, "error");
    }
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("academic-period").addEventListener("change", handleAcademicPeriodChange);
    document.getElementById("branch-select").addEventListener("change", handleBranchChange);
    document.getElementById("semester-select").addEventListener("change", handleSemesterChange);
    document.getElementById("group-select").addEventListener("change", handleGroupChange);
    document.getElementById("start-attendance-form").addEventListener("submit", handleStartAttendance);
}


// ============================================================
// MESSAGES
// ============================================================

function showMessage(message, type) {
    const messageBox = document.getElementById("attendance-message");
    messageBox.textContent = message;
    messageBox.className = `message ${type}`;
}

function showLoginError(message) {
    const errorDiv = document.getElementById("login-error");
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {
    stopRosterPolling();
    localStorage.removeItem("sa_teacher_token");
    localStorage.removeItem("sa_teacher_user");

    jwtToken = null;
    currentUser = null;

    showLogin();
}