const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const utility = require('./utility/code');
// Store rooms and connections
const rooms = {};  // { roomId: { host: ws, clients: Set<ws>, state: 'waiting' | 'playing' } }
const connections = new Map(); // Map each connection to a role { role: 'host' | 'client', roomId: string }

wss.on('connection', (ws) => {
    console.log('A new client connected');

    ws.on('message', (message) => {
        try {
            const { type, data } = JSON.parse(message);
            console.log("Type: " + type);

            switch (type) {
                case 'createRoom':
                    handleCreateRoom(ws);
                    break;

                case 'destroyRoom':
                    handleDestroyRoom(ws);
                    break;

                case 'joinRoom':
                    handleJoinRoom(ws, data);
                    break;

                case 'sendMessage':
                    handleSendMessage(ws, data);
                    break;

                case 'sendToHost':
                    handleSendToHost(ws, data);
                    break;

                case 'leaveRoom':
                    handleLeaveRoom(ws);
                    break;

                case 'startGame':
                    handleStartGame(ws);
                    break;

                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
            }
        } catch (err) {
            console.error(err);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });
});

function handleCreateRoom(ws) {
    const roomId = 'ASDF';

    rooms[roomId] = { host: ws, clients: new Set(), state: 'waiting' };
    connections.set(ws, { role: 'host', roomId });

    ws.send(JSON.stringify({ type: 'roomCreated', roomId }));
    console.log(`Room ${roomId} created by a host`);
}

function handleDestroyRoom(ws) {
    const connection = connections.get(ws);
    if (!connection || connection.role !== 'host') {
        ws.send(JSON.stringify({ type: 'error', message: 'Only hosts can destroy rooms' }));
        return;
    }

    const { roomId } = connection;
    if (rooms[roomId]) {
        rooms[roomId].clients.forEach(clientWs => {
            clientWs.send(JSON.stringify({ type: 'roomDestroyed' }));
            connections.delete(clientWs);
            clientWs.close();
        });
        delete rooms[roomId];
        connections.delete(ws);
        ws.send(JSON.stringify({ type: 'roomDestroyed' }));
        console.log(`Room ${roomId} destroyed by host`);
    }
}

function handleJoinRoom(ws, data) {
    const { roomId, name } = data;
    if (!rooms[roomId]) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
    }
    if (findConnection(name, roomId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Name already in use' }));
        return;
    }

    rooms[roomId].clients.add(ws);
    connections.set(ws, { role: 'client', roomId, name: name });

    // Notify the host of the new client
    rooms[roomId].host.send(JSON.stringify({ type: 'clientJoined', name: name }));

    // Notify the client that they joined the room
    ws.send(JSON.stringify({ type: 'joinedRoom', roomId, clients: Array.from(rooms[roomId].clients).length }));

    console.log(`A client joined room ${roomId} as ${name}`);
}

function handleLeaveRoom(ws) {
    const connection = connections.get(ws);
    if (!connection || connection.role !== 'client') {
        ws.send(JSON.stringify({ type: 'error', message: 'Only clients can leave rooms' }));
        return;
    }

    const { roomId } = connection;

    if (rooms[roomId]) {
        rooms[roomId].clients.delete(ws);
        p_name = connections.get(ws)['name'];
        connections.delete(ws);
        rooms[roomId].host.send(JSON.stringify({ type: 'clientLeft', data: { name: p_name } }));

        ws.send(JSON.stringify({ type: 'leftRoom', roomId }));

        console.log(`A client left room ${roomId}`);
    }
}
function findConnection(name, roomId) {
    room_clients = rooms[roomId].clients;
    for (const client of room_clients) {
        if (connections.get(client)['name'] === name) {
            return client;
        }
    }
    return null;

}

function handleSendMessage(ws, data) {
    message = data['message'];
    console.log(data);
    const connection = connections.get(ws);
    if (!connection) {
        ws.send(JSON.stringify({ type: 'error', message: 'Connection not found' }));
        return;
    }
    const { role, roomId } = connection;
    target = findConnection(data['client_name'], roomId);

    if (!target) {
        ws.send(JSON.stringify({ type: 'error', message: 'Target not found' }));
        return;
    }

    target.send(JSON.stringify(message));

}

function handleSendToHost(ws, data) {
    console.log(data);
    p_name = connections.get(ws)['name'];
    const connection = connections.get(ws);
    const { role, roomId } = connection;

    rooms[roomId].host.send(JSON.stringify({ type: 'clientMessage', data: { name: p_name, message: data['message'] } }));


}

function handleStartGame(ws) {
    const connection = connections.get(ws);
    if (!connection || connection.role !== 'host') {
        ws.send(JSON.stringify({ type: 'error', message: 'Only hosts can start the game' }));
        return;
    }

    const { roomId } = connection;
    if (rooms[roomId]) {
        rooms[roomId].state = 'playing';
        rooms[roomId].clients.forEach(clientWs => {
            clientWs.send(JSON.stringify({ type: 'gameStarted', roomId }));
        });

        ws.send(JSON.stringify({ type: 'gameStarted', roomId }));
        console.log(`Game started in room ${roomId}`);
    }
}

function handleDisconnect(ws) {
    const connection = connections.get(ws);
    if (!connection) return;

    const { role, roomId } = connection;

    if (role === 'host' && rooms[roomId]) {
        // If the host disconnects, destroy the room
        handleDestroyRoom(ws);
    } else if (role === 'client' && rooms[roomId]) {
        // If a client disconnects
        p_name = connections.get(ws)['name'];
        rooms[roomId].clients.delete(ws);
        rooms[roomId].host.send(JSON.stringify({ type: 'clientLeft', data: { name: p_name } }));
        connections.delete(ws);
        console.log(`A client disconnected from room ${roomId}`);
    }
}

console.log('WebSocket server is running on ws://localhost:8080');

