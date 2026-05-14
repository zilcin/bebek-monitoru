const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Baby Monitor Server Running");
});

const wss = new WebSocket.Server({
    server
});

console.log("Starting WebSocket server...");

const rooms = new Map();

wss.on('connection', (ws, req) => {

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
            // TEXT JSON
            // =========================

            const text = data.toString();

            console.log("TEXT MESSAGE:", text);

            const json = JSON.parse(text);

            if (json.type === "register") {

                ws.roomId = json.roomId;
                ws.deviceType = json.deviceType;

                if (!rooms.has(ws.roomId)) {
                    rooms.set(ws.roomId, new Set());
                }

                rooms.get(ws.roomId).add(ws);

                console.log(
                    "REGISTERED:",
                    ws.deviceType,
                    "ROOM:",
                    ws.roomId
                );

                ws.send(JSON.stringify({
                    type: "registered",
                    success: true
                }));

                console.log(
                    "ROOM CLIENT COUNT:",
                    rooms.get(ws.roomId).size
                );
            }

        } catch (err) {

            console.error("MESSAGE ERROR:", err);

        }

    });

    ws.on('close', () => {

        console.log("CLIENT DISCONNECTED");

        if (ws.roomId && rooms.has(ws.roomId)) {

            rooms.get(ws.roomId).delete(ws);

            console.log(
                "CLIENT REMOVED FROM ROOM:",
                ws.roomId
            );

            if (rooms.get(ws.roomId).size === 0) {
                rooms.delete(ws.roomId);
                console.log("ROOM DELETED");
            }
        }
    });

    ws.on('error', (err) => {
        console.error("WS ERROR:", err);
    });

});

server.listen(PORT, '0.0.0.0', () => {
    console.log("SERVER RUNNING ON PORT:", PORT);
});