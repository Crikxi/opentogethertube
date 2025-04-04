<template>
	<div>
		<DebugPlayerWatcher :data="_debug" />
		<div class="youtube" id="ytcontainer"></div>
	</div>
</template>

<script>
import _ from "lodash";
import DebugPlayerWatcher from "@/components/debug/DebugPlayerWatcher.vue";
import { getSdk } from "@/util/playerHelper.js";
import toast from "@/util/toast";
import { ToastStyle } from "@/models/toast";
import { useCaptions } from "../composables";

const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";
// TODO: convert to ts and use an enum for this.
// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const YT_STATUS_UNSTARTED = -1;
const YT_STATUS_ENDED = 0;
const YT_STATUS_PLAYING = 1;
const YT_STATUS_PAUSED = 2;
const YT_STATUS_BUFFERING = 3;
const YT_STATUS_CUED = 5;

/**
 * Component that manages youtube's iframe player (and all of the woes that come with it), and provides the common OTT player interface.
 *
 * When the broswser has blocked autoplay videos (firefox):
 * - Youtube player state: UNSTARTED
 * - Youtube player state: BUFFERING
 * - Youtube player state: UNSTARTED
 * - At this point, the user must interact with the video manually in order to play the video.
 */
export default {
	name: "YoutubePlayer",
	props: {
		videoId: { type: String, required: true },
	},
	components: import.meta.env.DEV
		? {
				// eslint-disable-next-line vue/no-unused-components
				DebugPlayerWatcher,
		  }
		: {},
	emits: [
		"apiready",
		"ended",
		"playing",
		"paused",
		"buffering",
		"ready",
		"error",
		"buffer-progress",
	],
	data() {
		return {
			YT: null,
			player: null,
			resizeObserver: null,
			debug: {
				YoutubeState: null,
			},

			queuedSeek: null,
			queuedPlaying: null,
			queuedVolume: null,

			captionsEnabled: false,
			isCaptionsLoaded: false,
			resizeRunawayDetected: false,
		};
	},
	computed: {
		_debug() {
			return {
				...this.debug,
				queuedSeek: this.queuedSeek,
				queuedPlaying: this.queuedPlaying,
				isCaptionsEnabled: this.isCaptionsEnabled(),
				isCaptionsLoaded: this.isCaptionsLoaded,
			};
		},
	},
	async created() {
		this.YT = await getSdk(YOUTUBE_IFRAME_API_URL, "YT", "onYouTubeIframeAPIReady");
		if (!this.player) {
			this.player = new this.YT.Player("ytcontainer", {
				events: {
					onApiChange: this.onApiChange,
					onReady: this.onReady,
					onStateChange: this.onStateChange,
					onError: this.onError,
				},
				playerVars: {
					autoplay: 0,
					enablejsapi: 1,
					controls: 1,
					disablekb: 1,
					// required for iOS
					playsinline: 1,
				},
			});
		}

		this.resizeObserver = new ResizeObserver(this.fitToContainer);
		console.log(this.$el);
		this.resizeObserver.observe(this.$el);
	},
	mounted() {
		this.fitToContainer();
	},
	beforeUnmount() {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
		if (this.player && this.player.destroy) {
			this.player.destroy();
			delete this.player;
		}
	},
	setup() {
		const captions = useCaptions();
		return {
			captions,
		};
	},
	methods: {
		play() {
			if (!this.player) {
				this.queuedPlaying = true;
				return Promise.resolve();
			}
			this.player.playVideo();
			return Promise.resolve();
		},
		pause() {
			if (!this.player) {
				this.queuedPlaying = false;
				return;
			}
			this.player.pauseVideo();
		},
		getPosition() {
			if (!this.player) {
				return 0;
			}
			return this.player.getCurrentTime();
		},
		setPosition(position) {
			if (!this.player) {
				this.queuedSeek = position;
				return;
			}
			return this.player.seekTo(position);
		},
		setVolume(volume) {
			if (!this.player) {
				this.queuedVolume = volume;
				return;
			}
			this.player.setVolume(volume);
		},
		isCaptionsSupported() {
			return true;
		},
		isCaptionsEnabled() {
			return this.captionsEnabled;
		},
		setCaptionsEnabled(value) {
			if (!this.isCaptionsLoaded) {
				this.player.setOption("captions", "reload", true);
				this.isCaptionsLoaded = true;
			}
			if (value) {
				this.player.loadModule("captions");
				this.player.setOption("captions", "fontSize", 0);
			} else {
				this.player.unloadModule("captions");
			}
			this.captionsEnabled = value;
		},
		getCaptionsTracks() {
			const tracks = this.player.getOption("captions", "tracklist");
			if (!tracks) {
				return [];
			}
			return tracks.map(track => track.languageCode);
		},
		setCaptionsTrack(track) {
			if (!this.isCaptionsLoaded) {
				this.player.setOption("captions", "reload", true);
				this.isCaptionsLoaded = true;
			}
			const tracklist = this.getCaptionsTracks();
			console.debug(`youtube: found tracks:`, tracklist);
			if (tracklist.includes(track)) {
				this.player.setOption("captions", "track", track);
			} else {
				toast.add({
					content: `Unknown captions track ${track}`,
					style: ToastStyle.Error,
					duration: 4000,
				});
			}
		},

		getAvailablePlaybackRates() {
			if (!this.player) {
				return [1];
			}
			return this.player.getAvailablePlaybackRates();
		},
		getPlaybackRate() {
			if (!this.player) {
				return 1;
			}
			return this.player.getPlaybackRate();
		},
		setPlaybackRate(rate) {
			if (!this.player) {
				return;
			}
			this.player.setPlaybackRate(rate);
		},

		onApiChange() {
			console.debug(`youtube: onApiChange`);
			this.captions.captionsTracks.value = this.getCaptionsTracks();
		},
		onReady() {
			this.$emit("apiready");
			this.player.loadVideoById(this.videoId);
		},
		onStateChange(e) {
			this.debug.YoutubeState = e.data;
			if (e.data === YT_STATUS_ENDED) {
				this.$emit("ended");
			} else if (e.data === YT_STATUS_PLAYING) {
				this.$emit("playing");
			} else if (e.data === YT_STATUS_PAUSED) {
				this.$emit("paused");
			} else if (e.data === YT_STATUS_BUFFERING) {
				this.$emit("buffering");
			} else if (e.data === YT_STATUS_CUED) {
				this.$emit("ready");
			}

			if (e.data === YT_STATUS_PLAYING || e.data === YT_STATUS_PAUSED) {
				if (this.queuedSeek !== null) {
					this.player.seekTo(this.queuedSeek);
					this.queuedSeek = null;
				}
				if (this.queuedPlaying !== null) {
					if (this.queuedPlaying) {
						this.player.play();
					} else {
						this.player.pause();
					}
					this.queuedPlaying = null;
				}
				if (this.queuedVolume !== null) {
					this.player.setVolume(this.queuedVolume);
					this.queuedVolume = null;
				}
			}

			if (this.$store) {
				this.$emit("buffer-progress", this.player.getVideoLoadedFraction());
			}
		},
		onError() {
			this.$emit("error");
		},

		onResize: _.debounce(function () {
			this.fitToContainer();
		}, 25),
		fitToContainer() {
			if (!this.player) {
				return;
			}
			this.player.setSize("100%", "100%");
		},
	},
	watch: {
		videoId() {
			this.$emit("buffering");
			this.player.loadVideoById(this.videoId);
			this.isCaptionsLoaded = false;
			this.captionsEnabled = false;
		},
	},
};
</script>

<style lang="scss" scoped></style>
