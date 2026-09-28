/* public/js/admin.js */

// State Management
let jwtToken = localStorage.getItem('sa_admin_token');
let currentUser = JSON.parse(localStorage.getItem('sa_admin_user') || 'null');

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();
    setupEventListeners();
});

// --- AUTHENTICATION STATE ---

function checkAuthState() {
    if (jwtToken && currentUser && currentUser.role === 'ADMIN') {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    
    // Populate user info in header
    document.getElementById('current-admin-name').textContent = currentUser.name;
    document.getElementById('current-admin-email').textContent = currentUser.email;
    document.getElementById('current-admin-role').textContent = currentUser.role;
}

// --- GOOGLE OAUTH CALLBACK ---
// This is triggered automatically by the Google Identity script in admin.html
async function handleGoogleCredential(response) {
    try {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Authentication failed');
        }

        // Backend Authorization Check
        if (data.user.role !== 'ADMIN') {
            throw new Error('Access denied. Admin privileges required.');
        }

        // Store auth state
        jwtToken = data.token;
        currentUser = data.user;
        localStorage.setItem('sa_admin_token', jwtToken);
        localStorage.setItem('sa_admin_user', JSON.stringify(currentUser));

        checkAuthState();

    } catch (error) {
        showLoginError(error.message);
    }
}

function logout() {
    localStorage.removeItem('sa_admin_token');
    localStorage.removeItem('sa_admin_user');
    jwtToken = null;
    currentUser = null;
    checkAuthState();
}

// --- ADMIN API CALLS ---

async function handleCreateUser(event) {

    event.preventDefault();

    const name = document.getElementById('new-name').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const role = document.getElementById('new-role').value;

    const rollNo = document.getElementById('new-roll-no').value.trim();
    const batch = document.getElementById('new-batch').value.trim();
    const employeeCode = document.getElementById('new-employee-code').value.trim();

    const messageBox = document.getElementById('create-user-message');

    messageBox.className = 'message';


    const requestBody = {
        name,
        email,
        role
    };


    // Add student-specific fields

    if (role === 'STUDENT') {

        requestBody.rollNo = rollNo;
        requestBody.batch = batch;
    }


    // Add teacher-specific fields

    if (role === 'TEACHER') {

        requestBody.employeeCode = employeeCode;
    }


    try {

        const response = await fetch('/api/admin/users', {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },

            body: JSON.stringify(requestBody)

        });


        const data = await response.json();


        if (!response.ok) {

            if (response.status === 401 || response.status === 403) {

                logout();

                throw new Error(
                    "Your session has expired or access was denied. Please log in again."
                );
            }

            throw new Error(
                data.message || 'Failed to create user'
            );
        }


        messageBox.textContent =
            data.message;

        messageBox.classList.add('success');


        // Reset form

        document.getElementById('create-user-form').reset();

        handleRoleChange();


    } catch (error) {

        messageBox.textContent =
            error.message;

        messageBox.classList.add('error');
    }
}

// --- UTILITIES & LISTENERS ---

function setupEventListeners() {

    document.getElementById('logout-btn')
        .addEventListener('click', logout);

    document.getElementById('create-user-form')
        .addEventListener('submit', handleCreateUser);

    document.getElementById('new-role')
        .addEventListener('change', handleRoleChange);
}

function handleRoleChange() {

    const role = document.getElementById('new-role').value;

    const studentFields = document.getElementById('student-fields');
    const teacherFields = document.getElementById('teacher-fields');

    const rollNo = document.getElementById('new-roll-no');
    const batch = document.getElementById('new-batch');
    const employeeCode = document.getElementById('new-employee-code');


    // Hide everything first

    studentFields.style.display = 'none';
    teacherFields.style.display = 'none';

    rollNo.required = false;
    batch.required = false;
    employeeCode.required = false;


    // Student selected

    if (role === 'STUDENT') {

        studentFields.style.display = 'block';

        rollNo.required = true;
        batch.required = true;
    }


    // Teacher selected

    if (role === 'TEACHER') {

        teacherFields.style.display = 'block';

        employeeCode.required = true;
    }
}

function showLoginError(msg) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}