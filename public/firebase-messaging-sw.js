// Firebase Messaging Service Worker
const SW_VERSION = '1.0.0';

// Initialize Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ",
    authDomain: "pixelfed-38904.firebaseapp.com",
    projectId: "pixelfed-38904",
    storageBucket: "pixelfed-38904.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdefghijklmnop"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Create inline crypto helper for decryption
if (typeof self !== 'undefined') {
    self.CryptoHelper = {
        async decrypt(encryptedData, iv, key) {
            try {
                // Backend does DOUBLE base64 encoding on encrypted data
                // First decode to get the actual base64 encrypted data
                const firstDecode = atob(encryptedData);
                const encryptedBuffer = Uint8Array.from(atob(firstDecode), c => c.charCodeAt(0));
                
                // IV is single base64 encoded
                const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
                
                if (ivBuffer.length !== 16) {
                    console.error("❌ IV length is wrong! Expected 16, got:", ivBuffer.length);
                    return null;
                }
                   
                // Process key EXACTLY the same way as backend: substr(hash('sha256', key), 0, 32)
                const encoder = new TextEncoder();
                const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key));
                const hashArray = new Uint8Array(hashBuffer);
                const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
                const keyHex = hashHex.substring(0, 32);
                const keyBytes = new Uint8Array(keyHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));

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

                // Convert to string and parse JSON
                const decryptedString = new TextDecoder().decode(decryptedBuffer);
                
                if (!decryptedString.trim()) {
                    return null;
                }

                try {
                    const parsedData = JSON.parse(decryptedString);
                    return parsedData;
                } catch (jsonError) {
                    return null;
                }
            } catch (error) {
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

// Function to decrypt notification payload
async function decryptNotificationPayload(encryptedData, iv) {
    try {
        const key = getEncryptionKey();
        
        if (!key) {
            console.error('Encryption key not found');
            return null;
        }

        // Decrypt the data
        console.log('Calling CryptoHelper.decrypt...');
        const decryptedData = await CryptoHelper.decrypt(encryptedData, iv, key);

        if (decryptedData) {
            console.log('Decryption successful, got data:', decryptedData);
            return decryptedData;
        } else {
            console.error('Decryption returned null');
            return null;
        }
    } catch (error) {
        console.error('Error in decryptNotificationPayload:', error);
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
        body: data.body || 'You have a new notification',
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
messaging.onBackgroundMessage((payload) => {
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
            // For encrypted notifications, backend sends: title, timestamp, encrypted, data, iv
            // The body, url, notificationId, type are encrypted in payload.data.data
            // Don't set defaults yet - wait for decryption
        } else {
            console.log("Processing UNENCRYPTED notification from backend");
            // For unencrypted notifications, backend sends: title, body, url, notificationId, timestamp, type
            notificationData.body = payload.data.body || "You have a new notification";
            notificationData.url = payload.data.url || "/notifications";
            notificationData.notificationId = payload.data.notificationId || ("notification-" + Date.now());
            notificationData.type = payload.data.type || "like";
        }
        
        // Check if the notification is encrypted
        if (payload.data.encrypted === "true" && payload.data.data && payload.data.iv) {
            console.log("Received encrypted notification, attempting to decrypt");
            
            try {
                // Try to decrypt the data
                const decryptedData = await decryptNotificationPayload(payload.data.data, payload.data.iv);
                
                if (decryptedData) {
                    console.log("Decryption successful, updating notification data");
                    
                    // Update notification data with decrypted values
                    notificationData.body = decryptedData.body || "You have a new notification";
                    notificationData.url = decryptedData.url || "/notifications";
                    notificationData.notificationId = decryptedData.notificationId || ("notification-" + Date.now());
                    notificationData.type = decryptedData.type || "like";
                    
                    console.log("Updated notification data with ALL decrypted fields:", notificationData);
                } else {
                    console.error("Failed to decrypt notification data, using fallback");
                    // Set fallback values for encrypted notification that failed to decrypt
                    notificationData.body = "You have a new notification (decryption failed)";
                    notificationData.url = "/notifications";
                    notificationData.notificationId = "notification-" + Date.now();
                    notificationData.type = "like";
                }
            } catch (error) {
                console.error("Error decrypting notification:", error);
                // Set fallback values
                notificationData.body = "You have a new notification (decryption error)";
                notificationData.url = "/notifications";
                notificationData.notificationId = "notification-" + Date.now();
                notificationData.type = "like";
            }
        }

        console.log("=== FINAL NOTIFICATION DATA ===");
        console.log("Notification body that will be displayed:", notificationData.body);
        console.log("Full notification data:", notificationData);

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
