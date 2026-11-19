# SecureAttend
 
Multi-factor classroom attendance system. A student is marked present only after passing three checks: a room code, a GPS proximity check, and face verification.
 
## How it works
 
1. Teacher selects period, branch, semester, group and subject, then creates a session. Their location is captured. Phase: `LOBBY`.
2. Students in the group join the lobby.
3. Teacher starts attendance. Phase: `ATTENDANCE_OPEN`. A 5-character room code is shown.
4. Each student submits:
   - the room code
   - their GPS location (must be within `LOCATION_RADIUS_M` of the teacher)
   - a face frame (matched against the admin-enrolled photo, cosine similarity >= `FACE_THRESHOLD`)
5. All checks pass: `PRESENT`. Otherwise the student can retry or request a review (`REVIEW`).
6. Teacher can approve or reject any student until the session ends.
7. Teacher stops attendance (`ATTENDANCE_CLOSED`) and ends the session (`ENDED`). Everyone without a verified record is finalised as `ABSENT`.
Session and roster updates are pushed over Socket.IO, with polling as a fallback.
 
## Stack
 
| Layer | Tech |
|---|---|
| Backend | Node.js, Express 5, Mongoose (MongoDB), Socket.IO |
| Auth | Google Sign-In (ID token verification), JWT; email + password for admin |
| Face service | Python, FastAPI, InsightFace (`buffalo_l`), ONNX Runtime (CPU) |
| Frontend | React 19, Vite, React Router, `@react-oauth/google` |
 
## Roles
 
- **Admin**: manages students, teachers, academic periods, branches, groups, subjects, group membership, and uploads face photos (single or bulk by roll number).
- **Teacher**: creates and controls attendance sessions, reviews the live roster.
- **Student**: joins the active session for their group and submits attendance.
Accounts are pre-created by an admin. Google login only works for emails that already exist.
 
## Project structure
 
```
app.js / server.js / realtime.js   Express app, bootstrap, Socket.IO
config.js                          Tunable thresholds
models/                            Mongoose schemas
routes/
  auth.js                          /api/auth
  admin.js                         /api/admin
  academic.js                      /api/academic
  attendanceSessions.js            /api/attendance-sessions
middleware/                        JWT auth, role guard
utils/                             geo, location check, face compare/enroll
scripts/                           seedSemesters.js, testFace.js, testflow.js
face-service/                      FastAPI embedding service
public/                            Legacy vanilla-JS pages (admin/teacher/student)
src/                               React frontend (Vite)
```
 
## Setup
 
### Prerequisites
 
- Node.js 22+
- MongoDB instance
- Python 3.10+
- A Google OAuth Web client ID
### 1. Backend
 
```bash
npm install
```
 
Create `.env`:
 
```env
MONGO_URI=mongodb://localhost:27017/secureattend
JWT_SECRET=change-me
GOOGLE_CLIENT_ID=<your-client-id>
PORT=3000
CORS_ORIGINS=http://localhost:5173
 
# optional overrides
LOCATION_RADIUS_M=500
SESSION_DURATION_MIN=2
FACE_THRESHOLD=0.4
FACE_SERVICE_URL=http://127.0.0.1:8001
FACE_SERVICE_SECRET=
```
 
Seed semesters 1-10, then start:
 
```bash
node scripts/seedSemesters.js
npm run dev
```
 
### 2. Face service
 
```bash
cd face-service
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
FACE_SERVICE_SECRET=<same-as-backend> uvicorn app:app --port 8001
```
 
The model loads and warms up on startup, so the first launch is slow.
 
### 3. Frontend
 
Create `.env` in the frontend root:
 
```env
VITE_GOOGLE_CLIENT_ID=<your-client-id>
```
 
```bash
npm install
npm run dev
```
 
Vite proxies `/api` and `/socket.io` to `http://127.0.0.1:3000`.
 
### 4. First admin
 
There is no signup route. Insert one admin user directly in MongoDB with a bcrypt `passwordHash` and `role: "ADMIN"`. Admin signs in with email and password. Create teachers and students from the admin panel afterwards.
 
Google OAuth: add your frontend origin to **Authorized JavaScript origins** in the Google Cloud console.
 
## Admin workflow
 
1. Create academic period, branches, subjects.
2. Create groups (period + branch + semester + name).
3. Create students and teachers.
4. Assign students and subjects to groups.
5. Upload face photos. Name each file with the student's roll number, e.g. `2410992624.jpg`. Photos must contain exactly one clear, front-facing face.
## API overview
 
| Route | Description |
|---|---|
| `POST /api/auth/login` | Email + password login |
| `POST /api/auth/google` | Google ID token login |
| `/api/admin/*` | Users, periods, branches, groups, subjects, memberships, face photos (ADMIN) |
| `GET /api/academic/*` | Periods, branches, semesters, groups, subjects for dropdowns (ADMIN, TEACHER) |
| `POST /api/attendance-sessions` | Create session (TEACHER) |
| `POST /api/attendance-sessions/:id/start-attendance` | LOBBY to ATTENDANCE_OPEN |
| `POST /api/attendance-sessions/:id/stop-attendance` | ATTENDANCE_OPEN to ATTENDANCE_CLOSED |
| `PATCH /api/attendance-sessions/:id/end` | Finalise session |
| `GET /api/attendance-sessions/:id/roster` | Live roster (TEACHER) |
| `PATCH /api/attendance-sessions/:id/students/:studentId/attendance` | Approve or reject a student |
| `GET /api/attendance-sessions/active` | Active session for the student |
| `POST /api/attendance-sessions/:id/join` | Join lobby (STUDENT) |
| `POST /api/attendance-sessions/:id/verify` | Submit code, location, face (STUDENT) |
| `POST /api/attendance-sessions/:id/review-request` | Ask teacher to review (STUDENT) |
 
## Testing
 
With the backend running and at least one teacher plus a group that has a subject and a student:
 
```bash
node scripts/testflow.js                 # session lifecycle and phase guards
node scripts/testFace.js ref.jpg a.jpg   # similarity scores against a reference photo
```
 
## Notes
 
- Browser geolocation and camera require HTTPS (or `localhost`). For phone testing, use a tunnel such as Cloudflare Tunnel; `vite.config.js` already allows `.trycloudflare.com`.
- Face embeddings are stored per student with the model name; changing the model requires re-enrolling photos.
- Sessions have a hard expiry (`SESSION_DURATION_MIN`) regardless of phase.
## License
 
ISC
 
