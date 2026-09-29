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
// AUTHENTICATION STATE
// ============================================================

function checkAuthState() {

    if (
        jwtToken &&
        currentUser &&
        currentUser.role === "TEACHER"
    ) {
        showDashboard();
    } else {
        showLogin();
    }

}


// ============================================================
// SHOW LOGIN
// ============================================================

function showLogin() {

    document.getElementById("login-section").style.display = "block";

    document.getElementById("dashboard-section").style.display = "none";

}


// ============================================================
// SHOW DASHBOARD
// ============================================================

function showDashboard() {

    document.getElementById("login-section").style.display = "none";

    document.getElementById("dashboard-section").style.display = "block";

    document.getElementById("current-teacher-name").textContent =
        currentUser.name;

    document.getElementById("current-teacher-email").textContent =
        currentUser.email;

    document.getElementById("current-teacher-role").textContent =
        currentUser.role;

    loadAcademicPeriods();

}


// ============================================================
// GOOGLE LOGIN CALLBACK
// ============================================================

async function handleGoogleCredential(response) {

    try {

        const res = await fetch("/api/auth/google", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                credential: response.credential
            })

        });


        const data = await res.json();


        if (!res.ok) {

            throw new Error(
                data.message || "Authentication failed"
            );

        }


        if (data.user.role !== "TEACHER") {

            throw new Error(
                "Access denied. Teacher privileges required."
            );

        }


        jwtToken = data.token;

        currentUser = data.user;


        localStorage.setItem(
            "sa_teacher_token",
            jwtToken
        );

        localStorage.setItem(
            "sa_teacher_user",
            JSON.stringify(currentUser)
        );


        checkAuthState();


    } catch (error) {

        console.error("Teacher login error:", error);

        showLoginError(error.message);

    }

}


// ============================================================
// GET TOKEN
// ============================================================

function getToken() {

    return localStorage.getItem(
        "sa_teacher_token"
    );

}


// ============================================================
// LOAD ACADEMIC PERIODS
// ============================================================

async function loadAcademicPeriods() {

    try {

        const token = getToken();

        const response = await fetch(
            "/api/academic/academic-periods",
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data = await response.json();


        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                logout();

                throw new Error(
                    "Your session has expired. Please log in again."
                );

            }

            throw new Error(
                data.message ||
                "Failed to load academic periods"
            );

        }


        const academicPeriodSelect =
            document.getElementById("academic-period");


        academicPeriodSelect.innerHTML =
            `<option value="">
                Select Academic Period
            </option>`;


        data.academicPeriods.forEach((period) => {

            const option =
                document.createElement("option");

            option.value = period._id;

            option.textContent = period.name;

            academicPeriodSelect.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Academic period loading error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

    }

}


// ============================================================
// ACADEMIC PERIOD CHANGED
// ============================================================

async function handleAcademicPeriodChange(event) {

    const academicPeriodId =
        event.target.value;


    const groupSelect =
        document.getElementById("group-select");

    const subjectSelect =
        document.getElementById("subject-select");


    groupSelect.innerHTML =
        `<option value="">
            Select Group
        </option>`;


    subjectSelect.innerHTML =
        `<option value="">
            Select Subject
        </option>`;


    subjectSelect.disabled = true;


    if (!academicPeriodId) {

        groupSelect.disabled = true;

        return;

    }


    try {

        const token = getToken();


        const response = await fetch(
            `/api/academic/academic-periods/${academicPeriodId}/groups`,
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to load groups"
            );

        }


        data.groups.forEach((group) => {

            const option =
                document.createElement("option");

            option.value = group._id;

            option.textContent = group.name;

            groupSelect.appendChild(option);

        });


        groupSelect.disabled = false;


    } catch (error) {

        console.error(
            "Group loading error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

    }

}


// ============================================================
// GROUP CHANGED
// ============================================================

async function handleGroupChange(event) {

    const groupId =
        event.target.value;


    const subjectSelect =
        document.getElementById("subject-select");


    subjectSelect.innerHTML =
        `<option value="">
            Select Subject
        </option>`;


    subjectSelect.disabled = true;


    if (!groupId) {

        return;

    }


    try {

        const token = getToken();


        const response = await fetch(
            `/api/academic/groups/${groupId}/subjects`,
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to load subjects"
            );

        }


        data.subjects.forEach((subject) => {

            const option =
                document.createElement("option");

            option.value =
                subject.subjectId;

            option.textContent =
                `${subject.name} (${subject.code})`;

            subjectSelect.appendChild(option);

        });


        subjectSelect.disabled = false;


    } catch (error) {

        console.error(
            "Subject loading error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

    }

}


// ============================================================
// START ATTENDANCE
// ============================================================

async function handleStartAttendance(event) {

    event.preventDefault();


    const groupId =
        document.getElementById("group-select").value;

    const subjectId =
        document.getElementById("subject-select").value;


    if (!groupId || !subjectId) {

        showMessage(
            "Please select a group and subject.",
            "error"
        );

        return;

    }


    try {

        showMessage(
            "Starting attendance session...",
            "info"
        );


        const token = getToken();


        const response = await fetch(
            "/api/attendance-sessions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    groupId,
                    subjectId
                })

            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to start attendance session"
            );

        }


        const session =
            data.session;


        showMessage(
            "Attendance session started successfully.",
            "success"
        );


        displayActiveSession(
            session
        );


        await loadGroupStudents(groupId);


    } catch (error) {

        console.error(
            "Start attendance error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

    }

}


