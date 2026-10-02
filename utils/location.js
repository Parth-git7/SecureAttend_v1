const { distanceMeters } = require("./geo");
const { LOCATION_RADIUS_M } = require("../config");

const LOCATION_ERRORS = ["DENIED", "UNAVAILABLE", "TIMEOUT"];

// Returns { result: "PASS" | "FAIL_FAR" | "NO_LOCATION", distance }
function checkLocation(teacherLocation, studentLocation) {
    if (
        !studentLocation ||
        !teacherLocation ||
        teacherLocation.latitude == null
    ) {
        return { result: "NO_LOCATION", distance: null };
    }

    const distance =
        Math.round(distanceMeters(teacherLocation, studentLocation) * 10) / 10;

    return {
        result: distance <= LOCATION_RADIUS_M ? "PASS" : "FAIL_FAR",
        distance
    };
}

module.exports = { checkLocation, LOCATION_ERRORS };