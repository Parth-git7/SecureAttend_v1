// Tunable values. Override via .env, otherwise defaults apply.
module.exports = {
    LOCATION_RADIUS_M: Number(process.env.LOCATION_RADIUS_M) || 500,
    SESSION_DURATION_MIN: Number(process.env.SESSION_DURATION_MIN) || 5,
    FACE_THRESHOLD: Number(process.env.FACE_THRESHOLD) || 0.4,
    FACE_SERVICE_URL: process.env.FACE_SERVICE_URL || "http://127.0.0.1:8001"   
};