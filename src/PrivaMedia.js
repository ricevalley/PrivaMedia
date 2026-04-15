import { App as capApp } from '@capacitor/app';
import { PrivacyScreen } from '@capacitor/privacy-screen';
import mediaData from './media.json'

class Utils {
	static createSafeProxy() {
		return new Proxy({}, {
			get(target, prop) {
				if (!(prop in target)) throw new Error(`Element "${prop}" is not cached.`);
				return target[prop];
			},
			set(target, prop, value) {
				if (value == null) throw new Error(`Cannot set "${prop}" to null or undefined.`);
				target[prop] = value;
				return true;
			}
		});
	}
}

class App {
	#password = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
	#state = {
		isLocked: true,
		shakeTimer: null,
		fadeOutTimer: null
	};
	#el = Utils.createSafeProxy();
	static config = {
		lockField: {
			maxInputLen: 8
		}
	}
	static selectors = {
		lockField: '#lockField',
		mainArea: '#mainArea',
		numberPad: '#numberPad',
		password: '.password'
	};
	static classNames = {
		hide: 'is-hidden',
		shake: 'shake',
		fadeOut: 'fade-out'
	};

	constructor() {
		this.#initPrivacy();
		this.#cacheElements();
		this.#initEvents();
		this.MediaPlayer = new MediaPlayer();
	}

	#cacheElements() {
		const lockField = document.querySelector(App.selectors.lockField);
		this.#el.lockField = lockField;
		this.#el.mainArea = document.querySelector(App.selectors.mainArea);
		this.#el.numberPad = lockField.querySelector(App.selectors.numberPad);
		this.#el.pwDisplay = lockField.querySelector(App.selectors.password);
	}

	#initEvents() {
		this.#el.numberPad.addEventListener('click', (e) => {
			if (!e.target.closest('button')) return;
			this.#handlePwInput(e.target.dataset.btn);
		});
		capApp.addListener('appStateChange', async ({isActive}) => {
			if (!isActive) {
				this.updateLock(true);
				this.MediaPlayer.stopPlayMedia(false);
			}
		});
	}

	async #initPrivacy() {
		try { await PrivacyScreen.enable(); }
		catch (e) { console.error(`PrivacyScreen error: ${e}`) };
	}

	#handlePwInput(btnData) {
		switch (btnData) {
			case 'delete':
				this.#el.pwDisplay.textContent = this.#el.pwDisplay.textContent.slice(0, -1);
				break;
			case 'enter':
				this.updateLock(false, this.#el.pwDisplay.textContent);
				this.#el.pwDisplay.textContent = '';
				break;
			default:
				if (!isNaN(btnData) && this.#el.pwDisplay.textContent.length < App.config.lockField.maxInputLen) this.#el.pwDisplay.textContent += btnData;
		}
	}

	async sha256(text) {
		if (!text) return;
		const unit8Text = new TextEncoder().encode(text);
		const hashBuffer = await crypto.subtle.digest('SHA-256', unit8Text);
		return Array.from(new Uint8Array(hashBuffer))
			.map(b => b.toString(16).padStart(2, '0')).join('');
	}

	async updateLock(enable = true, password) {
		const hashPassword = await this.sha256(password);
		if (!enable && this.#password !== hashPassword) return this.#playEffect(App.classNames.shake, 'shakeTimer', 500);
		this.#state.isLocked = enable;
		this.#playEffect(App.classNames.fadeOut, 'fadeOutTimer', 500, () => {
			this.#el.lockField.classList.toggle(App.classNames.hide, !enable);
			this.#el.mainArea.classList.toggle(App.classNames.hide, enable);
		});
	}

	#playEffect(className, timerKey, duration, complete = null) {
		document.body.classList.add(className);
		clearTimeout(this.#state[timerKey]);
		this.#state[timerKey] = setTimeout(() => {
			document.body.classList.remove(className);
			if (complete) complete();
		}, duration);
	}
}

class MediaPlayer {

	static selectors = {
		background: '.background',
		mediaPlayField: '#mediaPlayField',
		mediaList: '#mediaList'
	};
	static classNames = {
		hide: 'is-hidden',
	};
	#el = Utils.createSafeProxy();

	constructor() {
		this.#cacheElements();
		this.#initEvents();
		this.makeMediaList();
	}

	#cacheElements() {
		const background = document.querySelector(MediaPlayer.selectors.background);
		this.#el.mediaPlayField = background.querySelector(MediaPlayer.selectors.mediaPlayField);
		this.#el.mediaList = background.querySelector(MediaPlayer.selectors.mediaList);
	}

	#initEvents() {
		this.#el.mediaPlayField.addEventListener('click', (e) => {
			if (e.target !== e.currentTarget) return;
			this.stopPlayMedia(true);
			this.#el.mediaPlayField.replaceChildren();
			this.#el.mediaPlayField.classList.add(MediaPlayer.classNames.hide);
		});
		this.#el.mediaList.addEventListener('click', (e) => {
			const listItem = e.target.closest('li.media-list-item');
			if (!listItem || !listItem.dataset.videoId) return;
			this.#playMedia(listItem.dataset.videoId);
		});
	}

	#playMedia(id) {
		if (!mediaData[id]?.video) return;
		const videoEl = `
			<video class="video" playsinline controls>
				<source src="${mediaData[id].video}">
				${mediaData[id].captions ? `<track src="${mediaData[id].captions}" kind="subtitles" srclang="ja" label="字幕" default>`:''}
			</video>`;
		this.#el.mediaPlayField.insertAdjacentHTML('beforeend', videoEl);
		this.#el.mediaPlayField.classList.remove(MediaPlayer.classNames.hide);
	}

	stopPlayMedia(close) {
		const video = this.#el.mediaPlayField.querySelector('video');
		video?.pause();
		if (!close || !video) return;
		video.src = '';
		video.load();
	}

	makeMediaList() {
		for (const [k, v] of Object.entries(mediaData)) {
			const listEl = `
			<li class="media-list-item" data-video-id="${k}">
				<p class="list-title">${v.title}</p>
				<img src="${v.thumbnail}" class="list-thumbnail">
				<p class="list-description">${v.description.replace(/\n/g, '<br>')}</p>
			</li>`;
			this.#el.mediaList.insertAdjacentHTML('beforeend', listEl);
		}
	}
}
new App();