const net = require('net');
const crypto = require('crypto');

// Configuración para cifrado y HMAC
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 bytes
const IV = Buffer.from('1234567890123456'); // 16 bytes
const HMAC_SECRET = 'erika_jorge';

// Persistencia de clientes y colas
const clients = new Map(); // Almacena información del cliente por ID único
const messageQueues = new Map(); // Colas de mensajes pendientes

// Función para descifrar mensajes
function decryptMessage(encryptedMessage) {
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Función para verificar HMAC
function verifyHMAC(message, hmac) {
    const calculatedHMAC = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
    return hmac === calculatedHMAC;
}

// Servidor TCP
const server = net.createServer((socket) => {
    let clientId = null; // ID único del cliente

    console.log(`Cliente conectado: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
        try {
            const [encryptedMessage] = data.toString().split('|');
            const decryptedData = decryptMessage(encryptedMessage).split('|');
            const [message, hmac] = decryptedData;

            // Verificar HMAC
            if (!verifyHMAC(message, hmac)) {
                console.log('Error: Integridad del mensaje comprometida.');
                return;
            }

            // Si el cliente aún no está identificado, el primer mensaje será su ID único
            if (!clientId) {
                clientId = message; // Usamos el primer mensaje como identificador único
                if (!clients.has(clientId)) {
                    // Nuevo cliente
                    clients.set(clientId, { socket, name: clientId, connected: true });
                    messageQueues.set(clientId, []); // Crear cola de mensajes pendientes
                    console.log(`Nuevo cliente registrado: ${clientId}`);

                    // Notificar a los demás clientes que un nuevo usuario se ha conectado
                    clients.forEach((client, id) => {
                        if (id !== clientId) {
                            client.socket.write(`Usuario conectado: ${clientId}\n`);
                        }
                    });
                } else {
                    // Cliente reconectado
                    const client = clients.get(clientId);
                    client.socket = socket; // Actualizamos el socket
                    client.connected = true;
                    console.log(`Cliente reconectado: ${clientId}`);

                    // Enviar mensajes pendientes
                    const pendingMessages = messageQueues.get(clientId);
                    console.log(`Enviando ${pendingMessages.length} mensajes pendientes a ${clientId}`);
                    while (pendingMessages.length > 0) {
                        const { from, text } = pendingMessages.shift();
                        socket.write(`${from}: ${text}\n`);
                    }
                }
                return; // No procesar el mensaje inicial como texto normal
            }

            // Difundir mensaje a otros clientes
            clients.forEach((client, id) => {
                if (id !== clientId) {
                    if (client.connected) {
                        // Cliente conectado, enviar mensaje directamente
                        client.socket.write(`${clientId}: ${message}\n`);
                    } else {
                        // Cliente desconectado, almacenar mensaje en la cola
                        const queue = messageQueues.get(id);
                        queue.push({ from: clientId, text: message });
                        console.log(`Mensaje almacenado en la cola para ${id}`);
                    }
                }
            });
        } catch (err) {
            console.error('Error al procesar el mensaje:', err.message);
        }
    });

    socket.on('close', () => {
        // Cuando un cliente se desconecta, marcarlo como desconectado
        if (clientId && clients.has(clientId)) {
            const client = clients.get(clientId);
            client.connected = false; // Marcar como desconectado
            console.log(`Cliente desconectado: ${clientId}`);

            // Notificar a los demás clientes
            clients.forEach((client, id) => {
                if (id !== clientId) {
                    client.socket.write(`Usuario desconectado: ${clientId}\n`);
                }
            });
        }
    });

    socket.on('error', (err) => {
        console.error('Error en el cliente:', err.message);
    });
});

server.listen(3000, () => {
    console.log('Servidor TCP escuchando en el puerto 3000');
});
