<template>
    <div class="web-wrapper">
        <div v-if="isLoaded" class="container-fluid mt-3">
            <div class="row">
                <div class="col-md-4 col-lg-3">
                    <sidebar :user="profile" @refresh="shouldRefresh = true" />
                </div>
                <div class="col-md-8 col-lg-6 px-0">
                    <story-carousel v-if="storiesEnabled" :profile="profile" />
                    <timeline :profile="profile" :scope="scope" :key="scope" v-on:update-profile="updateProfile"
                        :refresh="shouldRefresh" @refreshed="shouldRefresh = false" />
                </div>
                <div class="d-none d-lg-block col-lg-3">
                    <rightbar class="sticky-top sidebar" />
                </div>
            </div>
            <drawer />
        </div>
        <div v-else class="d-flex justify-content-center align-items-center" style="height:calc(100vh - 58px);">
            <b-spinner />
        </div>
    </div>
</template>

<script type="text/javascript">
import Drawer from './partials/drawer.vue';
import Sidebar from './partials/sidebar.vue';
import Rightbar from './partials/rightbar.vue';
import Timeline from './sections/Timeline.vue';
import StoryCarousel from './partials/timeline/StoryCarousel.vue';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
    authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VUE_APP_FIREBASE_APP_ID,
    measurementId: process.env.VUE_APP_FIREBASE_MEASUREMENT_ID,
};

export default {
    props: {
        scope: {
            type: String,
            default: 'home'
        }
    },
    components: {
        "drawer": Drawer,
        "sidebar": Sidebar,
        "timeline": Timeline,
        "rightbar": Rightbar,
        "story-carousel": StoryCarousel,
    },
    data() {
        return {
            isLoaded: false,
            profile: undefined,
            recommended: [],
            trending: [],
            storiesEnabled: false,
            shouldRefresh: false,
            showUpdateWarning: false,
            showUpdateConnectionWarning: false,
            updateInfo: undefined,
            popularAccounts: [],
            newlyFollowed: 0,
            app: null,
            messaging: null,
            user: null,
        };
    },
    mounted() {
        this.init();
        if (!Object.values(firebaseConfig).every(Boolean)) {
            console.error('Firebase configuration is incomplete.');
            return;
        }
        this.app = initializeApp(firebaseConfig);
        this.messaging = getMessaging(this.app);
        onMessage(this.messaging, (payload) => {
            const { title, body, icon } = payload.notification;
            new Notification(title, { body, icon });
        });
        this.initFirebaseMessagingRegistration();
    },
    watch: {
        '$route': 'init'
    },
    methods: {
        init() {
            this.profile = window._sharedData?.user;
            this.user = this.profile;
            this.isLoaded = true;
            this.storiesEnabled = window.App?.config?.features?.stories ?? false;
            if (this.profile?.is_admin) {
                this.softwareUpdateCheck();
            }
        },
        updateProfile(delta) {
            this.profile = Object.assign(this.profile, delta);
        },
        softwareUpdateCheck() {
            axios.get('/api/web-admin/software-update/check')
                .then(res => {
                    if (!res?.data?.hasOwnProperty('running_latest') || res.data.running_latest) {
                        return;
                    }
                    if (res.data.running_latest === null) {
                        this.updateInfo = res.data;
                        this.showUpdateConnectionWarning = true;
                        return;
                    }
                    this.updateInfo = res.data;
                    this.showUpdateWarning = !res.data.running_latest;
                })
                .catch(err => {
                    this.showUpdateConnectionWarning = true;
                });
        },
        async checkDeviceToken() {
            if (!this.user?.id) {
                return { hasValidToken: false };
            }
            try {
                const response = await axios.post('/api/v1/check-expo-token', {
                    profile_id: this.user.id
                });

                if (response.status === 200) {
                    return { hasValidToken: true };
                }
                return { hasValidToken: false };
            } catch (err) {
                return { hasValidToken: false };
            }
        },
        async initFirebaseMessagingRegistration() {
            if (!('Notification' in window) || !this.messaging) {
                console.warn('Notifications not supported or Firebase messaging not initialized.');
                return;
            }
            try {
                const currentPermission = Notification.permission;
                // Check if a valid token exists
                const { hasValidToken } = await this.checkDeviceToken();
                // Case 1: Permission is default (undecided), prompt for permission
                if (currentPermission === 'default') {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                        return;
                    }
                }
                // Case 2: Permission is granted but no valid token, retrieve new token
                else if (currentPermission === 'granted' && !hasValidToken) {
                    // console.log('Permission granted but no valid token, retrieving new token.');
                }
                // Case 3: Permission is granted and valid token exists, skip
                else if (currentPermission === 'granted' && hasValidToken) {
                    // console.log('Permission granted and valid token exists, skipping.');
                    return;
                }
                // Case 4: Permission is denied, exit
                else if (currentPermission === 'denied') {
                    // console.log('Notification permission denied by user.');
                    return;
                }

                // Retrieve token if permission is granted and no valid token
                const token = await getToken(this.messaging, {
                    vapidKey: process.env.VUE_APP_FIREBASE_VAPID_KEY
                });
                if (!this.user?.id) {
                    // console.error('saveTokenToServer: User data not available.');
                    return;
                }

                await this.saveTokenToServer(token);
                // console.log('Token saved successfully.');
            } catch (err) {
                // console.error('initFirebaseMessagingRegistration error:', err);
            }
        },
        async saveTokenToServer(token) {
            if (!this.user?.id) {
                // console.error('saveTokenToServer: User data not available.');
                return;
            }
            try {
                await axios.post(
                    '/api/v1.1/push/update',
                    {
                        token,
                        notify_enabled: true,
                        notify_like: this.user.notify_like ?? true,
                        notify_follow: this.user.notify_follow ?? true,
                        notify_mention: this.user.notify_mention ?? true,
                        notify_comment: this.user.notify_comment ?? true,
                        user: this.user
                    },
                    {
                        headers: {
                            'X-PIXELFED-APP': process.env.VUE_APP_NAME || 'Pixelfed'
                        }
                    }
                );
            } catch (err) {
                // console.error('saveTokenToServer error:', err.response?.data || err.message);
            }
        }
    }
}
</script>

<style lang="scss" scoped>
.avatar {
    border-radius: 15px;
}

.username {
    margin-bottom: -6px;
}

.btn-white {
    background-color: #fff;
    border: 1px solid #F3F4F6;
}

.sidebar {
    top: 90px;
}
</style>