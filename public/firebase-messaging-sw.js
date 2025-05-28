importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js"
);
importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
    apiKey: "AIzaSyCxKyv-Xh5R7iStYT9-MD7mdgb4rc3p3z0",
    authDomain: "pixelfed-38904.firebaseapp.com",
    projectId: "pixelfed-38904",
    storageBucket: "pixelfed-38904.appspot.com", // fixed typo from 'firebaseStorage.app'
    messagingSenderId: "1080382857079",
    appId: "1:1080382857079:web:412638d701febb0c034b72",
    measurementId: "G-PTH81EBDG4",
});

const messaging = firebase.messaging();

// Keep track of notification IDs we've already shown
const shownNotifications = new Set();

messaging.onBackgroundMessage(function (payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message",
        payload
    );

    // Extract notification ID from payload
    const notificationId = payload.data?.notification_id || null;
    
    // Check if we've already shown this notification
    if (notificationId && shownNotifications.has(notificationId)) {
        console.log(`[firebase-messaging-sw.js] Skipping duplicate notification: ${notificationId}`);
        return;
    }
    
    // If we have an ID, remember that we've shown this notification
    if (notificationId) {
        shownNotifications.add(notificationId);
        
        // Clean up old notifications (keep only the last 50)
        if (shownNotifications.size > 50) {
            const iterator = shownNotifications.values();
            shownNotifications.delete(iterator.next().value);
        }
    }

    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
        body: payload.notification?.body,
        icon: "/img/logo/pwa/192.png",
        // Use the notification ID from the server if available, otherwise generate one
        tag: payload.notification?.tag || payload.data?.notification_id || `notification-${Date.now()}`,
        badge: "/img/logo/pwa/192.png",
        vibrate: [100, 50, 100],
        data: {
            url: payload.data?.url || "/",
            type: payload.data?.type,
            actor: payload.data?.actor,
            timestamp: payload.data?.timestamp || Date.now()
        },
        // Ensure notification is shown immediately
        requireInteraction: true,
        renotify: false
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ✅ Handle notification click to open specific page
self.addEventListener("notificationclick", function (event) {
    console.log("[firebase-messaging-sw.js] Notification clicked:", event);
    event.stopPropagation();
    event.notification.close();
    const urlToOpen = event.notification?.data?.url || "/";

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    // Focus if already open
                    if (client.url === urlToOpen && "focus" in client) {
                        return client.focus();
                    }
                }
                // Open new tab if not open
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
            .catch((err) => {
                console.error("Error handling notification click:", err);
            })
    );
});
