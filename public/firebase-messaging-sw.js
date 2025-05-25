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
    storageBucket: "pixelfed-38904.appspot.com",
    messagingSenderId: "1080382857079",
    appId: "1:1080382857079:web:412638d701febb0c034b72",
    measurementId: "G-PTH81EBDG4",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message",
        payload
    );

    // 🔥 KEY FIX: Only show notification if Firebase won't auto-display it
    // Firebase auto-displays notifications that have a 'notification' payload
    // Only manually show if you need custom behavior or data-only messages

    if (!payload.notification) {
        // This is a data-only message, manually display notification
        const notificationTitle = payload.data?.title || "New Notification";
        const notificationOptions = {
            body: payload.data?.body || payload.data?.message,
            icon: "/img/logo/pwa/192.png",
            data: {
                url: payload.data?.url || "/",
            },
        };

        return self.registration.showNotification(
            notificationTitle,
            notificationOptions
        );
    }

    // If payload.notification exists, Firebase will auto-display it
    // Just log it and let Firebase handle the display
    console.log("Firebase will auto-display this notification");
});

// Handle notification click
self.addEventListener("notificationclick", function (event) {
    console.log("[firebase-messaging-sw.js] Notification clicked:", event);
    event.notification.close();

    const urlToOpen = event.notification?.data?.url || "/";

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url === urlToOpen && "focus" in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
            .catch((err) => {
                console.error("Error handling notification click:", err);
            })
    );
});
