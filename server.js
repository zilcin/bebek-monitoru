// server.js - Bulutta çalışacak WebSocket sunucusu
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

// Odalar: { 'odaId123': { baby: ws, parent: ws } }
const rooms = new Map();

server.on('connection', (ws, req) => {
    let roomId = null;
    let deviceType = null; // 'baby' veya 'parent'
    
    ws.on('message', (data) => {
        try {
            // İlk mesajı JSON olarak al (oda ID ve tip bilgisi)
            if (typeof data === 'string' && data.startsWith('{')) {
                const msg = JSON.parse(data);
                
                if (msg.type === 'register') {
                    roomId = msg.roomId;
                    deviceType = msg.deviceType;
                    
                    if (!rooms.has(roomId)) {
                        rooms.set(roomId, { baby: null, parent: null });
                    }
                    
                    const room = rooms.get(roomId);
                    
                    if (deviceType === 'baby') {
                        room.baby = ws;
                        console.log(`👶 Bebek odası bağlandı: ${roomId}`);
                    } else if (deviceType === 'parent') {
                        room.parent = ws;
                        console.log(`👨‍👩‍👧 Ebeveyn bağlandı: ${roomId}`);
                        
                        // Ebeveyn bağlandığında ona mevcut durumu gönder
                        if (room.baby && room.baby.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'status', value: 'connected' }));
                        }
                    }
                    
                    ws.send(JSON.stringify({ type: 'registered', status: 'ok' }));
                    return;
                }
            }
            
            // Ses verisi (binary) - ilgili tarafa yönlendir
            if (roomId && rooms.has(roomId)) {
                const room = rooms.get(roomId);
                
                if (deviceType === 'baby' && room.parent && room.parent.readyState === WebSocket.OPEN) {
                    // Bebekten gelen ses → Ebeveyne git
                    room.parent.send(data);
                } 
                else if (deviceType === 'parent' && room.baby && room.baby.readyState === WebSocket.OPEN) {
                    // Ebeveynden gelen ses → Bebeğe git (çift yönlü)
                    room.baby.send(data);
                }
            }
        } catch (err) {
            console.log('Mesaj hatası:', err);
        }
    });
    
    ws.on('close', () => {
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            
            if (deviceType === 'baby') {
                room.baby = null;
                console.log(`👶 Bebek odası ayrıldı: ${roomId}`);
            } else if (deviceType === 'parent') {
                room.parent = null;
                console.log(`👨‍👩‍👧 Ebeveyn ayrıldı: ${roomId}`);
            }
            
            // Eğer iki taraf da yoksa odayı temizle
            if (!room.baby && !room.parent) {
                rooms.delete(roomId);
            }
        }
    });
});

console.log('🚀 WebSocket sunucusu çalışıyor...');