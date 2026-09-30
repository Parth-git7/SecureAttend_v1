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