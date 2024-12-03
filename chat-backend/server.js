const net = require('net');
const crypto = require('crypto');

// Configuración para cifrado y HMAC
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 bytes
const IV = Buffer.from('1234567890123456'); // 16 bytes
const HMAC_SECRET = 'erika_jorge';

// Persistencia de clientes
const clients = new Map(); // Almacena clientes por ID único

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

// Manejo de conexiones de clientes
const server = net.createServer((socket) => {
    let clientId = null;  // ID único del cliente
    let clientName = null; // Nombre del cliente

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

            // Asignar ID único a un nuevo cliente
            if (!clientId) {
                clientId = `${socket.remoteAddress}:${socket.remotePort}`;
            }

            // Registrar o actualizar cliente
            if (!clients.has(clientId)) {
                // El primer mensaje recibido es el nombre de usuario, lo usamos para registrar al cliente
                clientName = message;
                clients.set(clientId, { socket, name: clientName });
                console.log(`Nuevo cliente registrado: ${clientName} (ID: ${clientId})`);
                
                // Notificar a los demás clientes que un nuevo usuario se ha conectado
                clients.forEach((client, id) => {
                    if (id !== clientId) {
                        client.socket.write(`Usuario conectado: ${clientName}\n`);
                    }
                });

            } else {
                // Si el cliente ya está registrado, actualizar su socket
                clients.get(clientId).socket = socket;
                console.log(`Cliente reconectado: ${clients.get(clientId).name}`);
            }

            // Si el mensaje es "name", lo ignoramos (esto es el nombre registrado)
            if (message === clientName) return;

            // Difundir mensaje a otros clientes
            clients.forEach((client, id) => {
                if (id !== clientId) {
                    client.socket.write(`${clientName}: ${message}\n`);
                }
            });
        } catch (err) {
            console.error('Error al procesar el mensaje:', err.message);
        }
    });

    socket.on('close', () => {
        // Cuando un cliente se desconecta, enviar un mensaje de desconexión a los demás clientes
        if (clientId && clients.has(clientId)) {
            console.log(`Cliente desconectado: ${clientId}`);
            clients.delete(clientId);
            // Enviar el mensaje a los demás clientes de que este usuario se desconectó
            clients.forEach((client, id) => {
                if (id !== clientId) {
                    client.socket.write(`Usuario desconectado: ${clientName}\n`);
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
