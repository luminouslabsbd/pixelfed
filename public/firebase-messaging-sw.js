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
            badge: "/img/logo/pwa/192.png",
            data: {
                url: payload.data?.url || "/",
                // Preserve all data for click handling
                ...payload.data,
            },
            actions: [
                {
                    action: "open",
                    title: "Open",
                },
            ],
            requireInteraction: false,
            silent: false,
        };

        console.log(
            "Showing custom notification with data:",
            notificationOptions.data
        );
        return self.registration.showNotification(
            notificationTitle,
            notificationOptions
        );
    }

    // If payload.notification exists, Firebase will auto-display it
    // But we need to ensure the data is preserved for click handling
    console.log(
        "Firebase will auto-display this notification with data:",
        payload.data
    );
});

// Handle notification click
self.addEventListener("notificationclick", function (event) {
    console.log("[firebase-messaging-sw.js] Notification clicked:", event);
    console.log("Notification data:", event.notification.data);

    event.notification.close();

    // Get URL from notification data
    let urlToOpen = "/";

    if (event.notification.data && event.notification.data.url) {
        urlToOpen = event.notification.data.url;
    } else if (event.notification.data && event.notification.data.FCM_MSG) {
        // Handle Firebase auto-generated notifications
        const fcmData = event.notification.data.FCM_MSG;
        if (fcmData.data && fcmData.data.url) {
            urlToOpen = fcmData.data.url;
        }
    }

    console.log("URL to open:", urlToOpen);

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                console.log("Found clients:", clientList.length);

                // Try to focus existing tab with same origin
                for (const client of clientList) {
                    console.log("Client URL:", client.url);
                    if (
                        client.url.includes(self.location.origin) &&
                        "focus" in client
                    ) {
                        console.log("Focusing existing client and navigating");
                        client.focus();
                        // Navigate to the specific URL
                        return client.postMessage({
                            type: "NOTIFICATION_CLICK",
                            url: urlToOpen,
                        });
                    }
                }

                // Open new window if no existing client
                console.log("Opening new window");
                if (clients.openWindow) {
                    const fullUrl = urlToOpen.startsWith("http")
                        ? urlToOpen
                        : self.location.origin + urlToOpen;
                    return clients.openWindow(fullUrl);
                }
            })
            .catch((err) => {
                console.error("Error handling notification click:", err);
            })
    );
});
