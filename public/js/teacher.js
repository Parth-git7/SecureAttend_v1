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
    document.getElementById("login-section").style.display = "block";
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

// GET helper: adds token, handles expired session, throws on error
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

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Empty a dropdown back to its placeholder
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
// 1. ACADEMIC PERIOD (auto-selects the current one)
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
// START ATTENDANCE (unchanged behaviour)
// ============================================================

async function handleStartAttendance(event) {
    event.preventDefault();

    const groupId = document.getElementById("group-select").value;
    const subjectId = document.getElementById("subject-select").value;

    if (!groupId || !subjectId) {
        showMessage("Please select a group and subject.", "error");
        return;
    }

    try {
        showMessage("Getting your location...", "info");
        const teacherLocation = await getTeacherLocation();

        showMessage("Starting attendance session...", "info");

        const response = await fetch("/api/attendance-sessions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify({ groupId, subjectId, teacherLocation })
        });


        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to start attendance session");
        }

        showMessage("Attendance session started successfully.", "success");

        displayActiveSession(data.session);

        startRosterPolling(data.session._id);

    } catch (error) {
        console.error("Start attendance error:", error);
        showMessage(error.message, "error");
    }
}

async function loadGroupStudents(groupId) {
    try {
        const data = await apiGet(`/api/academic/groups/${groupId}/students`);
        displayStudents(data.students);
    } catch (error) {
        console.error("Student loading error:", error);
        showMessage(error.message, "error");
    }
}


// ============================================================
// DISPLAY
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

function displayActiveSession(session) {
    const container = getOrCreateModule("active-session");

    container.innerHTML = `
        <h3>Active Attendance Session</h3>
        <p><strong>Status:</strong> ${escapeHtml(session.status)}</p>
        <p>
            <strong>Room Code:</strong>
            <span style="font-size: 24px; font-weight: bold;">
                ${escapeHtml(session.roomCode)}
            </span>
        </p>
        <p><strong>Expires At:</strong> ${new Date(session.expiresAt).toLocaleString()}</p>
        <button id="end-session-btn" class="btn-danger">End Session</button>
    `;

    document
        .getElementById("end-session-btn")
        .addEventListener("click", () => handleEndSession(session._id));
}

async function handleEndSession(sessionId) {
    stopRosterPolling();
    const btn = document.getElementById("end-session-btn");
    btn.disabled = true;

    try {
        const response = await fetch(`/api/attendance-sessions/${sessionId}/end`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${getToken()}` }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to end session");
        }

        showMessage("Attendance session ended.", "success");
        document.querySelectorAll("#group-students button").forEach((b) => (b.disabled = true));
        
        getOrCreateModule("active-session").innerHTML = `
            <h3>Attendance Session</h3>
            <p>Session ended.</p>
        `;

    } catch (error) {
        console.error("End session error:", error);
        btn.disabled = false;
        showMessage(error.message, "error");
    }
}


// =============================================================================================

let rosterTimer = null;
let rosterSessionId = null;

function startRosterPolling(sessionId) {
    stopRosterPolling();
    rosterSessionId = sessionId;

    const tick = async () => {
        try {
            const data = await apiGet(`/api/attendance-sessions/${sessionId}/roster`);
            displayRoster(data.students, data.session.status === "ACTIVE");

            const expired = new Date(data.session.expiresAt) <= new Date();
            if (data.session.status !== "ACTIVE" || expired) stopRosterPolling();
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

function displayRoster(students, active = true) {
    const container = getOrCreateModule("group-students");

    if (!container.dataset.bound) {
        container.dataset.bound = "1";
        container.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-status]");
            if (btn) markStudent(btn.dataset.student, btn.dataset.status);
        });
    }

    if (!students.length) {
        container.innerHTML = `<h3>Group Students</h3><p>No students found in this group.</p>`;
        return;
    }

    const present = students.filter((s) => s.status === "PRESENT").length;

    const rows = students.map((s, i) => `
        <tr class="${s.status === "REVIEW" ? "review-row" : ""}">
            <td style="padding:8px;">${i + 1}</td>
            <td style="padding:8px;">${escapeHtml(s.rollNo)}</td>
            <td style="padding:8px;">${escapeHtml(s.name)}</td>
            <td style="padding:8px;">${escapeHtml(s.status)}</td>
            <td style="padding:8px;">
                <button data-student="${s.studentId}" data-status="PRESENT"
                    ${!active || s.status === "PRESENT" ? "disabled" : ""}>Approve</button>
                <button class="btn-danger" data-student="${s.studentId}" data-status="ABSENT"
                    ${!active || s.status === "ABSENT" ? "disabled" : ""}>Reject</button>
            </td>
        </tr>
    `).join("");

    container.innerHTML = `
        <h3>Group Students (${present}/${students.length} present)</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="text-align:left; padding:8px;">#</th>
                    <th style="text-align:left; padding:8px;">Roll No.</th>
                    <th style="text-align:left; padding:8px;">Name</th>
                    <th style="text-align:left; padding:8px;">Status</th>
                    <th style="text-align:left; padding:8px;">Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

async function markStudent(studentId, status) {
    try {
        const response = await fetch(
            `/api/attendance-sessions/${rosterSessionId}/students/${studentId}/attendance`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getToken()}`
                },
                body: JSON.stringify({ status })
            }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to update attendance");

        const roster = await apiGet(`/api/attendance-sessions/${rosterSessionId}/roster`);
        displayRoster(roster.students, roster.session.status === "ACTIVE");
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