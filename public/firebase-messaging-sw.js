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

messaging.onBackgroundMessage(function (payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message ",
        payload
    );
    
    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
        body: payload.notification?.body,
        icon: "/img/logo/pwa/192.png", // Use a valid icon from manifest
        data: payload.data, // Include data for click handling
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

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
  
  // Log the full notification and data objects for debugging
  console.log('Notification object:', event.notification);
  console.log('Notification data:', event.notification.data);
  
  // Extract URL from notification data with better fallback handling
  let url = '/';
  
  try {
    // First try to get the URL from the notification data
    if (event.notification.data && event.notification.data.url) {
      url = event.notification.data.url;
      console.log('URL from notification data:', url);
    } 
    // If that fails, try to get it from FCM payload format
    else if (event.notification.data && event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.data) {
      url = event.notification.data.FCM_MSG.data.url || '/';
      console.log('URL from FCM_MSG:', url);
    }
  } catch (error) {
    console.error('Error extracting URL from notification:', error);
  }
  
  console.log('Final URL to open:', url);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open with this URL
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no existing window found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }).catch(error => {
      console.error('Error handling notification click:', error);
    })
  );
});
