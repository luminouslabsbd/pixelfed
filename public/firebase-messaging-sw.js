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
        console.log('Starting decryption process with:', { 
            encryptedDataLength: encryptedData.length,
            ivLength: iv.length 
        });
        
        // Get the encryption key from localStorage or a secure source
        const key = getEncryptionKey();
        
        if (!key) {
            console.error("Encryption key not found");
            return null;
        }
        
        console.log('Using encryption key (first few chars):', key.substring(0, 5) + '...');
        
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
        console.error("Decryption error in decryptNotificationPayload:", error);
        console.error("Error details:", { 
            message: error.message, 
            name: error.name,
            stack: error.stack 
        });
        return null;
    }
}

// Function to get the encryption key
function getEncryptionKey() {
    // In a real-world scenario, this should be securely stored
    // For demo purposes, we're hardcoding the key (same as in .env)
    const key = "xJ8#p2$L7!qR9*vZ5@tN3^mE6&yK1bD4%sG0";
    console.log('Using encryption key (first few chars):', key.substring(0, 5) + '...');
    return key;
}

// Process notification with either encrypted or non-encrypted data
function processNotification(data) {
    console.log('Processing notification data:', data);
    
    const notificationBody = data.body || "";
    const notificationTitle = data.title || "New Notification";
    const notificationUrl = data.url || "/";
    const notificationId = data.notificationId || ("notification-" + Date.now());
    const timestamp = data.timestamp || Date.now().toString();
    const notificationType = data.type || "unknown";
    
    console.log('Extracted notification fields:', {
        body: notificationBody,
        title: notificationTitle,
        url: notificationUrl,
        id: notificationId,
        type: notificationType
    });

    // FORCE DISPLAY FOR TESTING - REMOVE THIS IN PRODUCTION
    // This will bypass all filters to ensure notifications are displaying
    const forceDisplay = true;

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

    if (containsBlockedTerm && !forceDisplay) {
        console.log("Blocked system notification:", {
            title: notificationTitle,
            body: notificationBody,
        });
        return;
    }

    // ALLOW LIST: Only show notifications that match specific user interaction patterns
    const isUserInteraction =
        notificationType === "like" ||
        notificationType === "follow" ||
        notificationType === "comment" ||
        notificationType === "mention" ||
        notificationType === "dm" ||
        notificationType === "tag" ||
        notificationType === "share" ||
        notificationBody.includes("liked") ||
        notificationBody.includes("followed") ||
        notificationBody.includes("commented") ||
        notificationBody.includes("mentioned") ||
        notificationBody.includes("message") ||
        notificationBody.includes("tagged") ||
        notificationBody.includes("shared");

    // Only proceed with user interaction notifications or if force display is enabled
    if (isUserInteraction || forceDisplay) {
        const notificationOptions = {
            body: notificationBody,
            icon: "/img/logo/pwa/192.png",
            tag: notificationId,
            vibrate: [100, 50, 100],
            data: {
                url: notificationUrl,
                timestamp: timestamp,
                type: notificationType
            },
            requireInteraction: true
        };

        // Check for duplicate notifications
        const notificationKey = `notification-${notificationId}`;
        const displayedNotifications = self.displayedNotifications || {};

        if (!displayedNotifications[notificationKey]) {
            displayedNotifications[notificationKey] = true;
            self.displayedNotifications = displayedNotifications;

            // Display the notification
            console.log('Showing notification with options:', notificationOptions);
            self.registration.showNotification(
                notificationTitle,
                notificationOptions
            ).then(() => {
                console.log('Notification displayed successfully');
            }).catch(error => {
                console.error('Error showing notification:', error);
            });
            
            console.log(
                "Displayed notification:",
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
        
        // TEMPORARY: Force display all notifications for testing
        const forceDisplay = true;
        
        // Create a basic notification with the available data
        let notificationData = {
            body: payload.data.body || "You have a new notification",
            title: payload.data.title || "New Notification",
            url: payload.data.url || "/notifications",
            notificationId: payload.data.notificationId || ("notification-" + Date.now()),
            timestamp: payload.data.timestamp || Date.now().toString(),
            type: payload.data.type || "like"
        };
        
        // Check if the notification is encrypted
        if (payload.data.encrypted === "true" && payload.data.data && payload.data.iv) {
            console.log("Received encrypted notification, attempting to decrypt");
            console.log("Raw encrypted data:", payload.data.data);
            console.log("Raw IV:", payload.data.iv);
            
            try {
                // Try to decrypt the data
                const decryptedData = await decryptNotificationPayload(payload.data.data, payload.data.iv);
                
                if (decryptedData) {
                    console.log("Successfully decrypted notification data:", decryptedData);
                    
                    // Update notification data with decrypted fields
                    if (decryptedData.body) notificationData.body = decryptedData.body;
                    if (decryptedData.url) notificationData.url = decryptedData.url;
                    if (decryptedData.notificationId) notificationData.notificationId = decryptedData.notificationId;
                    if (decryptedData.type) notificationData.type = decryptedData.type;
                    
                    console.log("Updated notification data with decrypted fields:", notificationData);
                } else {
                    console.error("Failed to decrypt notification data, using fallback");
                }
            } catch (error) {
                console.error("Error decrypting notification:", error);
                console.error("Error details:", { 
                    message: error.message, 
                    name: error.name,
                    stack: error.stack 
                });
            }
        }
        
        console.log("Final notification data to process:", notificationData);
        
        // TEMPORARY: Force display for testing
        if (forceDisplay) {
            // Display a basic notification directly without filtering
            const notificationOptions = {
                body: notificationData.body || "You have a new notification",
                icon: "/img/logo/pwa/192.png",
                tag: notificationData.notificationId || "notification-" + Date.now(),
                vibrate: [100, 50, 100],
                data: {
                    url: notificationData.url || "/notifications",
                    timestamp: notificationData.timestamp || Date.now().toString(),
                    type: notificationData.type || "like"
                },
                requireInteraction: true
            };
            
            console.log("FORCING notification display with options:", notificationOptions);
            
            self.registration.showNotification(
                notificationData.title || "New Notification",
                notificationOptions
            ).then(() => {
                console.log("Notification displayed successfully");
            }).catch(error => {
                console.error("Error showing notification:", error);
            });
        } else {
            // Process the notification through normal filters
            processNotification(notificationData);
        }
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
