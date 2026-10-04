require("dotenv").config();   // must stay first : config.js reads process.env when it's required

const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Socket.IO will be attached to `server` here later

async function start() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");

        server.listen(PORT, "0.0.0.0", () => {
            console.log(`SecureAttend server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Startup failed:", error);
        process.exit(1);
    }
}

start();