// ============================================================
// STATE
// ============================================================

let jwtToken = localStorage.getItem("sa_admin_token");

let currentUser = JSON.parse(
    localStorage.getItem("sa_admin_user") || "null"
);


// ============================================================
// INITIALIZATION
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
        currentUser.role === "ADMIN"
    ) {

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


    document.getElementById("current-admin-name").textContent =
        currentUser.name;

    document.getElementById("current-admin-email").textContent =
        currentUser.email;

    document.getElementById("current-admin-role").textContent =
        currentUser.role;


    // Load academic periods for Group creation

    loadAcademicPeriodsForGroup();

}


// ============================================================
// GOOGLE LOGIN
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


        // Backend role check

        if (data.user.role !== "ADMIN") {

            throw new Error(
                "Access denied. Admin privileges required."
            );

        }


        jwtToken = data.token;

        currentUser = data.user;


        localStorage.setItem(
            "sa_admin_token",
            jwtToken
        );

        localStorage.setItem(
            "sa_admin_user",
            JSON.stringify(currentUser)
        );


        checkAuthState();


    } catch (error) {

        showLoginError(error.message);

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
// CREATE USER
// ============================================================

async function handleCreateUser(event) {

    event.preventDefault();


    const name =
        document.getElementById("new-name").value.trim();

    const email =
        document.getElementById("new-email").value.trim();

    const role =
        document.getElementById("new-role").value;

    const rollNo =
        document.getElementById("new-roll-no").value.trim();

    const batch =
        document.getElementById("new-batch").value.trim();

    const employeeCode =
        document.getElementById("new-employee-code").value.trim();


    const messageBox =
        document.getElementById("create-user-message");


    messageBox.className = "message";


    const requestBody = {

        name,

        email,

        role

    };


    if (role === "STUDENT") {

        requestBody.rollNo = rollNo;

        requestBody.batch = batch;

    }


    if (role === "TEACHER") {

        requestBody.employeeCode = employeeCode;

    }


    try {

        const response = await fetch(
            "/api/admin/users",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`

                },

                body:
                    JSON.stringify(requestBody)

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
                    "Your session has expired or access was denied. Please log in again."
                );

            }


            throw new Error(
                data.message ||
                "Failed to create user"
            );

        }


        messageBox.textContent =
            data.message || "Account created successfully.";

        messageBox.classList.add("success");


        document
            .getElementById("create-user-form")
            .reset();


        handleRoleChange();


    } catch (error) {

        messageBox.textContent =
            error.message;

        messageBox.classList.add("error");

    }

}


// ============================================================
// ACADEMIC PERIOD
// ============================================================

async function handleCreateAcademicPeriod(event) {

    event.preventDefault();


    const name =
        document
            .getElementById("academic-period-name")
            .value
            .trim();

    const startDate =
        document
            .getElementById("academic-period-start")
            .value;

    const endDate =
        document
            .getElementById("academic-period-end")
            .value;


    const messageBox =
        document.getElementById(
            "academic-period-message"
        );


    messageBox.className = "message";


    try {

        const response = await fetch(
            "/api/admin/academic-periods",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`

                },

                body: JSON.stringify({

                    name,

                    startDate,

                    endDate

                })

            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to create academic period"
            );

        }


        messageBox.textContent =
            data.message ||
            "Academic period created successfully.";

        messageBox.classList.add("success");


        document
            .getElementById("academic-period-form")
            .reset();


        // Refresh period dropdown

        loadAcademicPeriodsForGroup();


    } catch (error) {

        messageBox.textContent =
            error.message;

        messageBox.classList.add("error");

    }

}


// ============================================================
// LOAD ACADEMIC PERIODS
// ============================================================

async function loadAcademicPeriodsForGroup() {

    const select =
        document.getElementById(
            "group-academic-period"
        );


    if (!select) return;


    try {

        const response = await fetch(
            "/api/academic/academic-periods",
            {

                method: "GET",

                headers: {

                    "Authorization":
                        `Bearer ${jwtToken}`

                }

            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to load academic periods"
            );

        }


        select.innerHTML =
            `<option value="">
                Select Academic Period
            </option>`;


        data.academicPeriods.forEach(
            (period) => {

                const option =
                    document.createElement("option");

                option.value =
                    period._id;

                option.textContent =
                    period.name;

                select.appendChild(option);

            }
        );


    } catch (error) {

        console.error(
            "Academic period loading error:",
            error
        );

    }

}


// ============================================================
// CREATE GROUP
// ============================================================

async function handleCreateGroup(event) {

    event.preventDefault();


    const academicPeriodId =
        document
            .getElementById("group-academic-period")
            .value;

    const name =
        document
            .getElementById("group-name")
            .value
            .trim();


    const messageBox =
        document.getElementById(
            "group-message"
        );


    messageBox.className = "message";


    try {

        const response = await fetch(
            "/api/admin/groups",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`

                },

                body: JSON.stringify({

                    name,

                    academicPeriodId

                })

            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to create group"
            );

        }


        messageBox.textContent =
            data.message ||
            "Group created successfully.";

        messageBox.classList.add("success");


        document
            .getElementById("group-form")
            .reset();


    } catch (error) {

        messageBox.textContent =
            error.message;

        messageBox.classList.add("error");

    }

}


// ============================================================
// CREATE SUBJECT
// ============================================================

async function handleCreateSubject(event) {

    event.preventDefault();


    const name =
        document
            .getElementById("subject-name")
            .value
            .trim();

    const code =
        document
            .getElementById("subject-code")
            .value
            .trim();


    const messageBox =
        document.getElementById(
            "subject-message"
        );


    messageBox.className = "message";


    try {

        const response = await fetch(
            "/api/admin/subjects",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`

                },

                body: JSON.stringify({

                    name,

                    code

                })

            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to create subject"
            );

        }


        messageBox.textContent =
            data.message ||
            "Subject created successfully.";

        messageBox.classList.add("success");


        document
            .getElementById("subject-form")
            .reset();


    } catch (error) {

        messageBox.textContent =
            error.message;

        messageBox.classList.add("error");

    }

}


// ============================================================
// ROLE CHANGE
// ============================================================

function handleRoleChange() {

    const role =
        document
            .getElementById("new-role")
            .value;


    const studentFields =
        document.getElementById(
            "student-fields"
        );

    const teacherFields =
        document.getElementById(
            "teacher-fields"
        );


    const rollNo =
        document.getElementById(
            "new-roll-no"
        );

    const batch =
        document.getElementById(
            "new-batch"
        );

    const employeeCode =
        document.getElementById(
            "new-employee-code"
        );


    studentFields.style.display = "none";

    teacherFields.style.display = "none";


    rollNo.required = false;

    batch.required = false;

    employeeCode.required = false;


    if (role === "STUDENT") {

        studentFields.style.display = "block";

        rollNo.required = true;

        batch.required = true;

    }


    if (role === "TEACHER") {

        teacherFields.style.display = "block";

        employeeCode.required = true;

    }

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
        .getElementById("create-user-form")
        .addEventListener(
            "submit",
            handleCreateUser
        );


    document
        .getElementById("new-role")
        .addEventListener(
            "change",
            handleRoleChange
        );


    document
        .getElementById("academic-period-form")
        .addEventListener(
            "submit",
            handleCreateAcademicPeriod
        );


    document
        .getElementById("group-form")
        .addEventListener(
            "submit",
            handleCreateGroup
        );


    document
        .getElementById("subject-form")
        .addEventListener(
            "submit",
            handleCreateSubject
        );

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