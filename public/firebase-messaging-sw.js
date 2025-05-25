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

// Set a global variable to track if we've already shown a notification for a message
// This helps prevent duplicate notifications
const processedNotifications = new Set();

messaging.onBackgroundMessage(function (payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message",
        payload
    );

    // Generate a unique ID for this notification
    const notificationId = payload.data?.id || `notification-${Date.now()}`;
    
    // Check if we've already processed this notification
    if (processedNotifications.has(notificationId)) {
        console.log("[firebase-messaging-sw.js] Skipping duplicate notification:", notificationId);
        return;
    }
    
    // Mark this notification as processed
    processedNotifications.add(notificationId);
    
    // Clean up old notification IDs (keep only last 50)
    if (processedNotifications.size > 50) {
        const iterator = processedNotifications.values();
        processedNotifications.delete(iterator.next().value);
    }

    // Extract notification details from payload
    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationBody = payload.notification?.body || "";
    
    // Ensure we have a valid URL for navigation
    const targetUrl = payload.data?.url || "/";
    
    // Create notification options with consistent data structure
    const notificationOptions = {
        body: notificationBody,
        icon: "/img/logo/pwa/192.png",
        badge: "/img/logo/pwa/48.png",
        tag: notificationId, // Use tag to replace existing notifications with same ID
        data: {
            url: targetUrl,
            timestamp: Date.now(),
            id: notificationId
        },
        // Add actions if needed
        actions: [
            {
                action: 'view',
                title: 'View'
            }
        ],
        // Ensure notification is shown with high priority
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };

    console.log("[firebase-messaging-sw.js] Showing notification with options:", notificationOptions);
    
    // Show the notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks (both direct clicks and action button clicks)
self.addEventListener("notificationclick", function (event) {
    console.log("[firebase-messaging-sw.js] Notification clicked:", event);
    
    // Always close the notification when clicked
    event.notification.close();

    // Extract the URL from the notification data
    const urlToOpen = new URL(
        event.notification.data?.url || "/",
        self.location.origin
    ).href;

    console.log("[firebase-messaging-sw.js] Navigating to URL:", urlToOpen);

    event.waitUntil(
        clients
            .matchAll({ 
                type: "window", 
                includeUncontrolled: true 
            })
            .then((clientList) => {
                // Check if a window client is already open
                for (const client of clientList) {
                    const clientUrl = new URL(client.url);
                    const targetUrl = new URL(urlToOpen);
                    
                    // Compare origins and paths for more accurate matching
                    if (clientUrl.origin === targetUrl.origin && 
                        clientUrl.pathname === targetUrl.pathname && 
                        "focus" in client) {
                        return client.focus();
                    }
                }
                
                // If no matching client found, open a new window
                return clients.openWindow(urlToOpen).then(client => {
                    if (client) {
                        return client.focus();
                    }
                });
            })
            .catch((err) => {
                console.error("Error handling notification click:", err);
            })
    );
});
