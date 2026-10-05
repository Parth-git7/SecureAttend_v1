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

async function captureFrames(count = 3, gapMs = 400) {
    const overlay = document.getElementById("camera-overlay");
    const video   = document.getElementById("camera-preview");

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 } },
        audio: false
    });

    try {
        video.srcObject = stream;
        // Show centred overlay
        if (overlay) overlay.classList.add("visible");
        await video.play();
        await new Promise((r) => setTimeout(r, 800)); // camera warm-up

        const scale = Math.min(1, 640 / video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d");

        const frames = [];
        for (let i = 0; i < count; i++) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.85));
            await new Promise((r) => setTimeout(r, gapMs));
        }
        return frames;
    } finally {
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
        if (overlay) overlay.classList.remove("visible");
    }
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
        ? `${session.sessionId}:${session.phase}:${session.myStatus}:${session.myLocationResult}:${session.myFaceResult}`
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

    const LOC_MSG = {
        NO_LOCATION: "Your location could not be accessed.",
        FAIL_FAR: "You seem too far from the classroom."
    };
    const FACE_MSG = {
        NO_FACE: "We couldn't see your face clearly.",
        FAIL_MISMATCH: "Your face did not match.",
        NO_TEMPLATE: "No face photo is on file for you.",
        ERROR: "Face check is unavailable right now."
    };

    const reasons = [
        LOC_MSG[session.myLocationResult],
        FACE_MSG[session.myFaceResult]
    ].filter(Boolean);
    const failed = reasons.length > 0;

    // Determine action area
    let action;

    if (session.myStatus === "PRESENT") {
        action = `<p class="status-badge present">✅ You are marked PRESENT.</p>`;

    } else if (session.myStatus === "REVIEW") {
        action = `<p class="status-badge review">🕐 Review requested — waiting for teacher's decision.</p>`;

    } else if (session.myStatus === "ABSENT") {
        action = `<p class="status-badge absent">❌ You were marked ABSENT by the teacher.</p>`;

    } else if (session.phase === "LOBBY") {
        // Session exists but attendance not open yet
        const joinedNote = session.myStatus === "JOINED"
            ? `<p class="status-badge joined">✔ You have joined the lobby. Please wait.</p>`
            : `<button id="join-session-btn">Join Lobby</button>`;
        action = `
            <div class="lobby-waiting">
                <div class="lobby-spinner"></div>
                <p>Attendance has not started yet. Your teacher will open it shortly.</p>
                ${joinedNote}
            </div>`;

    } else if (session.phase === "ATTENDANCE_OPEN" && session.myStatus === "JOINED") {
        const failNote = failed
            ? `<div class="message error">${reasons.join(" ")} Retry, or request a review.</div>`
            : "";
        action = `
            ${failNote}
            <p>Enter the room code shown by your teacher:</p>
            <input id="room-code-input" type="text" maxlength="5" autocomplete="off"
                   placeholder="e.g. AB3XY" style="text-transform:uppercase;">
            <button id="submit-code-btn">${failed ? "🔄 Retry" : "Submit Code"}</button>
            <button id="review-btn" class="btn-danger">Request Review</button>`;

    } else if (session.phase === "ATTENDANCE_CLOSED") {
        action = `<p class="status-badge closed">🔒 Attendance period is closed. No further submissions accepted.</p>`;

    } else {
        // Not yet joined, attendance open
        action = `<button id="join-session-btn">Join Attendance</button>`;
    }

    const phaseLabelMap = {
        LOBBY:             "Lobby",
        ATTENDANCE_OPEN:   "Attendance Open",
        ATTENDANCE_CLOSED: "Attendance Closed"
    };
    const phaseLabel = phaseLabelMap[session.phase] || session.phase;
    const phaseClass = (session.phase || "").toLowerCase().replace("_", "-");

    container.innerHTML = `
        <div class="active-session">
            <div class="session-phase-row">
                <span class="session-status">ACTIVE</span>
                <span class="phase-badge ${phaseClass}">${phaseLabel}</span>
            </div>
            <h3>${session.subject.name}</h3>
            <p><strong>Subject Code:</strong> ${session.subject.code}</p>
            <p><strong>Group:</strong> ${session.group.name}</p>
            <p><strong>Session expires:</strong> ${new Date(session.expiresAt).toLocaleString()}</p>
            ${action}
            <p id="session-message" class="session-msg"></p>
        </div>

        <!-- Centred camera overlay -->
        <div id="camera-overlay" class="camera-overlay">
            <div class="camera-modal">
                <p class="camera-label">📸 Look at the camera…</p>
                <video id="camera-preview" playsinline muted autoplay></video>
            </div>
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

        setSessionMessage("Look at the camera...");
        try {
            payload.frames = await captureFrames();
        } catch (err) {
            console.error("Camera error:", err);
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