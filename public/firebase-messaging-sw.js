// Service worker version - increment this when making important changes
const SW_VERSION = "1.3.0";

importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js"
);
importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js"
);
importScripts(
    "/js/crypto-helper.js"
);

// Install event: Do NOT call skipWaiting()
self.addEventListener("install", (event) => {
    console.log(`[Service Worker] Installing new version ${SW_VERSION}`);
    // Remove self.skipWaiting() to prevent immediate activation
    // Let the service worker stay in the "waiting" state
});

// Activate event: Do NOT call clients.claim()
self.addEventListener("activate", (event) => {
    console.log(`[Service Worker] Activated new version ${SW_VERSION}`);
    // Notify clients about the new service worker without forcing control
    event.waitUntil(
        clients.matchAll({ type: "window" }).then((clientList) => {
            clientList.forEach((client) => {
                client.postMessage({
                    type: "SW_UPDATE_AVAILABLE",
                    version: SW_VERSION,
                });
            });
        })
    );
});

firebase.initializeApp({
    apiKey: "AIzaSyCxKyv-Xh5R7iStYT9-MD7mdgb4rc3p3z0",
    authDomain: "pixelfed-38904.firebaseapp.com",
    projectId: "pixelfed-38904",
    storageBucket: "pixelfed-38904.firebasestorage.app",
    messagingSenderId: "1080382857079",
    appId: "1:1080382857079:web:412638d701febb0c034b72",
    measurementId: "G-PTH81EBDG4",
});

// firebase.initializeApp({
//     apiKey: "YOUR_API_KEY",
//     authDomain: "YOUR_AUTH_DOMAIN",
//     projectId: "YOUR_PROJECT_ID",
//     storageBucket: "YOUR_STORAGE_BUCKET",
//     messagingSenderId: "YOUR_SENDER_ID",
//     appId: "YOUR_APP_ID",
//     measurementId: "YOUR_MEASUREMENT_ID"
//   });
  
  

const messaging = firebase.messaging();

// Function to decrypt notification payload
async function decryptNotificationPayload(encryptedData, iv) {
    try {
        // Get the encryption key from localStorage or a secure source
        const key = getEncryptionKey();
        
        if (!key) {
            console.error("Encryption key not found");
            return null;
        }
        
        // Decrypt the data
        const decryptedData = await CryptoHelper.decrypt(encryptedData, iv, key);
        return decryptedData;
    } catch (error) {
        console.error("Decryption error:", error);
        return null;
    }
}

// Function to get the encryption key
function getEncryptionKey() {
    // In a real implementation, you might get this from a secure source
    // For demo purposes, we're using a hardcoded key
    // WARNING: In production, use a proper key management system
    console.log("Getting encryption key for notification decryption");
    
    // This key MUST match the NOTIFICATION_ENCRYPTION_KEY in the backend .env file
    // If notifications aren't showing, ensure this matches the backend key
    return "xJ8#p2$L7!qR9*vZ5@tN3^mE6&yK1bD4%sG0";
}

// Process notification with either encrypted or non-encrypted data
function processNotification(data) {
    const notificationBody = data.body || "";
    const notificationTitle = data.title || "New Notification";
    const notificationUrl = data.url || "/";
    const notificationId = data.notificationId || ("notification-" + Date.now());
    const timestamp = data.timestamp || Date.now().toString();

    // BLOCK LIST: Filter out any system notifications
    const blockTerms = [
        "updated",
        "background",
        "new version",
        "refresh",
        "reload",
        "restart",
        "update available",
        "has been updated",
    ];

    // Check if notification contains any blocked terms
    const containsBlockedTerm = blockTerms.some(
        (term) =>
            notificationBody.toLowerCase().includes(term.toLowerCase()) ||
            notificationTitle.toLowerCase().includes(term.toLowerCase())
    );

    if (containsBlockedTerm) {
        console.log("Blocked system notification:", {
            title: notificationTitle,
            body: notificationBody,
        });
        return; // Skip this notification entirely
    }

    // ALLOW LIST: Only show notifications that match specific user interaction patterns
    const isUserInteraction =
        notificationBody.includes("liked") ||
        notificationBody.includes("followed") ||
        notificationBody.includes("commented") ||
        notificationBody.includes("mentioned") ||
        notificationBody.includes("message") ||
        notificationBody.includes("tagged") ||
        notificationBody.includes("shared");

    // Only proceed with user interaction notifications
    if (isUserInteraction) {
        const notificationOptions = {
            body: notificationBody,
            icon: "/img/logo/pwa/192.png",
            tag: notificationId,
            vibrate: [100, 50, 100],
            data: {
                url: notificationUrl,
                timestamp: timestamp,
            },
        };

        // Check for duplicate notifications
        const notificationKey = `notification-${notificationId}`;
        const displayedNotifications = self.displayedNotifications || {};

        if (!displayedNotifications[notificationKey]) {
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

// Intercept all messages before they become notifications
messaging.onBackgroundMessage(async function (payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message",
        payload
    );

    // Check if we have data in the payload
    if (payload.data) {
        console.log("FCM payload data received:", payload.data);
        
        let notificationData;
        
        // Check if the notification is encrypted
        if (payload.data.encrypted === "true" && payload.data.data && payload.data.iv) {
            console.log("Received encrypted notification, attempting to decrypt");
            
            try {
                // Decrypt the data
                const decryptedData = await decryptNotificationPayload(payload.data.data, payload.data.iv);
                
                if (decryptedData) {
                    console.log("Successfully decrypted notification data:", decryptedData);
                    
                    // Combine decrypted data with non-encrypted fields
                    notificationData = {
                        ...decryptedData,
                        title: payload.data.title || "New Notification",
                        timestamp: payload.data.timestamp || Date.now().toString()
                    };
                } else {
                    console.error("Failed to decrypt notification data, using fallback");
                    // Fallback to basic notification if decryption fails
                    notificationData = {
                        body: "You have a new notification",
                        title: payload.data.title || "New Notification",
                        url: "/notifications",
                        notificationId: "notification-" + Date.now(),
                        timestamp: payload.data.timestamp || Date.now().toString(),
                        type: "unknown"
                    };
                }
            } catch (error) {
                console.error("Error decrypting notification:", error);
                // Fallback to basic notification if decryption fails
                notificationData = {
                    body: "You have a new notification",
                    title: payload.data.title || "New Notification",
                    url: "/notifications",
                    notificationId: "notification-" + Date.now(),
                    timestamp: payload.data.timestamp || Date.now().toString(),
                    type: "unknown"
                };
            }
        } else {
            // Handle non-encrypted notifications
            console.log("Received non-encrypted notification");
            notificationData = {
                body: payload.data.body || "",
                title: payload.data.title || "New Notification",
                url: payload.data.url || "/notifications",
                notificationId: payload.data.notificationId || ("notification-" + Date.now()),
                timestamp: payload.data.timestamp || Date.now().toString(),
                type: payload.data.type || "unknown"
            };
        }
        
        console.log("Final notification data to process:", notificationData);
        
        // Process the notification
        processNotification(notificationData);
    } else {
        console.warn("Received payload without data", payload);
    }
});

// Handle notification click to open specific page
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
