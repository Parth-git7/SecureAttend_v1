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

    document.getElementById(
        "login-section"
    ).style.display = "block";

    document.getElementById(
        "dashboard-section"
    ).style.display = "none";

}


// ============================================================
// SHOW DASHBOARD
// ============================================================

function showDashboard() {

    document.getElementById(
        "login-section"
    ).style.display = "none";

    document.getElementById(
        "dashboard-section"
    ).style.display = "block";


    // Populate teacher information

    document.getElementById(
        "current-teacher-name"
    ).textContent = currentUser.name;


    document.getElementById(
        "current-teacher-email"
    ).textContent = currentUser.email;


    document.getElementById(
        "current-teacher-role"
    ).textContent = currentUser.role;


    // Now that we have a valid JWT,
    // load academic data.

    loadAcademicPeriods();

}


// ============================================================
// GOOGLE LOGIN CALLBACK
// ============================================================

async function handleGoogleCredential(response) {

    try {

        const res = await fetch(
            "/api/auth/google",
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    credential: response.credential
                })

            }
        );


        const data = await res.json();


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Authentication failed"
            );

        }


        // ----------------------------------------
        // IMPORTANT:
        // Teacher page only accepts TEACHER role
        // ----------------------------------------

        if (data.user.role !== "TEACHER") {

            throw new Error(
                "Access denied. Teacher privileges required."
            );

        }


        // ----------------------------------------
        // STORE AUTH STATE
        // ----------------------------------------

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


        // Show dashboard

        checkAuthState();


    } catch (error) {

        console.error(
            "Teacher login error:",
            error
        );

        showLoginError(
            error.message
        );

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

                    "Authorization":
                        `Bearer ${token}`

                }

            }
        );


        const data =
            await response.json();


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
            document.getElementById(
                "academic-period"
            );


        academicPeriodSelect.innerHTML =
            `<option value="">
                Select Academic Period
            </option>`;


        data.academicPeriods.forEach(
            (period) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    period._id;

                option.textContent =
                    period.name;

                academicPeriodSelect
                    .appendChild(option);

            }
        );


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
        document.getElementById(
            "group-select"
        );


    const subjectSelect =
        document.getElementById(
            "subject-select"
        );


    // Reset groups

    groupSelect.innerHTML =
        `<option value="">
            Select Group
        </option>`;


    // Reset subjects

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

                    "Authorization":
                        `Bearer ${token}`

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


        data.groups.forEach(
            (group) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    group._id;

                option.textContent =
                    group.name;

                groupSelect
                    .appendChild(option);

            }
        );


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
        document.getElementById(
            "subject-select"
        );


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

                    "Authorization":
                        `Bearer ${token}`

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


        data.subjects.forEach(
            (subject) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    subject.subjectId;

                option.textContent =
                    `${subject.name} (${subject.code})`;

                subjectSelect
                    .appendChild(option);

            }
        );


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

function handleStartAttendance(event) {

    event.preventDefault();


    const academicPeriodId =
        document.getElementById(
            "academic-period"
        ).value;


    const groupId =
        document.getElementById(
            "group-select"
        ).value;


    const subjectId =
        document.getElementById(
            "subject-select"
        ).value;


    console.log({

        academicPeriodId,

        groupId,

        subjectId

    });


    showMessage(
        "Attendance session setup will be connected soon.",
        "info"
    );

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