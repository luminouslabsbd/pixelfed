import VueI18n from "vue-i18n";

require("./polyfill");
window._ = require("lodash");
window.Popper = require("popper.js").default;
window.pixelfed = window.pixelfed || {};
window.$ = window.jQuery = require("jquery");
require("bootstrap");
window.axios = require("axios");
window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
require("readmore-js");
window.blurhash = require("blurhash");

let token = document.head.querySelector('meta[name="csrf-token"]');
if (token) {
    window.axios.defaults.headers.common["X-CSRF-TOKEN"] = token.content;
} else {
    console.error("CSRF token not found.");
}

window.App = window.App || {};

window.App.redirect = function () {
    document.querySelectorAll("a").forEach(function (i, k) {
        let a = i.getAttribute("href");
        if (a && a.length > 5 && a.startsWith("https://")) {
            let url = new URL(a);
            if (
                url.host !== window.location.host &&
                url.pathname !== "/i/redirect"
            ) {
                i.setAttribute(
                    "href",
                    "/i/redirect?url=" + encodeURIComponent(a)
                );
            }
        }
    });
};

window.App.boot = function () {
    Vue.use(VueI18n);

    let i18nMessages = {
        en: require("./i18n/en.json"),
        pt: require("./i18n/pt.json"),
    };
    let locale = document.querySelector("html").getAttribute("lang");

    const i18n = new VueI18n({
        locale: locale, // set locale
        fallbackLocale: "en",
        messages: i18nMessages,
    });
    new Vue({
        el: "#content",
        i18n,
    });
};

window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
        // Register the main service worker
        navigator.serviceWorker.register("/sw.js").then(registration => {
            // Check for updates periodically
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000); // Check for updates every hour
        });
        
        // Register the Firebase service worker
        navigator.serviceWorker.register("/firebase-messaging-sw.js").then(registration => {
            console.log('Firebase Service Worker registered with scope:', registration.scope);
            
            // Check for updates periodically
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000); // Check for updates every hour
        }).catch(error => {
            console.error('Firebase Service Worker registration failed:', error);
        });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'SW_UPDATED') {
                console.log(`Service Worker updated to version ${event.data.version}`);
                
                // Show update notification to user
                showUpdateNotification(event.data.version);
            }
        });
    }
});

