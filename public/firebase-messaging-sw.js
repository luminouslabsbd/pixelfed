// Firebase Service Worker - Push Notifications Handler
// Import Firebase scripts
importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js"
);
importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js"
);

// Initialize Firebase with configuration
firebase.initializeApp({
    apiKey: "AIzaSyCxKyv-Xh5R7iStYT9-MD7mdgb4rc3p3z0",
    authDomain: "pixelfed-38904.firebaseapp.com",
    projectId: "pixelfed-38904",
    storageBucket: "pixelfed-38904.appspot.com",
    messagingSenderId: "1080382857079",
    appId: "1:1080382857079:web:412638d701febb0c034b72",
    measurementId: "G-PTH81EBDG4",
});

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages when app is not in focus
messaging.onBackgroundMessage(function (payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message:",
        payload
    );

    // Extract notification data with fallbacks
    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
        body: payload.notification?.body || "You have a new message",
        icon: "/img/logo/pwa/192.png",
        badge: "/img/logo/pwa/96.png", // Small monochrome icon for status bar
        tag: "notification-tag", // Prevents duplicate notifications
        requireInteraction: false, // Auto-dismiss after a few seconds
        data: {
            url: payload.data?.url || "/",
            timestamp: Date.now(),
            ...payload.data, // Include any additional custom data
        },
        actions: [
            {
                action: "view",
                title: "View",
                icon: "/img/icons/view.png",
            },
            {
                action: "dismiss",
                title: "Dismiss",
                icon: "/img/icons/close.png",
            },
        ],
    };

    // Show the notification
    return self.registration.showNotification(
        notificationTitle,
        notificationOptions
    );
});

// Handle notification click events
self.addEventListener("notificationclick", function (event) {
    console.log("[firebase-messaging-sw.js] Notification clicked:", event);

    // Close the notification
    event.notification.close();

    // Handle different actions
    if (event.action === "dismiss") {
        console.log("Notification dismissed");
        return;
    }

    // Get the URL to open (default action or 'view' action)
    const urlToOpen = event.notification?.data?.url || "/";
    const baseUrl = self.location.origin;
    const fullUrl = urlToOpen.startsWith("http")
        ? urlToOpen
        : baseUrl + urlToOpen;

    // Handle the click event
    event.waitUntil(
        clients
            .matchAll({
                type: "window",
                includeUncontrolled: true,
            })
            .then((clientList) => {
                // Check if the target page is already open
                for (const client of clientList) {
                    if (client.url === fullUrl && "focus" in client) {
                        return client.focus();
                    }
                }

                // If no matching client found, open new window/tab
                if (clients.openWindow) {
                    return clients.openWindow(fullUrl);
                }
            })
            .catch((error) => {
                console.error("Error handling notification click:", error);
            })
    );
});
