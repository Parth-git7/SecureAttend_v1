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

        status : {
            type : String,
            enum : ["JOINED", "PRESENT"],
            default : "JOINED"
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