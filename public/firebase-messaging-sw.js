// Firebase Messaging Service Worker
const SW_VERSION = '1.0.0';

// Initialize Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCxKyv-Xh5R7iStYT9-MD7mdgb4rc3p3z0",
    authDomain: "pixelfed-38904.firebaseapp.com",
    projectId: "pixelfed-38904",
    storageBucket: "pixelfed-38904.firebasestorage.app",
    messagingSenderId: "1080382857079",
    appId: "1:1080382857079:web:412638d701febb0c034b72",
    measurementId: "G-PTH81EBDG4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Create inline crypto helper for decryption
if (typeof self !== 'undefined') {
    self.CryptoHelper = {
        async decryptString(encryptedData, iv, key) {
            try {
                console.log("🔐 CryptoHelper.decryptString called with:", {
                    encryptedDataLength: encryptedData ? encryptedData.length : 0,
                    ivLength: iv ? iv.length : 0,
                    keyLength: key ? key.length : 0
                });

                // Backend does single base64 encoding for individual strings
                const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
                const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

                console.log("📊 Buffer lengths:", {
                    encryptedBufferLength: encryptedBuffer.length,
                    ivBufferLength: ivBuffer.length
                });

                if (ivBuffer.length !== 16) {
                    console.error("❌ IV length is wrong! Expected 16, got:", ivBuffer.length);
                    return null;
                }

                // Process key EXACTLY the same way as backend: substr(hash('sha256', key), 0, 32)
                const encoder = new TextEncoder();
                const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key));
                const hashArray = new Uint8Array(hashBuffer);
                const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

                // Take first 32 characters from hex string (this matches PHP's substr(hash('sha256', key), 0, 32))
                const keyString = hashHex.substring(0, 32);

                // Convert hex string to bytes the same way PHP does
                // PHP treats the 32-character hex string as raw bytes (each character = 1 byte)
                const keyBytes = new Uint8Array(32);
                for (let i = 0; i < 32; i++) {
                    keyBytes[i] = keyString.charCodeAt(i);
                }

                console.log("🔑 Key processing:", {
                    originalKeyLength: key.length,
                    hashHexLength: hashHex.length,
                    keyStringLength: keyString.length,
                    keyBytesLength: keyBytes.length,
                    keyString: keyString
                });

                // Import key for AES-256-CBC (same as backend)
                const cryptoKey = await crypto.subtle.importKey(
                    'raw',
                    keyBytes,
                    { name: 'AES-CBC', length: 256 },
                    false,
                    ['decrypt']
                );

                // Decrypt using AES-256-CBC (same as backend)
                const decryptedBuffer = await crypto.subtle.decrypt(
                    { name: 'AES-CBC', iv: ivBuffer },
                    cryptoKey,
                    encryptedBuffer
                );

                // Convert to string (no JSON parsing for individual strings)
                const decryptedString = new TextDecoder().decode(decryptedBuffer);
                console.log("✅ Decryption successful! Result:", decryptedString.substring(0, Math.min(100, decryptedString.length)));
                return decryptedString.trim() || null;
            } catch (error) {
                console.error("❌ CryptoHelper decryption error:", error);
                return null;
            }
        }
    };
}

// Function to get the encryption key
function getEncryptionKey() {
    // This MUST match the NOTIFICATION_ENCRYPTION_KEY in your backend .env
    const key = "xJ8#p2$L7!qR9*vZ5@tN3^mE6&yK1bD4%sG0";
    return key;
}

