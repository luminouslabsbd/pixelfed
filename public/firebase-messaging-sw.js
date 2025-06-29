// Service worker version - increment this when making important changes
const SW_VERSION = "1.5.0";

// Debug: Log all notification attempts
console.log(`[Service Worker] Loading version ${SW_VERSION} - System notifications will be blocked`);

importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js"
);
importScripts(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js"
);
// Try to import crypto helper with error handling
console.log("Attempting to load crypto-helper.js...");
try {
    importScripts("/js/crypto-helper.js");
    console.log("Successfully loaded crypto-helper.js from absolute path");
    console.log("CryptoHelper available:", typeof CryptoHelper !== 'undefined');
} catch (error) {
    console.error("Failed to load crypto-helper.js from absolute path:", error);
    console.log("Error details:", error.message);
    console.log("Attempting to load from relative path...");
    try {
        importScripts("js/crypto-helper.js");
        console.log("Successfully loaded crypto-helper.js from relative path");
        console.log("CryptoHelper available:", typeof CryptoHelper !== 'undefined');
    } catch (error2) {
        console.error("Failed to load crypto-helper.js from relative path:", error2);
        console.log("Error details:", error2.message);
        console.log("Crypto helper not available - encrypted notifications will not work");

        // Create a minimal inline crypto helper as fallback
        console.log("Creating inline crypto helper fallback...");
        self.CryptoHelper = {
            async decrypt(encryptedData, iv, key) {
                try {
                    console.log("Using inline crypto helper fallback");

                    // Convert base64 to array buffer
                    const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
                    const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

                    // Process key the same way as backend
                    const encoder = new TextEncoder();
                    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key));
                    const hashArray = new Uint8Array(hashBuffer);
                    const keyBytes = hashArray.slice(0, 32);

                    // Import key
                    const cryptoKey = await crypto.subtle.importKey(
                        'raw',
                        keyBytes,
                        { name: 'AES-CBC', length: 256 },
                        false,
                        ['decrypt']
                    );

                    // Decrypt
                    const decryptedBuffer = await crypto.subtle.decrypt(
                        { name: 'AES-CBC', iv: ivBuffer },
                        cryptoKey,
                        encryptedBuffer
                    );

                    // Convert to string and parse JSON
                    const decryptedString = new TextDecoder().decode(decryptedBuffer);
                    return JSON.parse(decryptedString);
                } catch (error) {
                    console.error("Inline crypto helper error:", error);
                    return null;
                }
            }
        };
        console.log("Inline crypto helper created successfully");
        console.log("CryptoHelper now available:", typeof CryptoHelper !== 'undefined');
    }
}

