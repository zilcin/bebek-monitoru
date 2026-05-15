const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Baby Monitor Server Running");
});

const wss = new WebSocket.Server({ server });

console.log("Starting WebSocket server...");

const rooms = new Map();

wss.on('connection', (ws) => {

    console.log("NEW CONNECTION");

    ws.roomId = null;
    ws.deviceType = null;

    ws.on('message', (data, isBinary) => {

        try {

            // =========================
            // BINARY AUDIO
            // =========================
            if (isBinary) {

                console.log("BINARY AUDIO RECEIVED:", data.length);

                if (!ws.roomId) {
                    console.log("NO ROOM ID");
                    return;
                }

                const roomClients = rooms.get(ws.roomId);

                if (!roomClients) {
                    console.log("ROOM NOT FOUND");
                    return;
                }

                let forwarded = 0;

                roomClients.forEach(client => {

                    if (
                        client !== ws &&
                        client.readyState === WebSocket.OPEN
                    ) {

                        client.send(data, { binary: true });

                        forwarded++;
                    }
                });

                console.log("AUDIO FORWARDED TO:", forwarded);

                return;
            }

            // =========================
            // TEXT MESSAGE
            // =========================
            const text = data.toString();

            console.log("TEXT MESSAGE:", text);

            const json = JSON.parse(text);

            // =========================
            // REGISTER
            // =========================
            if (json.type === "register") {

                ws.roomId = json.roomId;
                ws.deviceType = json.deviceType;

                if (!rooms.has(ws.roomId)) {
                    rooms.set(ws.roomId, new Set());
                }

                const roomClients = rooms.get(ws.roomId);

                roomClients.add(ws);

                console.log(
                    "REGISTERED:",
                    ws.deviceType,
                    "ROOM:",
                    ws.roomId
                );

                console.log(
                    "ROOM CLIENT COUNT:",
                    roomClients.size
                );

                // =========================================
                // PARENT CONNECTED
                // =========================================
                if (ws.deviceType === "parent") {

                    console.log("PARENT CONNECTED");

                    roomClients.forEach(client => {

                        console.log(
                            "CHECK CLIENT:",
                            client.deviceType,
                            client.readyState
                        );

                        if (
                            client !== ws &&
                            client.deviceType === "baby" &&
                            client.readyState === WebSocket.OPEN
                        ) {

                            console.log(
                                "SENDING parent_connected TO BABY"
                            );

                            client.send(JSON.stringify({
                                type: "parent_connected",
                                count: getParentCount(roomClients)
                            }));

                            console.log(
                                "parent_connected SENT"
                            );
                        }
                    });
                }

                // =========================================
                // BABY CONNECTED
                // CHECK EXISTING PARENTS
                // =========================================
                else if (ws.deviceType === "baby") {

                    const parentCount =
                        getParentCount(roomClients);

                    console.log(
                        "EXISTING PARENTS:",
                        parentCount
                    );

                    if (parentCount > 0) {

                        console.log(
                            "SENDING EXISTING parent_connected TO BABY"
                        );

                        ws.send(JSON.stringify({
                            type: "parent_connected",
                            count: parentCount
                        }));

                        console.log(
                            "EXISTING parent_connected SENT"
                        );
                    }
                }

                // =========================================
                // REGISTER RESPONSE
                // =========================================
                ws.send(JSON.stringify({
                    type: "registered",
                    success: true
                }));
            }

        } catch (err) {

            console.error("MESSAGE ERROR:", err);
        }
    });

    // =========================================
    // CLOSE
    // =========================================
    ws.on('close', () => {

        console.log("CLIENT DISCONNECTED");

        if (ws.roomId && rooms.has(ws.roomId)) {

            const roomClients = rooms.get(ws.roomId);

            roomClients.delete(ws);

            console.log(
                "CLIENT REMOVED FROM ROOM:",
                ws.roomId
            );

            // =========================================
            // PARENT DISCONNECTED
            // =========================================
            if (ws.deviceType === "parent") {

                const parentCount =
                    getParentCount(roomClients);

                console.log(
                    "PARENT DISCONNECTED COUNT:",
                    parentCount
                );

                roomClients.forEach(client => {

                    if (
                        client.deviceType === "baby" &&
                        client.readyState === WebSocket.OPEN
                    ) {

                        console.log(
                            "SENDING parent_disconnected TO BABY"
                        );

                        client.send(JSON.stringify({
                            type: "parent_disconnected",
                            count: parentCount
                        }));

                        console.log(
                            "parent_disconnected SENT"
                        );
                    }
                });
            }

            // =========================================
            // DELETE EMPTY ROOM
            // =========================================
            if (roomClients.size === 0) {

                rooms.delete(ws.roomId);

                console.log("ROOM DELETED");
            }
        }
    });

    // =========================================
    // ERROR
    // =========================================
    ws.on('error', (err) => {

        console.error("WS ERROR:", err);
    });
});

// =========================================
// HELPERS
// =========================================
function getParentCount(roomClients) {

    let count = 0;

    roomClients.forEach(client => {

        if (client.deviceType === "parent") {
            count++;
        }
    });

    return count;
}

// =========================================
// START SERVER
// =========================================
server.listen(PORT, '0.0.0.0', () => {

    console.log("SERVER RUNNING ON PORT:", PORT);
});