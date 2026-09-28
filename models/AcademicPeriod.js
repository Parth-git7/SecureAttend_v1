const mongoose = require("mongoose") ;

const academicPeriodSchema = new mongoose.Schema(
    {
        name : {
            type : String,
            required : true,
            trim : true
        }, 
        startDate : {
            type : Date,
            required : true
        },
        endDate : {
            type : Date,
            required : true
        },
        status : {
            type : String,
            enum : ["ACTIVE", "UPCOMING", "COMPLETED"],
            default : "UPCOMING"
        }
    },

    {timestamps : true} 
);

const AcademicPeriod = mongoose.model(
    "AcademicPeriod" ,
    academicPeriodSchema
);

module.exports = AcademicPeriod ;