// Final check of CryptoHelper availability
console.log("Final CryptoHelper check:", typeof CryptoHelper !== 'undefined' ? "Available" : "Not available");

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

        // Check if CryptoHelper is available
        if (typeof CryptoHelper === 'undefined') {
            console.error("CryptoHelper not available - cannot decrypt notification");
            return null;
        }

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

    // Only block notifications that are clearly system-generated (not from your backend)
    // Check if this is a notification from your backend (has type or notificationId)
    const isBackendNotification = data.type || data.notificationId || data.url;

    if (!isBackendNotification && data && (data.body || data.title)) {
        const bodyText = (data.body || '').toLowerCase();
        const titleText = (data.title || '').toLowerCase();

        // Only block very specific system phrases, not general words
        const systemUpdatePhrases = [
            'this site has been updated in the background',
            'new version of this site is available',
            'refresh this page to see updates'
        ];

        for (const phrase of systemUpdatePhrases) {
            if (bodyText.includes(phrase) || titleText.includes(phrase)) {
                console.log(`BLOCKED: System update notification detected - "${phrase}"`);
                console.log('Blocked notification data:', { title: data.title, body: data.body });
                return; // Exit immediately
            }
        }
    }

    // Log that we're processing a backend notification
    if (isBackendNotification) {
        console.log('Processing backend notification:', {
            type: data.type,
            notificationId: data.notificationId,
            title: data.title,
            body: data.body
        });
    }

    const notificationBody = data.body || "";
    const notificationTitle = data.title || "New Notification";
    const notificationUrl = data.url || "/";
    const notificationId = data.notificationId || ("notification-" + Date.now());
    const timestamp = data.timestamp || Date.now().toString();
    const notificationType = data.type || "unknown";

    // Only block if this is NOT a backend notification and contains specific system phrases
    const isFromBackend = notificationType !== "unknown" || notificationId.includes("notification-") === false;

    if (!isFromBackend &&
        (notificationBody.toLowerCase().includes("this site has been updated in the background") ||
         notificationTitle.toLowerCase().includes("this site has been updated in the background"))) {
        console.log("Blocked specific system update notification");
        return;
    }
    
    console.log('Extracted notification fields:', {
        body: notificationBody,
        title: notificationTitle,
        url: notificationUrl,
        id: notificationId,
        type: notificationType
    });

    // BLOCK LIST: Only block very specific system notification phrases
    // Don't block general words that might be in user notifications
    const blockTerms = [
        "this site has been updated in the background",
        "new version of this site is available",
        "refresh this page to see updates",
        "site needs to be refreshed"
    ];

    // Only check for blocked terms if this is NOT a backend notification
    const hasBackendIdentifiers = notificationType !== "unknown" ||
                                  notificationUrl !== "/" ||
                                  notificationId.startsWith("notification-") === false;

    if (!hasBackendIdentifiers) {
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
                reason: "Contains blocked term"
            });
            return;
        }
    } else {
        console.log("Allowing backend notification:", {
            title: notificationTitle,
            body: notificationBody,
            type: notificationType
        });
    }

    // ALLOW LIST: Show notifications that are from backend or match user interaction patterns
    const isUserInteraction =
        notificationType === "like" ||
        notificationType === "follow" ||
        notificationType === "comment" ||
        notificationType === "mention" ||
        notificationType === "dm" ||
        notificationType === "tag" ||
        notificationType === "share" ||
        notificationType === "comment_like" ||
        notificationBody.includes("liked") ||
        notificationBody.includes("followed") ||
        notificationBody.includes("commented") ||
        notificationBody.includes("mentioned") ||
        notificationBody.includes("message") ||
        notificationBody.includes("tagged") ||
        notificationBody.includes("shared");

    // Also allow if this looks like a backend notification (has proper structure)
    const isFromBackendService = notificationType !== "unknown" ||
                                 notificationUrl !== "/" ||
                                 (notificationId && !notificationId.startsWith("notification-" + Date.now().toString().slice(0, 8)));

    // Only proceed with user interaction notifications or backend notifications
    if (isUserInteraction || isFromBackendService) {
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
            requireInteraction: false, // Changed to false for better compatibility
            silent: false,
            renotify: false
        };

        // Display the notification
        console.log('Attempting to show notification:', {
            title: notificationTitle,
            options: notificationOptions
        });

        // Check if we can show notifications
        if (!self.registration) {
            console.error('Service worker registration not available');
            return;
        }

        try {
            const notificationPromise = self.registration.showNotification(
                notificationTitle,
                notificationOptions
            );

            if (notificationPromise && notificationPromise.then) {
                notificationPromise
                    .then(() => {
                        console.log('Notification displayed successfully:', {
                            title: notificationTitle,
                            body: notificationBody,
                            url: notificationUrl
                        });
                    })
                    .catch(error => {
                        console.error('Error in notification promise:', error);
                    });
            } else {
                console.log('Notification displayed (no promise returned):', {
                    title: notificationTitle,
                    body: notificationBody,
                    url: notificationUrl
                });
            }
        } catch (error) {
            console.error('Error showing notification:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
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

    // Check notification permission
    if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted, cannot show notification');
        return;
    }

    // Only block very specific system notifications at FCM level
    if (payload.notification && payload.notification.body) {
        const body = payload.notification.body.toLowerCase();
        if (body.includes('this site has been updated in the background')) {
            console.log('Blocked system notification at FCM level:', payload.notification);
            return;
        }
    }

    // Check if we have data in the payload
    if (payload.data) {
        console.log("FCM payload data received:", payload.data);
        
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

        // Process the notification through the normal processing function
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

// Test function to verify notification display works
function testNotificationDisplay() {
    console.log('Testing notification display...');

    if (Notification.permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
    }

    const testOptions = {
        body: 'This is a test notification to verify display functionality',
        icon: '/img/logo/pwa/192.png',
        tag: 'test-notification',
        vibrate: [100, 50, 100],
        data: {
            url: '/',
            timestamp: Date.now().toString(),
            type: 'test'
        },
        requireInteraction: false
    };

    try {
        self.registration.showNotification('Test Notification', testOptions);
        console.log('Test notification displayed successfully');
    } catch (error) {
        console.error('Error displaying test notification:', error);
    }
}

// Expose test function for debugging
self.testNotificationDisplay = testNotificationDisplay;

// Add a message listener for testing from the main thread
self.addEventListener('message', function(event) {
    console.log('Service worker received message:', event.data);

    if (event.data && event.data.type === 'TEST_NOTIFICATION') {
        console.log('Testing notification from message...');
        testNotificationDisplay();
    } else if (event.data && event.data.type === 'TEST_ENCRYPTED_NOTIFICATION') {
        console.log('Testing encrypted notification simulation...');

        // Simulate an encrypted notification
        const testData = {
            body: 'Test encrypted notification body',
            url: 'https://example.com/test',
            notificationId: 'test_encrypted_123',
            type: 'like'
        };

        processNotification(testData);
    } else if (event.data && event.data.type === 'TEST_PROCESS_NOTIFICATION') {
        console.log('Testing notification processing from test page...');
        const testData = event.data.data;

        // Process the notification and send result back
        try {
            processNotification(testData);

            // Send result back to the page
            event.ports[0]?.postMessage({
                type: 'NOTIFICATION_RESULT',
                message: `Processed notification: ${testData.title} - ${testData.body}`
            });
        } catch (error) {
            console.error('Error processing test notification:', error);
            event.ports[0]?.postMessage({
                type: 'NOTIFICATION_RESULT',
                message: `Error processing notification: ${error.message}`
            });
        }
    } else if (event.data && event.data.type === 'TEST_CRYPTO_HELPER') {
        console.log('Testing crypto helper availability...');

        try {
            // Test if CryptoHelper is available
            if (typeof CryptoHelper !== 'undefined') {
                console.log('CryptoHelper is available');

                // Test basic functionality
                const testKey = "xJ8#p2$L7!qR9*vZ5@tN3^mE6&yK1bD4%sG0";
                const testData = "eyJib2R5IjoidGVzdCJ9"; // base64 encoded {"body":"test"}
                const testIV = "MTIzNDU2Nzg5MDEyMzQ1Ng=="; // base64 encoded test IV

                CryptoHelper.decrypt(testData, testIV, testKey)
                    .then(result => {
                        console.log('Crypto helper test result:', result);
                        event.ports[0]?.postMessage({
                            type: 'CRYPTO_TEST_RESULT',
                            success: true,
                            message: 'Crypto helper is working'
                        });
                    })
                    .catch(error => {
                        console.error('Crypto helper test failed:', error);
                        event.ports[0]?.postMessage({
                            type: 'CRYPTO_TEST_RESULT',
                            success: false,
                            error: error.message
                        });
                    });
            } else {
                console.error('CryptoHelper is not available');
                event.ports[0]?.postMessage({
                    type: 'CRYPTO_TEST_RESULT',
                    success: false,
                    error: 'CryptoHelper is not available'
                });
            }
        } catch (error) {
            console.error('Error testing crypto helper:', error);
            event.ports[0]?.postMessage({
                type: 'CRYPTO_TEST_RESULT',
                success: false,
                error: error.message
            });
        }
    } else if (event.data && event.data.type === 'SIMULATE_FCM_MESSAGE') {
        console.log('Simulating FCM background message...');
        const payload = event.data.payload;

        // Process exactly like a real FCM message
        try {
            // Check notification permission
            if (Notification.permission !== 'granted') {
                console.warn('Notification permission not granted, cannot show notification');
                return;
            }

            // Check if we have data in the payload
            if (payload.data) {
                console.log("Simulated FCM payload data received:", payload.data);

                // Create notification data structure
                let notificationData = {
                    body: payload.data.body || "You have a new notification",
                    title: payload.data.title || "New Notification",
                    url: payload.data.url || "/notifications",
                    notificationId: payload.data.notificationId || ("notification-" + Date.now()),
                    timestamp: payload.data.timestamp || Date.now().toString(),
                    type: payload.data.type || "like"
                };

                // Check if encrypted (simulate decryption)
                if (payload.data.encrypted === "true" && payload.data.data && payload.data.iv) {
                    console.log("Simulated encrypted notification");
                    // For testing, just use sample decrypted data
                    notificationData.body = "Decrypted: Someone liked your post";
                    notificationData.type = "like";
                }

                console.log("Final simulated notification data:", notificationData);

                // Process through normal flow
                processNotification(notificationData);
            }
        } catch (error) {
            console.error('Error processing simulated FCM message:', error);
        }
    }
});

// Override the showNotification method to add additional filtering
const originalShowNotification = self.registration.showNotification;
if (originalShowNotification) {
    self.registration.showNotification = function(title, options) {
        // Only block very specific system notification phrases
        const titleLower = title.toLowerCase();
        const bodyLower = options && options.body ? options.body.toLowerCase() : '';

        if (bodyLower.includes('this site has been updated in the background') ||
            titleLower.includes('this site has been updated in the background')) {
            console.log('Blocked notification via showNotification override:', { title, body: options?.body });
            return Promise.resolve();
        }

        console.log('Allowing notification:', { title, body: options?.body });
        return originalShowNotification.call(this, title, options);
    };
}
