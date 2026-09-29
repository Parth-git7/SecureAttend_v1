// ============================================================
// STATE
// ============================================================

let jwtToken =
    localStorage.getItem("sa_student_token");

let currentUser = JSON.parse(
    localStorage.getItem("sa_student_user") || "null"
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
        currentUser.role === "STUDENT"
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


    document.getElementById(
        "current-student-name"
    ).textContent =
        currentUser.name;


    document.getElementById(
        "current-student-email"
    ).textContent =
        currentUser.email;


    document.getElementById(
        "current-student-role"
    ).textContent =
        currentUser.role;


    loadActiveSession();

}


// ============================================================
// GOOGLE LOGIN
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


        // Student page only accepts STUDENT role

        if (data.user.role !== "STUDENT") {

            throw new Error(
                "Access denied. Student privileges required."
            );

        }


        jwtToken =
            data.token;

        currentUser =
            data.user;


        localStorage.setItem(
            "sa_student_token",
            jwtToken
        );


        localStorage.setItem(
            "sa_student_user",
            JSON.stringify(currentUser)
        );


        checkAuthState();


    } catch (error) {

        console.error(
            "Student login error:",
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
        "sa_student_token"
    );

}


// ============================================================
// LOAD ACTIVE SESSION
// ============================================================

async function loadActiveSession() {

    try {

        const token =
            getToken();


        const response =
            await fetch(
                "/api/attendance-sessions/active",
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
                "Failed to check attendance session"
            );

        }


        displayActiveSession(
            data.activeSession
        );


    } catch (error) {

        console.error(
            "Active session error:",
            error
        );


        displaySessionError(
            error.message
        );

    }

}


// ============================================================
// DISPLAY SESSION
// ============================================================

function displayActiveSession(session) {

    const container =
        document.getElementById(
            "session-container"
        );


    // No active session

    if (!session) {

        container.innerHTML = `

            <div class="no-session">

                <h4>No Active Attendance</h4>

                <p>
                    There is currently no attendance session
                    available for your group.
                </p>

            </div>

        `;

        return;

    }


    // Active session

    container.innerHTML = `

        <div class="active-session">

            <div class="session-status">
                ACTIVE
            </div>

            <h3>
                ${session.subject.name}
            </h3>

            <p>
                <strong>Subject Code:</strong>
                ${session.subject.code}
            </p>

            <p>
                <strong>Group:</strong>
                ${session.group.name}
            </p>

            <p>
                <strong>Session expires:</strong>
                ${new Date(
                    session.expiresAt
                ).toLocaleString()}
            </p>

            <button
                id="join-session-btn"
                disabled>
                Join Attendance
            </button>

            <p class="coming-soon">
                Joining will be enabled in the next step.
            </p>

        </div>

    `;

}


// ============================================================
// DISPLAY ERROR
// ============================================================

function displaySessionError(message) {

    const container =
        document.getElementById(
            "session-container"
        );


    container.innerHTML = `

        <div class="error-box">

            <p>
                ${message}
            </p>

        </div>

    `;

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
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    document
        .getElementById("logout-btn")
        .addEventListener(
            "click",
            logout
        );

}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    localStorage.removeItem(
        "sa_student_token"
    );


    localStorage.removeItem(
        "sa_student_user"
    );


    jwtToken = null;

    currentUser = null;


    showLogin();

}