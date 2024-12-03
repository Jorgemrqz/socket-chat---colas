const net = require('net');
const crypto = require('crypto');

// Configuración de cifrado y HMAC
const HMAC_SECRET = 'erika_jorge'; // Clave secreta para HMAC
const ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 bytes
const IV = '1234567890123456'; // 16 bytes
const HOST = '127.0.0.1';
const PORT = 3000;

let client = null; // Socket del cliente
let clientId = ''; // ID único del cliente
let username = ''; // Nombre del usuario
let reconnectInterval = 5000; // Intervalo de reconexión en ms
let buffer = ''; // Buffer para manejar mensajes incompletos

// Conectar al servidor
function connectToServer() {
    client = new net.Socket();

    client.connect(PORT, HOST, () => {
        console.log('Conectado al servidor.');
        appendMessage('Conectado al servidor.');

        // Enviar el nombre de usuario al servidor como primer mensaje
        client.write(encryptMessage(username, clientId));
    });

    client.on('data', (data) => {
        buffer += data.toString(); // Acumular datos

        // Dividir el buffer por el delimitador de salto de línea '\n'
        const messages = buffer.split('\n');

        // Procesar todos los mensajes completos
        for (let i = 0; i < messages.length - 1; i++) {
            appendMessage(messages[i]); // Mostrar el mensaje completo
        }

        // Dejar el último mensaje incompleto en el buffer
        buffer = messages[messages.length - 1];
    });

    client.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.log('Servidor no disponible. Intentando reconectar...');
            appendMessage('Servidor no disponible. Intentando reconectar...');
        } else {
            console.error('Error en el cliente:', err.message);
            appendMessage(`Error: ${err.message}`);
        }
    });

    client.on('close', () => {
        console.log('Conexión con el servidor cerrada.');
        appendMessage('Servidor desconectado. Intentando reconectar...');
        attemptReconnect(); // Intentar reconectar automáticamente
    });
}

// Intentar reconexión automática
function attemptReconnect() {
    setTimeout(() => {
        console.log('Intentando reconectar al servidor...');
        connectToServer();
    }, reconnectInterval);
}

// Enviar mensaje al servidor
function sendMessage() {
    const messageInput = document.getElementById('message');
    const message = messageInput.value.trim();

    if (message) {
        const encryptedMessage = encryptMessage(message, clientId);
        client.write(encryptedMessage); // Enviar mensaje cifrado
        appendMessage(`Tú: ${message}`); // Mostrar en la interfaz
        messageInput.value = ''; // Limpiar caja de texto
    }
}

// Mostrar mensajes en la interfaz
function appendMessage(text) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Desplazar hacia el final
}

// Manejar el formulario de nombre
document.getElementById('start-chat').addEventListener('click', () => {
    username = document.getElementById('username').value.trim();
    clientId = `user-${Date.now()}`; // Generar un ID único basado en el tiempo

    if (!username) {
        alert('Por favor, ingresa un nombre.');
        return;
    }

    // Ocultar formulario y mostrar el contenedor del chat
    document.getElementById('form-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';

    // Conectar al servidor con el nombre ingresado
    connectToServer();
});

// Manejar envío de mensajes desde el chat
document.getElementById('send-message').addEventListener('click', sendMessage);

// Funciones de cifrado
function encryptMessage(message, clientId) {
    const data = `${message}|${generateHMAC(message)}|${clientId}`;
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function generateHMAC(message) {
    return crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
}
