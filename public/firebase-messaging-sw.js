// Service worker version - increment this when making important changes
const SW_VERSION = "1.1.0";

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
    storageBucket: "pixelfed-38904.appspot.com",
    messagingSenderId: "1080382857079",
    appId: "1:1080382857079:web:412638d701febb0c034b72",
    measurementId: "G-PTH81EBDG4",
});

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
        // Check if the payload is encrypted
        // Handle both boolean and string values for compatibility
        if (payload.data.encrypted === true || payload.data.encrypted === "true") {
            try {
                console.log("Attempting to decrypt payload:", {
                    data: payload.data.data,
                    iv: payload.data.iv,
                    encrypted: payload.data.encrypted,
                    timestamp: payload.data.timestamp
                });
                
                // Decrypt the payload
                const decryptedData = await decryptNotificationPayload(
                    payload.data.data,
                    payload.data.iv
                );
                
                if (!decryptedData) {
                    console.error("Failed to decrypt notification payload");
                    // Fallback to showing the raw notification
                    processNotification(payload.data);
                    return;
                }
                
                console.log("Successfully decrypted data:", decryptedData);
                
                // Process the notification with decrypted data
                // Log the full decrypted data for debugging
                console.log("Full decrypted notification data:", decryptedData);
                
                processNotification({
                    body: decryptedData.body || "",
                    title: decryptedData.title || "New Notification",
                    url: decryptedData.url || "/",
                    notificationId: decryptedData.notificationId || ("notification-" + Date.now()),
                    timestamp: decryptedData.timestamp || Date.now().toString(),
                    type: decryptedData.type || "unknown"
                });
            } catch (error) {
                console.error("Error decrypting notification:", error);
                // Fallback: Display a generic notification so the user still gets notified
                console.log("Using fallback notification mechanism");
                processNotification({
                    body: "You have a new notification",
                    title: "Pixelfed",
                    url: "/notifications",
                    notificationId: "fallback-" + Date.now(),
                    timestamp: Date.now().toString()
                });
            }
        } else {
            // Handle legacy non-encrypted notifications
            processNotification(payload.data);
        }
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