// Function to decrypt individual string fields
async function decryptString(encryptedData, iv) {
    try {
        console.log("🔑 decryptString called with:", {
            encryptedDataLength: encryptedData ? encryptedData.length : 0,
            ivLength: iv ? iv.length : 0,
            encryptedDataPreview: encryptedData ? encryptedData.substring(0, 20) + "..." : "null",
            ivPreview: iv ? iv.substring(0, 20) + "..." : "null"
        });

        const key = getEncryptionKey();

        if (!key) {
            console.error('❌ Encryption key not found');
            return null;
        }

        console.log("🔑 Using encryption key:", key.substring(0, 10) + "...");

        // Decrypt the string
        const decryptedString = await CryptoHelper.decryptString(encryptedData, iv, key);

        if (decryptedString) {
            return decryptedString;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error in decryptString:', error);
        return null;
    }
}

// Process notification with either encrypted or non-encrypted data
function processNotification(data) {
    console.log('Processing notification data:', data);

    // Check if this is a notification from your backend (has type or notificationId)
    const isBackendNotification = data.type || data.notificationId || data.url;
    
    if (!isBackendNotification) {
        console.log('Not a backend notification, ignoring');
        return false;
    }

    return {
        title: data.title || 'Pixelfed',
        body: data.body || 'You have a new notification (body decryption failed)',
        url: data.url || '/notifications',
        notificationId: data.notificationId || 'notification-' + Date.now(),
        type: data.type || 'like'
    };
}

// Install event
self.addEventListener("install", (event) => {
    console.log(`[Service Worker] Installing new version ${SW_VERSION}`);
});

// Activate event
self.addEventListener("activate", (event) => {
    console.log(`[Service Worker] Activated version ${SW_VERSION}`);
});

// Handle background messages from FCM
messaging.onBackgroundMessage(async (payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    try {
        // Check notification permission
        if (Notification.permission !== 'granted') {
            console.warn('Notification permission not granted, cannot show notification');
            return;
        }

        // Check if we have data in the payload
        if (!payload.data) {
            console.warn('No data in FCM payload');
            return;
        }

        console.log("FCM payload data received:", payload.data);

        // Create notification data structure
        let notificationData = {
            title: payload.data.title || "Pixelfed",
            timestamp: payload.data.timestamp || Date.now().toString()
        };

        // Handle encrypted vs unencrypted notifications differently
        if (payload.data.encrypted === "true") {
            console.log("Processing ENCRYPTED notification from backend");
            // For encrypted notifications, backend sends: title, body (encrypted), body_iv, url (encrypted), url_iv, notificationId, timestamp, type, encrypted
            // We need to decrypt body and url individually

            // Set unencrypted fields first
            notificationData.notificationId = payload.data.notificationId || ("notification-" + Date.now());
            notificationData.type = payload.data.type || "like";

            try {
                console.log("🔓 Starting decryption process...");
                console.log("📦 Payload data:", {
                    hasBody: !!payload.data.body,
                    hasBodyIv: !!payload.data.body_iv,
                    hasUrl: !!payload.data.url,
                    hasUrlIv: !!payload.data.url_iv,
                    bodyLength: payload.data.body ? payload.data.body.length : 0,
                    bodyIvLength: payload.data.body_iv ? payload.data.body_iv.length : 0
                });

                // Decrypt body
                if (payload.data.body && payload.data.body_iv) {
                    console.log("🔓 Attempting to decrypt body...");
                    const decryptedBody = await decryptString(payload.data.body, payload.data.body_iv);
                    console.log("✅ Body decryption result:", decryptedBody ? "SUCCESS" : "FAILED");
                    notificationData.body = decryptedBody || "You have a new notification (body decryption failed)";
                } else {
                    console.log("⚠️ No encrypted body data found");
                    notificationData.body = "You have a new notification (no encrypted body)";
                }

                // Decrypt url
                if (payload.data.url && payload.data.url_iv) {
                    console.log("🔓 Attempting to decrypt URL...");
                    const decryptedUrl = await decryptString(payload.data.url, payload.data.url_iv);
                    console.log("✅ URL decryption result:", decryptedUrl ? "SUCCESS" : "FAILED");
                    notificationData.url = decryptedUrl || "/notifications";
                } else {
                    console.log("⚠️ No encrypted URL data found");
                    notificationData.url = "/notifications";
                }

                console.log("Decryption successful, updated notification data:", notificationData);
            } catch (error) {
                console.error("Error decrypting notification fields:", error);
                // Set fallback values
                notificationData.body = "You have a new notification (decryption error)";
                notificationData.url = "/notifications";
                notificationData.notificationId = payload.data.notificationId || ("notification-" + Date.now());
                notificationData.type = payload.data.type || "like";
            }
        } else {
            console.log("Processing UNENCRYPTED notification from backend");
            // For unencrypted notifications, backend sends: title, body, url, notificationId, timestamp, type
            notificationData.body = payload.data.body || "You have a new notification";
            notificationData.url = payload.data.url || "/notifications";
            notificationData.notificationId = payload.data.notificationId || ("notification-" + Date.now());
            notificationData.type = payload.data.type || "like";
        }

        console.log("=== FINAL NOTIFICATION DATA ===");
        console.log("Title:", notificationData.title);
        console.log("Body:", notificationData.body);
        console.log("URL:", notificationData.url);
        console.log("Type:", notificationData.type);

        // Show the notification
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: '/img/logo/pwa/192.png',
            badge: '/img/logo/pwa/192.png',
            data: {
                url: notificationData.url,
                notificationId: notificationData.notificationId,
                type: notificationData.type
            },
            actions: [
                {
                    action: 'open',
                    title: 'Open'
                }
            ]
        });

        console.log("Notification displayed successfully:", {
            title: notificationData.title,
            body: notificationData.body,
            url: notificationData.url
        });

    } catch (error) {
        console.error('Error processing FCM background message:', error);
    }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click received.');

    event.notification.close();

    // Get the URL from the notification data
    const urlToOpen = event.notification.data?.url || '/notifications';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window/tab open with the target URL
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // If no existing window/tab, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
