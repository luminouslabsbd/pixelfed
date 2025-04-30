<template>
	<div class="timeline-onboarding">
		<div class="card card-body shadow-sm mb-3 p-5" style="border-radius: 15px;">
			<h1 class="text-center mb-4">✨ {{ $t('timeline.onboarding.welcome') }}</h1>
			<p class="text-center mb-3" style="font-size: 22px;">
				{{ $t('timeline.onboarding.thisIsYourHomeFeed') }}
			</p>

			<p class="text-center lead">{{ $t('timeline.onboarding.letUsHelpYouFind') }}</p>

			<p v-if="newlyFollowed" class="text-center mb-0">
				<a href="/i/web" class="btn btn-primary btn-lg primary font-weight-bold rounded-pill px-4"
					onclick="location.reload()">
					{{ $t('timeline.onboarding.refreshFeed') }}
				</a>
			</p>
		</div>

		<div class="row">
			<div class="col-12 col-md-6 mb-3" v-for="(profile, index) in popularAccounts">
				<div class="card shadow-sm border-0 rounded-px">
					<div class="card-body p-2">
						<profile-card :key="'pfc' + index" :profile="profile" class="w-100" v-on:follow="follow(index)"
							v-on:unfollow="unfollow(index)" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script type="text/javascript">
import ProfileCard from './../profile/ProfileHoverCard.vue';
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
	apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
	authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
	storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.VUE_APP_FIREBASE_APP_ID,
	measurementId: process.env.VUE_APP_FIREBASE_MEASUREMENT_ID,
}
export default {
	props: {
		profile: {
			type: Object
		}
	},

	components: {
		"profile-card": ProfileCard,
	},

	data() {
		return {
			popularAccounts: [],
			newlyFollowed: 0,
			app: null,
			messaging: null,
			title: '',
			body: '',
			status: '',
			user: {},
		};
	},

	mounted() {
		this.fetchPopularAccounts();
	},

	methods: {
		fetchPopularAccounts() {
			axios.get('/api/pixelfed/discover/accounts/popular')
				.then(res => {
					this.popularAccounts = res.data;
				})
		},

		follow(index) {
			axios.post('/api/v1/accounts/' + this.popularAccounts[index].id + '/follow')
				.then(res => {
					this.newlyFollowed++;
					this.$store.commit('updateRelationship', [res.data]);
					this.$emit('update-profile', {
						'following_count': this.profile.following_count + 1
					})
				});
		},

		unfollow(index) {
			axios.post('/api/v1/accounts/' + this.popularAccounts[index].id + '/unfollow')
				.then(res => {
					this.newlyFollowed--;
					this.$store.commit('updateRelationship', [res.data]);
					this.$emit('update-profile', {
						'following_count': this.profile.following_count - 1
					})
				});
		}
	},
	// FOR FCM
	mounted() {
		this.app = initializeApp(firebaseConfig)
		this.messaging = getMessaging(this.app)

		onMessage(this.messaging, (payload) => {
			const { title, body, icon } = payload.notification
			new Notification(title, { body, icon })
		})
		// ✨ Correct way: use `this.` to call your method
		this.initFirebaseMessagingRegistration()
	},
	methods: {
		async initFirebaseMessagingRegistration() {
			try {
				const permission = await Notification.requestPermission()
				if (permission !== 'granted') {
					// alert('Notification permission not granted.')
					return
				}

				const token = await getToken(this.messaging, {
					vapidKey: process.env.VUE_APP_FIREBASE_VAPID_KEY
				})
				this.user = window._sharedData.user;

				// console.log("🚀 ~ FCM Token:", token)
				// console.log("🚀 ~ User data", this.user)
				await this.saveTokenToServer(token)
			} catch (err) {
				console.error('Error getting FCM token:', err)
			}
		},
		async saveTokenToServer(token) {
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
							'X-PIXELFED-APP': 'Pixelfed'
						}

					}
				);
				// alert('Token saved successfully.');
			} catch (err) {
				console.error('Error saving token:', err.response?.data || err.message);
			}
		}

		// async saveTokenToServer(token) {
		// 	try {
		// 		await this.$axios.post('api/push/update', { token })
		// 		alert('Token saved successfully.')
		// 	} catch (err) {
		// 		console.error('Error saving token:', err)
		// 	}
		// 	// axios.post('/api/v1/statuses/' + this.post.id + '/favourite')
		// 	//     .then(res => {
		// 	//         //
		// 	//     }).catch(err => {
		// 	//         this.post.favourites_count = count;
		// 	//         this.post.favourited = false;
		// 	//     })
		// },
	},
}
</script>

<style lang="scss">
.timeline-onboarding {
	.profile-hover-card-inner {
		width: 100%;

		.d-flex {
			max-width: 100% !important;
		}
	}
}
</style>
