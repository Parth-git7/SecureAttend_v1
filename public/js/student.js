// ============================================================
// STATE
// ============================================================

let jwtToken =
    localStorage.getItem("sa_student_token");

let currentUser = JSON.parse(
    localStorage.getItem("sa_student_user") || "null"
);


let pollTimer = null;
let lastKey = null;

function startPolling() {
    stopPolling();
    loadActiveSession();
    pollTimer = setInterval(loadActiveSession, 3000);
}

function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    lastKey = null;
}


// ============================================================
// HELPERS
// ============================================================
function getStudentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(Object.assign(
                new Error("Geolocation is not supported by this browser."),
                { locationError: "UNAVAILABLE" }
            ));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            }),
            (error) => {
                const reasons = { 1: "DENIED", 2: "UNAVAILABLE", 3: "TIMEOUT" };
                reject(Object.assign(
                    new Error("Could not get location."),
                    { locationError: reasons[error.code] || "UNAVAILABLE" }
                ));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}


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


    startPolling();

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
    const key = session
        ? `${session.sessionId}:${session.myStatus}:${session.myLocationResult}`
        : "none";
    if (key === lastKey) return;
    lastKey = key;

    const container = document.getElementById("session-container");

    if (!session) {
        container.innerHTML = `
            <div class="no-session">
                <h4>No Active Attendance</h4>
                <p>There is currently no attendance session available for your group.</p>
            </div>`;
        return;
    }

    const failed = ["FAIL_FAR", "NO_LOCATION"].includes(session.myLocationResult);

    let action;
    if (session.myStatus === "PRESENT") {
        action = `<p><strong>You are marked PRESENT.</strong></p>`;
    } else if (session.myStatus === "REVIEW") {
        action = `<p><strong>Review requested. Waiting for your teacher's decision.</strong></p>`;
    } else if (session.myStatus === "ABSENT") {
        action = `<p><strong>You were marked ABSENT by the teacher.</strong></p>`;
    } else if (session.myStatus === "JOINED") {
        const failNote = failed
            ? `<div class="message error">${
                session.myLocationResult === "NO_LOCATION"
                    ? "Your location could not be accessed."
                    : "You seem too far from the classroom."
            } Retry, or request a review.</div>`
            : "";
        action = `
            ${failNote}
            <p>Enter the room code shown by your teacher:</p>
            <input id="room-code-input" type="text" maxlength="5" autocomplete="off">
            <button id="submit-code-btn">${failed ? "Retry" : "Submit Code"}</button>
            <button id="review-btn" class="btn-danger">Request Review</button>`;
    } else {
        action = `<button id="join-session-btn">Join Attendance</button>`;
    }

    container.innerHTML = `
        <div class="active-session">
            <div class="session-status">ACTIVE</div>
            <h3>${session.subject.name}</h3>
            <p><strong>Subject Code:</strong> ${session.subject.code}</p>
            <p><strong>Group:</strong> ${session.group.name}</p>
            <p><strong>Session expires:</strong> ${new Date(session.expiresAt).toLocaleString()}</p>
            ${action}
            <p id="session-message" class="coming-soon"></p>
        </div>`;

    document.getElementById("join-session-btn")
        ?.addEventListener("click", () => joinSession(session.sessionId));
    document.getElementById("submit-code-btn")
        ?.addEventListener("click", () => submitCode(session.sessionId));
    document.getElementById("review-btn")
        ?.addEventListener("click", () => requestReview(session.sessionId));
}

async function submitCode(sessionId) {
    const roomCode = document.getElementById("room-code-input").value.trim();
    if (!roomCode) return setSessionMessage("Enter the room code.");

    try {
        setSessionMessage("Getting your location...");

        const payload = { roomCode };
        try {
            payload.studentLocation = await getStudentLocation();
        } catch (err) {
            payload.locationError = err.locationError || "UNAVAILABLE";
        }

        await postAction(`/api/attendance-sessions/${sessionId}/verify`, payload);

        lastKey = null;
        await loadActiveSession();
    } catch (error) {
        setSessionMessage(error.message);
    }
}

async function requestReview(sessionId) {
    try {
        await postAction(`/api/attendance-sessions/${sessionId}/review-request`);
        lastKey = null;
        await loadActiveSession();
    } catch (error) {
        setSessionMessage(error.message);
    }
}

async function postAction(path, body) {
    const res = await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getToken()}`
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
}

function setSessionMessage(text) {
    const el = document.getElementById("session-message");
    if (el) el.textContent = text;
}

async function joinSession(sessionId) {
    try {
        await postAction(`/api/attendance-sessions/${sessionId}/join`);
        lastKey = null;
        await loadActiveSession();
    } catch (error) {
        setSessionMessage(error.message);
    }
}



// ============================================================
// DISPLAY ERROR
// ============================================================

function displaySessionError(message) {

    lastKey = null ;

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

    stopPolling() ;

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