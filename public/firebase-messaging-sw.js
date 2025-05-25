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
    storageBucket: "pixelfed-38904.firebasestorage.app",
    messagingSenderId: "1080382857079",
    appId: "1:1080382857079:web:412638d701febb0c034b72",
    measurementId: "G-PTH81EBDG4",
});

const messaging = firebase.messaging();

// messaging.onBackgroundMessage(function (payload) {
//     console.log(
//         "[firebase-messaging-sw.js] Received background message ",
//         payload
//     );

//     const notificationTitle = payload.notification?.title || "New Notification";
//     const notificationOptions = {
//         body: payload.notification?.body,
//         icon: "/img/logo/pwa/192.png", // Use a valid icon from manifest
//         data: payload.data, // Include data for click handling
//     };

//     self.registration.showNotification(notificationTitle, notificationOptions);
// });

// Handle generic push events
// self.addEventListener("push", function (event) {
//     console.log("[firebase-messaging-sw.js] Push event received:", event);
//     let data = {};
//     if (event.data) {
//         try {
//             data = event.data.json();
//         } catch (e) {
//             console.error("Error parsing push data:", e);
//         }
//     }

//     const notificationTitle = data.notification?.title || "New Notification";
//     const notificationOptions = {
//         body: data.notification?.body,
//         icon: "/img/logo/pwa/192.png",
//         data: data.data,
//     };

//     event.waitUntil(
//         self.registration.showNotification(
//             notificationTitle,
//             notificationOptions
//         )
//     );
// });

// Handle notification clicks
self.addEventListener('notificationclick', function (event) {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  event.notification.close();
  console.log(event.notification);
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
