require("dotenv").config(); // Must stay first

const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const { initRealtime } = require("./realtime");

const PORT = process.env.PORT || 3000;

// 1. Create the HTTP server
const server = http.createServer(app);

// 2. Attach Socket.IO to the HTTP server
initRealtime(server);

// 3. Connect to MongoDB and start the server
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