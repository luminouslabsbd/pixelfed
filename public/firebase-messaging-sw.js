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

messaging.onBackgroundMessage(function (payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message",
        payload
    );

    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
        body: payload.notification?.body,
        icon: "/img/logo/pwa/192.png",
        tag: "notification-tag", // Prevents duplicate notifications
        // vibrate: [100, 50, 100], // Vibration pattern
        data: {
            url: payload.data?.url || "/", // pass custom URL for navigation
        },
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
                // for (const client of clientList) {
                //     // Focus if already open
                //     if (client.url === urlToOpen && "focus" in client) {
                //         return client.focus();
                //     }
                // }
                // // Open new tab if not open
                // if (clients.openWindow) {
                //     return clients.openWindow(urlToOpen);
                // }
            })
            .catch((err) => {
                console.error("Error handling notification click:", err);
            })
    );
});
