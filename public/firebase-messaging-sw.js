// Firebase Messaging Service Worker
const SW_VERSION = '1.1.0';

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
            timestamp: payload.data.timestamp || Date.now().toString(),
            notificationId: payload.data.notificationId || ("notification-" + Date.now()),
            type: payload.data.type || "like"
        };

        // Handle encrypted vs unencrypted notifications differently
        if (payload.data.encrypted === "true") {
            console.log("Processing ENCRYPTED notification from backend");
            
            try {
                // Get the base URL from the service worker scope
                const baseUrl = self.registration.scope;
                const apiUrl = new URL('/api/notification/decrypt', baseUrl).href;
                
                // Call the decryption API
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        body: payload.data.body || null,
                        url: payload.data.url || null
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API responded with status: ${response.status}`);
                }
                
                const decryptedData = await response.json();
                
                // Set the decrypted body and URL
                notificationData.body = decryptedData.body || "You have a new notification";
                notificationData.url = decryptedData.url || "/notifications";
                
                console.log("Decryption successful:", {
                    body: notificationData.body,
                    url: notificationData.url
                });
                
            } catch (error) {
                console.error("Error decrypting notification:", error);
                // Set fallback values
                notificationData.body = "You have a new notification";
                notificationData.url = "/notifications";
            }
        } else {
            console.log("Processing UNENCRYPTED notification from backend else");
            // For unencrypted notifications, backend sends: title, body, url, notificationId, timestamp, type
            notificationData.body = payload.data.body || "You have a new notification";
            notificationData.url = payload.data.url || "/notifications";
        }

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
            actions: [{
                action: 'open',
                title: 'Open'
            }]
        });

        console.log("Notification displayed:", {
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
    console.log('[firebase-messaging-sw.js] Notification click received');

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