// Function to show update notification to user
function showUpdateNotification(version) {
    // Check if we've already shown this notification
    const lastNotifiedVersion = localStorage.getItem('lastNotifiedVersion');
    if (lastNotifiedVersion === version) {
        return; // Already notified for this version
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="alert alert-info alert-dismissible fade show" role="alert">
            <strong>App Updated!</strong> Pixelfed has been updated to version ${version}.
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Save that we've shown this notification
    localStorage.setItem('lastNotifiedVersion', version);
    
    // Add styles if not already present
    if (!document.getElementById('update-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'update-notification-styles';
        style.textContent = `
            .update-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 400px;
            }
        `;
        document.head.appendChild(style);
    }
}

window.App.util = {
    compose: {
        post: function () {
            let path = window.location.pathname;
            let whitelist = ["/", "/timeline/public"];
            if (whitelist.includes(path)) {
                $("#composeModal").modal("show");
            } else {
                window.location.href = "/?a=co";
            }
        },
        circle: function () {
            console.log("Unsupported method.");
        },
        collection: function () {
            console.log("Unsupported method.");
        },
        loop: function () {
            console.log("Unsupported method.");
        },
        story: function () {
            console.log("Unsupported method.");
        },
    },
    time: function () {
        return new Date();
    },
    version: 1,
    format: {
        count: function (count = 0, locale = "en-GB", notation = "compact") {
            if (count < 1) {
                return 0;
            }
            return new Intl.NumberFormat(locale, {
                notation: notation,
                compactDisplay: "short",
            }).format(count);
        },
        timeAgo: function (ts) {
            const date = new Date(ts);
            const now = new Date();

            const seconds = Math.floor((now - date) / 1000);

            const secondsInYear = 60 * 60 * 24 * 365.25;
            let interval = Math.floor(seconds / secondsInYear);
            if (interval >= 1) {
                return interval + "y";
            }

            interval = Math.floor(seconds / (60 * 60 * 24 * 7));
            if (interval >= 1) {
                return interval + "w";
            }

            interval = Math.floor(seconds / (60 * 60 * 24));
            if (interval >= 1) {
                return interval + "d";
            }

            interval = Math.floor(seconds / (60 * 60));
            if (interval >= 1) {
                return interval + "h";
            }

            interval = Math.floor(seconds / 60);
            if (interval >= 1) {
                return interval + "m";
            }

            return Math.floor(seconds) + "s";
        },
        timeAhead: function (ts, short = true) {
            let date = Date.parse(ts);
            let diff = date - Date.parse(new Date());
            let seconds = Math.floor(diff / 1000);
            let interval = Math.floor(seconds / 63072000);
            if (interval >= 1) {
                return interval + (short ? "y" : " years");
            }
            interval = Math.floor(seconds / 604800);
            if (interval >= 1) {
                return interval + (short ? "w" : " weeks");
            }
            interval = Math.floor(seconds / 86400);
            if (interval >= 1) {
                return interval + (short ? "d" : " days");
            }
            interval = Math.floor(seconds / 3600);
            if (interval >= 1) {
                return interval + (short ? "h" : " hours");
            }
            interval = Math.floor(seconds / 60);
            if (interval >= 1) {
                return interval + (short ? "m" : " minutes");
            }
            return Math.floor(seconds) + (short ? "s" : " seconds");
        },
        rewriteLinks: function (i) {
            let tag = i.innerText;

            if (i.href.startsWith(window.location.origin)) {
                return i.href;
            }

            if (tag.startsWith("#") == true) {
                tag = "/discover/tags/" + tag.substr(1) + "?src=rph";
            } else if (tag.startsWith("@") == true) {
                tag = "/" + i.innerText + "?src=rpp";
            } else {
                tag = "/i/redirect?url=" + encodeURIComponent(tag);
            }

            return tag;
        },
    },
    filters: [
        ["1984", "filter-1977"],
        ["Azen", "filter-aden"],
        ["Astairo", "filter-amaro"],
        ["Grassbee", "filter-ashby"],
        ["Bookrun", "filter-brannan"],
        ["Borough", "filter-brooklyn"],
        ["Farms", "filter-charmes"],
        ["Hairsadone", "filter-clarendon"],
        ["Cleana ", "filter-crema"],
        ["Catpatch", "filter-dogpatch"],
        ["Earlyworm", "filter-earlybird"],
        ["Plaid", "filter-gingham"],
        ["Kyo", "filter-ginza"],
        ["Yefe", "filter-hefe"],
        ["Goddess", "filter-helena"],
        ["Yards", "filter-hudson"],
        ["Quill", "filter-inkwell"],
        ["Rankine", "filter-kelvin"],
        ["Juno", "filter-juno"],
        ["Mark", "filter-lark"],
        ["Chill", "filter-lofi"],
        ["Van", "filter-ludwig"],
        ["Apache", "filter-maven"],
        ["May", "filter-mayfair"],
        ["Ceres", "filter-moon"],
        ["Knoxville", "filter-nashville"],
        ["Felicity", "filter-perpetua"],
        ["Sandblast", "filter-poprocket"],
        ["Daisy", "filter-reyes"],
        ["Elevate", "filter-rise"],
        ["Nevada", "filter-sierra"],
        ["Futura", "filter-skyline"],
        ["Sleepy", "filter-slumber"],
        ["Steward", "filter-stinson"],
        ["Savoy", "filter-sutro"],
        ["Blaze", "filter-toaster"],
        ["Apricot", "filter-valencia"],
        ["Gloming", "filter-vesper"],
        ["Walter", "filter-walden"],
        ["Poplar", "filter-willow"],
        ["Xenon", "filter-xpro-ii"],
    ],
    filterCss: {
        "filter-1977": "sepia(.5) hue-rotate(-30deg) saturate(1.4)",
        "filter-aden": "sepia(.2) brightness(1.15) saturate(1.4)",
        "filter-amaro":
            "sepia(.35) contrast(1.1) brightness(1.2) saturate(1.3)",
        "filter-ashby": "sepia(.5) contrast(1.2) saturate(1.8)",
        "filter-brannan":
            "sepia(.4) contrast(1.25) brightness(1.1) saturate(.9) hue-rotate(-2deg)",
        "filter-brooklyn":
            "sepia(.25) contrast(1.25) brightness(1.25) hue-rotate(5deg)",
        "filter-charmes":
            "sepia(.25) contrast(1.25) brightness(1.25) saturate(1.35) hue-rotate(-5deg)",
        "filter-clarendon":
            "sepia(.15) contrast(1.25) brightness(1.25) hue-rotate(5deg)",
        "filter-crema":
            "sepia(.5) contrast(1.25) brightness(1.15) saturate(.9) hue-rotate(-2deg)",
        "filter-dogpatch": "sepia(.35) saturate(1.1) contrast(1.5)",
        "filter-earlybird":
            "sepia(.25) contrast(1.25) brightness(1.15) saturate(.9) hue-rotate(-5deg)",
        "filter-gingham": "contrast(1.1) brightness(1.1)",
        "filter-ginza":
            "sepia(.25) contrast(1.15) brightness(1.2) saturate(1.35) hue-rotate(-5deg)",
        "filter-hefe":
            "sepia(.4) contrast(1.5) brightness(1.2) saturate(1.4) hue-rotate(-10deg)",
        "filter-helena":
            "sepia(.5) contrast(1.05) brightness(1.05) saturate(1.35)",
        "filter-hudson":
            "sepia(.25) contrast(1.2) brightness(1.2) saturate(1.05) hue-rotate(-15deg)",
        "filter-inkwell": "brightness(1.25) contrast(.85) grayscale(1)",
        "filter-kelvin":
            "sepia(.15) contrast(1.5) brightness(1.1) hue-rotate(-10deg)",
        "filter-juno":
            "sepia(.35) contrast(1.15) brightness(1.15) saturate(1.8)",
        "filter-lark":
            "sepia(.25) contrast(1.2) brightness(1.3) saturate(1.25)",
        "filter-lofi": "saturate(1.1) contrast(1.5)",
        "filter-ludwig":
            "sepia(.25) contrast(1.05) brightness(1.05) saturate(2)",
        "filter-maven":
            "sepia(.35) contrast(1.05) brightness(1.05) saturate(1.75)",
        "filter-mayfair": "contrast(1.1) brightness(1.15) saturate(1.1)",
        "filter-moon": "brightness(1.4) contrast(.95) saturate(0) sepia(.35)",
        "filter-nashville":
            "sepia(.25) contrast(1.5) brightness(.9) hue-rotate(-15deg)",
        "filter-perpetua": "contrast(1.1) brightness(1.25) saturate(1.1)",
        "filter-poprocket": "sepia(.15) brightness(1.2)",
        "filter-reyes":
            "sepia(.75) contrast(.75) brightness(1.25) saturate(1.4)",
        "filter-rise": "sepia(.25) contrast(1.25) brightness(1.2) saturate(.9)",
        "filter-sierra":
            "sepia(.25) contrast(1.5) brightness(.9) hue-rotate(-15deg)",
        "filter-skyline":
            "sepia(.15) contrast(1.25) brightness(1.25) saturate(1.2)",
        "filter-slumber": "sepia(.35) contrast(1.25) saturate(1.25)",
        "filter-stinson":
            "sepia(.35) contrast(1.25) brightness(1.1) saturate(1.25)",
        "filter-sutro":
            "sepia(.4) contrast(1.2) brightness(.9) saturate(1.4) hue-rotate(-10deg)",
        "filter-toaster":
            "sepia(.25) contrast(1.5) brightness(.95) hue-rotate(-15deg)",
        "filter-valencia": "sepia(.25) contrast(1.1) brightness(1.1)",
        "filter-vesper":
            "sepia(.35) contrast(1.15) brightness(1.2) saturate(1.3)",
        "filter-walden":
            "sepia(.35) contrast(.8) brightness(1.25) saturate(1.4)",
        "filter-willow":
            "brightness(1.2) contrast(.85) saturate(.05) sepia(.2)",
        "filter-xpro-ii":
            "sepia(.45) contrast(1.25) brightness(1.75) saturate(1.3) hue-rotate(-5deg)",
    },
    emoji: [
        "😂",
        "💯",
        "❤️",
        "🙌",
        "👏",
        "👌",
        "😍",
        "😯",
        "😢",
        "😅",
        "😁",
        "🙂",
        "😎",
        "😀",
        "🤣",
        "😃",
        "😄",
        "😆",
        "😉",
        "😊",
        "😋",
        "😘",
        "😗",
        "😙",
        "😚",
        "🤗",
        "🤩",
        "🤔",
        "🤨",
        "😐",
        "😑",
        "😶",
        "🙄",
        "😏",
        "😣",
        "😥",
        "😮",
        "🤐",
        "😪",
        "😫",
        "😴",
        "😌",
        "😛",
        "😜",
        "😝",
        "🤤",
        "😒",
        "😓",
        "😔",
        "😕",
        "🙃",
        "🤑",
        "😲",
        "🙁",
        "😖",
        "😞",
        "😟",
        "😤",
        "😭",
        "😦",
        "😧",
        "😨",
        "😩",
        "🤯",
        "😬",
        "😰",
        "😱",
        "😳",
        "🤪",
        "😵",
        "😡",
        "😠",
        "🤬",
        "😷",
        "🤒",
        "🤕",
        "🤢",
        "🤮",
        "🤧",
        "😇",
        "🤠",
        "🤡",
        "🤥",
        "🤫",
        "🤭",
        "🧐",
        "🤓",
        "😈",
        "👿",
        "👹",
        "👺",
        "💀",
        "👻",
        "👽",
        "🤖",
        "💩",
        "😺",
        "😸",
        "😹",
        "😻",
        "😼",
        "😽",
        "🙀",
        "😿",
        "😾",
        "🤲",
        "👐",
        "🤝",
        "👍",
        "👎",
        "👊",
        "✊",
        "🤛",
        "🤜",
        "🤞",
        "✌️",
        "🤟",
        "🤘",
        "👈",
        "👉",
        "👆",
        "👇",
        "☝️",
        "✋",
        "🤚",
        "🖐",
        "🖖",
        "👋",
        "🤙",
        "💪",
        "🖕",
        "✍️",
        "🙏",
        "💍",
        "💄",
        "💋",
        "👄",
        "👅",
        "👂",
        "👃",
        "👣",
        "👁",
        "👀",
        "🧠",
        "🗣",
        "👤",
        "👥",
    ],
    embed: {
        post: function (url, caption = true, likes = false, layout = "full") {
            let u = url + "/embed?";
            u += caption ? "caption=true&" : "caption=false&";
            u += likes ? "likes=true&" : "likes=false&";
            u += layout == "compact" ? "layout=compact" : "layout=full";
            return (
                '<iframe title="Pixelfed Post Embed" src="' +
                u +
                '" class="pixelfed__embed" style="max-width: 100%; border: 0" width="400" allowfullscreen="allowfullscreen"></iframe><script async defer src="' +
                window.location.origin +
                '/embed.js"></script>'
            );
        },
        profile: function (url) {
            let u = url + "/embed";
            return (
                '<iframe title="Pixelfed Profile Embed" src="' +
                u +
                '" class="pixelfed__embed" style="max-width: 100%; border: 0" width="400" allowfullscreen="allowfullscreen"></iframe><script async defer src="' +
                window.location.origin +
                '/embed.js"></script>'
            );
        },
    },

    clipboard: function (data) {
        return navigator.clipboard.writeText(data);
    },

    navatar: function () {
        $("#navbarDropdown .far").addClass("d-none");
        $("#navbarDropdown img")
            .attr("src", window._sharedData.curUser.avatar)
            .removeClass("d-none")
            .addClass("rounded-circle border shadow")
            .attr("width", 38)
            .attr("height", 38);
    },
};
