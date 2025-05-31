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

    // Check if we have data in the payload
    if (payload.data) {
        const notificationBody = payload.data.body || "";

        // Filter out "site has been updated" notifications
        if (
            notificationBody.includes("updated in the background") ||
            notificationBody.includes("site has been updated")
        ) {
            console.log(
                "Filtered out site update notification:",
                notificationBody
            );
            return; // Skip this notification
        }

        // Check if this is a user interaction notification (like, comment, follow, etc.)
        const isUserInteraction =
            notificationBody.includes("liked") ||
            notificationBody.includes("followed") ||
            notificationBody.includes("commented") ||
            notificationBody.includes("mentioned") ||
            notificationBody.includes("message");

        // Only proceed with user interaction notifications
        if (isUserInteraction) {
            const notificationTitle = payload.data.title || "New Notification";
            const notificationOptions = {
                body: notificationBody,
                icon: "/img/logo/pwa/192.png",
                tag:
                    payload.data.notificationId || "notification-" + Date.now(), // Use unique ID to prevent duplicates
                vibrate: [100, 50, 100], // Vibration pattern
                data: {
                    url: payload.data.url || "/", // URL for navigation
                    timestamp: payload.data.timestamp || Date.now().toString(),
                },
            };

            // Check if we already displayed this notification
            const notificationKey = `notification-${payload.data.notificationId}`;
            const displayedNotifications = self.displayedNotifications || {};

            if (!displayedNotifications[notificationKey]) {
                // Mark this notification as displayed
                displayedNotifications[notificationKey] = true;
                self.displayedNotifications = displayedNotifications;

                // Display the notification
                self.registration.showNotification(
                    notificationTitle,
                    notificationOptions
                );
                console.log(
                    "Displayed user interaction notification:",
                    notificationBody
                );
            } else {
                console.log(
                    "Prevented duplicate notification:",
                    notificationKey
                );
            }
        } else {
            console.log(
                "Skipped non-user interaction notification:",
                notificationBody
            );
        }
    }
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