// ============================================================
// LOAD GROUP STUDENTS
// ============================================================

async function loadGroupStudents(groupId) {

    try {

        const token = getToken();


        const response = await fetch(
            `/api/academic/groups/${groupId}/students`,
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to load students"
            );

        }


        displayStudents(
            data.students
        );


    } catch (error) {

        console.error(
            "Student loading error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

    }

}


// ============================================================
// DISPLAY ACTIVE SESSION
// ============================================================

function displayActiveSession(session) {

    let container =
        document.getElementById("active-session");


    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "active-session";

        container.className =
            "dashboard-module";

        document
            .getElementById("dashboard-section")
            .appendChild(container);

    }


    container.innerHTML = `

        <h3>Active Attendance Session</h3>

        <p>
            <strong>Status:</strong>
            ${session.status}
        </p>

        <p>
            <strong>Room Code:</strong>
            <span style="font-size: 24px; font-weight: bold;">
                ${session.roomCode}
            </span>
        </p>

        <p>
            <strong>Expires At:</strong>
            ${new Date(session.expiresAt).toLocaleString()}
        </p>

    `;

}


// ============================================================
// DISPLAY STUDENTS
// ============================================================

function displayStudents(students) {

    let container =
        document.getElementById("group-students");


    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "group-students";

        container.className =
            "dashboard-module";

        document
            .getElementById("dashboard-section")
            .appendChild(container);

    }


    if (!students.length) {

        container.innerHTML = `
            <h3>Group Students</h3>
            <p>No students found in this group.</p>
        `;

        return;

    }


    let rows = students.map((student, index) => {

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${student.rollNo}</td>
                <td>${student.name}</td>
                <td>ABSENT</td>
            </tr>
        `;

    }).join("");


    container.innerHTML = `

        <h3>Group Students</h3>

        <table style="width: 100%; border-collapse: collapse;">

            <thead>
                <tr>
                    <th style="text-align:left; padding:8px;">#</th>
                    <th style="text-align:left; padding:8px;">
                        Roll No.
                    </th>
                    <th style="text-align:left; padding:8px;">
                        Name
                    </th>
                    <th style="text-align:left; padding:8px;">
                        Status
                    </th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>

        </table>

    `;

}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    document
        .getElementById("logout-btn")
        .addEventListener(
            "click",
            logout
        );


    document
        .getElementById("academic-period")
        .addEventListener(
            "change",
            handleAcademicPeriodChange
        );


    document
        .getElementById("group-select")
        .addEventListener(
            "change",
            handleGroupChange
        );


    document
        .getElementById("start-attendance-form")
        .addEventListener(
            "submit",
            handleStartAttendance
        );

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(message, type) {

    const messageBox =
        document.getElementById(
            "attendance-message"
        );


    messageBox.textContent =
        message;


    messageBox.className =
        `message ${type}`;

}


// ============================================================
// LOGIN ERROR
// ============================================================

function showLoginError(message) {

    const errorDiv =
        document.getElementById(
            "login-error"
        );


    errorDiv.textContent =
        message;


    errorDiv.style.display =
        "block";

}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    localStorage.removeItem(
        "sa_teacher_token"
    );

    localStorage.removeItem(
        "sa_teacher_user"
    );


    jwtToken = null;

    currentUser = null;


    showLogin();

}