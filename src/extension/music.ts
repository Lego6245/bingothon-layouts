'use strict';

import * as nodecgApiContext from './util/nodecg-api-context';
import {MPC, MPDError} from 'mpc-js';
import { SongData } from '../../schemas';

const nodecg = nodecgApiContext.get();
var mpdConfig = nodecg.bundleConfig.mpd || {};
var volume = mpdConfig.volume || 10;
var currentVolume = volume;
var fadeInterval: NodeJS.Timeout;
var shuffleInterval: NodeJS.Timeout;
var connected = false;

// Stores song data to be displayed on layouts.
var songData = nodecg.Replicant<SongData>('songData', { persistent: false });

// Set up connection to MPD server.
var client = new MPC();
connect();
function connect() {
	client.connectTCP(
		mpdConfig.address || 'localhost',
		mpdConfig.port || 6600
	);

	// Set up events.
	client.on('ready', onReady);
	client.on('socket-end', onEnd);
	client.on('socket-error ', onError);
	client.on('changed-player', onSystemPlayer);
}

/* TODO implement
var currentScene = nodecg.Replicant('currentOBSScene');
currentScene.on('change', (newVal, oldVal) => {
	newVal = newVal ? newVal.toLowerCase() : undefined;
	oldVal = oldVal ? oldVal.toLowerCase() : undefined;

	// Stop music
	if (oldVal && !oldVal.includes('intermission') && newVal.includes('intermission')) {
		fadeIn();
	}

	// Start music
	else if (oldVal && oldVal.includes('intermission') && !newVal.includes('intermission')) {
		fadeOut();
	}
});*/

// Listen for NodeCG messages from dashboard/layouts.
nodecg.listenFor('pausePlaySong', () => {
	if (songData.value.playing)
		fadeOut();
	else
		fadeIn();
});
nodecg.listenFor('skipSong', skipSong);

async function onReady() {
	connected = true;
	var playList = await client.currentPlaylist.playlistInfo();
	if (playList.length <= 0) {
		nodecg.log.info('Doing initial MPD configuration.');
		await client.currentPlaylist.add("/");
		await client.playbackOptions.setRepeat(true);
		await shufflePlaylist();
		await client.playback.play();
	}
	// Always set volume on connection just in case, but we need to wait a little for some reason (probably for playback to commence).
	setTimeout(setVolume, 2000);

	// Shuffle the playlist every 6 hours.
	// (We're only playing music in intermissions; doesn't need to be frequent).
	clearInterval(shuffleInterval);
	shuffleInterval = setInterval(shufflePlaylist, 21600000);

	await updatePlaybackStatusAndSong();
}

function onEnd() {
	connected = false;
	nodecg.log.warn('MPD connection lost, retrying in 5 seconds.');
	setTimeout(connect, 5000);
}

function onError(err: MPDError) {
	nodecg.log.warn('MPD connection error.', err);
	nodecg.log.debug('MPD connection error:', err);
}

// Update stuff when the player status changes.
async function onSystemPlayer() {
	await updatePlaybackStatusAndSong();
}

// Used to update the replicant to say if there is a song playing or not
// also updates the title
async function updatePlaybackStatusAndSong() {
	const status = await client.status.status();
	if (status.state !== 'play') {
		songData.value.playing = false;
		songData.value.title = 'No Track Playing';
	} else {
		songData.value.playing = true;
		const currentSong = await client.status.currentSong();
		var songTitle = currentSong.title+' - '+currentSong.artist;
		if (songTitle !== songData.value.title) {
			songData.value.title = songTitle;
		}
	}
}

// Can be used to skip to the next song.
async function skipSong() {
	client.playback.next();
}

// Used to shuffle the currently playing list *correctly*.
// Actual shuffle is the same *every time* so let's add some randomness here!
async function shufflePlaylist() {
	var random = Math.floor(Math.random()*Math.floor(20));
	for (var i = 0; i < random; i++)
		await client.currentPlaylist.shuffle();
}

// Used to set the player volume to whatever the variable is set to.
async function setVolume() {
	await client.playbackOptions.setVolume(currentVolume);
}

// Used to fade out and pause the song.
async function fadeOut() {
	if (!connected) return;

	clearInterval(fadeInterval);
	currentVolume = volume;
	await setVolume();

	async function loop() {
		currentVolume--;
		await setVolume();
		if (currentVolume <= 0) {
			clearInterval(fadeInterval);
			client.playback.pause(true);
		}
	}

	fadeInterval = setInterval(loop, 200);
}

// Used to unpause and fade in the song.
async function fadeIn() {
	if (!connected) return;

	clearInterval(fadeInterval);
	currentVolume = 0;
	await client.playback.pause(false);
	await setVolume();

	async function loop() {
		currentVolume++;
		await setVolume();
		if (currentVolume >= volume) {
			clearInterval(fadeInterval);
		}
	}

	fadeInterval = setInterval(loop, 200);
}