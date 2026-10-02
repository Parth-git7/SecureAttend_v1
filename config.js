// Tunable values. Override via .env, otherwise defaults apply.
module.exports = {
    LOCATION_RADIUS_M: Number(process.env.LOCATION_RADIUS_M) || 500,
    SESSION_DURATION_MIN: Number(process.env.SESSION_DURATION_MIN) || 5
};