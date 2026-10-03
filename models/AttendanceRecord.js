const mongoose = require("mongoose") ;

const attendanceRecordSchema = new mongoose.Schema(
    {
        sessionId : {
            type : mongoose.Schema.Types.ObjectId, 
            ref : "AttendanceSession",
            required : true
        }, 
        studentId : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Student", 
            required : true 
        },
        studentLocation: {
            latitude: {
                type: Number,
                min: -90,
                max: 90
            },
            longitude: {
                type: Number,
                min: -180,
                max: 180
            },
            accuracy: {
                type: Number,
                min: 0
            }
        },
        locationCheck: {
            result: {
                type: String,
                enum: ["PASS", "FAIL_FAR", "NO_LOCATION"]
            },
            distanceMeters: {
                type: Number,
                min: 0
            }
        },
        faceCheck: {
            result: {
                type: String,
                enum: ["PASS", "FAIL_MISMATCH", "NO_FACE", "NO_TEMPLATE", "ERROR"]
            },
            score: { type: Number },
            framesUsed: { type: Number, min: 0 }
        },

        status : {
            type : String,
            enum : ["JOINED", "PRESENT", "REVIEW", "ABSENT"],
            default : "JOINED"
        },

        reviewRequestedAt: {
            type: Date
        },

        decision: {
            by: {
                type: String,
                enum: ["SYSTEM", "TEACHER"]
            },
            at: {
                type: Date
            }
        },
        joinedAt : {
            type : Date,
            default : Date.now
        },
        markedAt : {
            type : Date
        }
    },
    { timestamps : true } 

) ;

attendanceRecordSchema.index(
    {
        sessionId : 1,
        studentId : 1
    },
    {unique : true}
) ;

module.exports = mongoose.model("AttendanceRecord", attendanceRecordSchema) ;