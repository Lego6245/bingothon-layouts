'use strict';

// Packages
import * as RequestPromise from 'request-promise';
import WebSocket from 'ws';
import * as cheerio from 'cheerio';
import equal = require('deep-equal');

// Ours
import * as nodecgApiContext from './util/nodecg-api-context';
import { BingoboardMeta, Bingoboard, BingosyncSocket } from "../../schemas";

const SOCKET_KEY_REGEX = /temporarySocketKey\s+=\s+"(\S+)"/;

const nodecg = nodecgApiContext.get();
const log = new nodecg.Logger(`${nodecg.bundleName}:bingosync`);
const request = RequestPromise.defaults({jar: true}); // <= Automatically saves and re-uses cookies.
const boardRep = nodecg.Replicant<Bingoboard>('bingoboard');
const boardMetaRep = nodecg.Replicant<BingoboardMeta>('bingoboardMeta');
const socketRep = nodecg.Replicant<BingosyncSocket>('bingosyncSocket');
let fullUpdateInterval: NodeJS.Timer;
let websocket: WebSocket | null = null;

const noop = () => {}; // tslint:disable-line:no-empty
const socketUrl = "wss://sockets.bingosync.com";
const siteUrl = "https://bingosync.com"

nodecg.listenFor('bingosync:joinRoom', async (data, callback) => {
	try {
		socketRep.value = {
			...socketRep.value,
			...data
		};
		await joinRoom(
			data.roomCode,
			data.passphrase
		);
        log.info(`Successfully joined room ${data.roomCode}.`);
        if (callback && !callback.handled) {
            callback(null);
        }
	} catch (error) {
		socketRep.value.status = 'error';
        log.error(`Failed to join room ${data.roomCode}:`, error);
        if (callback && !callback.handled) {
            callback(error);
        }
	}
});

nodecg.listenFor('bingosync:leaveRoom', (_data, callback) => {
	try {
		clearInterval(fullUpdateInterval);
		destroyWebsocket();
		socketRep.value.status = 'disconnected';
        if (callback && !callback.handled) {
            callback(null);
        }
	} catch (error) {
		log.error('Failed to leave room:', error);
        if (callback && !callback.handled) {
            callback(error);
        }
	}
});

/*nodecg.listenFor('bingosync:selectLine', (lineString: string, callback) => {
	try {
		boardRep.value.selectedLine = lineString;
        if (callback && !callback.handled) {
            callback(null);
        }
	} catch (error) {
        if (callback && !callback.handled) {
            callback(error);
        }
	}
});*/

/*nodecg.listenFor('bingosync:toggleLineFocus', (_data: string, callback: Function) => {
	callback = callback || noop; // tslint:disable-line:no-parameter-reassignment
	try {
		boardRep.value.lineFocused = !boardRep.value.lineFocused;
		callback();
	} catch (error) {
		callback(error);
	}
});*/

nodecg.listenFor('bingosync:toggleCard', (_data, callback) => {
	try {
		boardMetaRep.value.boardHidden = !boardMetaRep.value.boardHidden;
        if (callback && !callback.handled) {
            callback(null);
        }
	} catch (error) {
        if (callback && !callback.handled) {
            callback(error);
        }
	}
});

/*nodecg.listenFor('bingosync:toggleEmbiggen', (_data, callback) => {
	try {
		boardRep.value.embiggen = !boardRep.value.embiggen;
        if (callback && !callback.handled) {
            callback();
        }
	} catch (error) {
        if (callback && !callback.handled) {
            callback(error);
        }
	}
});*/

recover().catch(error => {
	log.error(`Failed to recover connection to room ${socketRep.value.roomCode}:`, error);
});
async function recover() {
    // catch startup errors when this is all empty
    if (!socketRep.value || !socketRep.value.roomCode || !socketRep.value.passphrase) {
        if (!socketRep.value) {
            socketRep.value = {status: "disconnected"};
            return;
        }
        socketRep.value.status = "disconnected";
    }
    // Restore previous connection on startup
    const roomCode = socketRep.value.roomCode;
    const passphrase = socketRep.value.passphrase;
	if (roomCode && passphrase) {
		log.info(`Recovering connection to room ${socketRep.value.roomCode}`);
		await joinRoom(roomCode, passphrase);
		log.info(`Successfully recovered connection to room ${socketRep.value.roomCode}`);
	}
}

async function joinRoom(roomCode: string, passphrase: string) {
	socketRep.value.status = 'connecting';
	clearInterval(fullUpdateInterval);
	destroyWebsocket();

	log.info('Attempting to load room page.');
	const roomUrl = `${siteUrl}/room/${roomCode}`;
	let $ = await request.get({
		uri: roomUrl,
		transform(body) {
			return cheerio.load(body);
		}
	});

	// If input[name="csrfmiddlewaretoken"] exists on the page, then we must be on the "Join Room" form.
	// Else, we must be in the actual game room.
	const csrfTokenInput = $('input[name="csrfmiddlewaretoken"]');
	if (csrfTokenInput) {
		log.info('Joining room...');

		// POST to join the room.
		await request.post({
			uri: roomUrl,
			form: {
				room_name: $('input[name="room_name"]').val(),
				encoded_room_uuid: $('input[name="encoded_room_uuid"]').val(),
				creator_name: $('input[name="creator_name"]').val(),
				game_name: $('input[name="game_name"]').val(),
                player_name: "bingothon",
                is_spectator: "on",
				passphrase,
				csrfmiddlewaretoken: csrfTokenInput.val()
			},
			headers: {
				Referer: roomUrl
			},
			resolveWithFullResponse: true,
			simple: false
		});

		log.info('Joined room.');
		log.info('Loading room page...');

		// Request the room page again, so that we can extract the socket token from it.
		$ = await request.get({
			uri: roomUrl,
			transform(body) {
				return cheerio.load(body);
			}
		});
	}

	log.info('Loaded room page.');

	// Socket stuff
	const matches = $.html().match(SOCKET_KEY_REGEX);
	if (!matches) {
		log.error('Socket key not found on page.');
		return;
	}

	const socketKey = matches[1];
	if (!socketKey) {
		log.error('Socket key not found on page.');
		return;
	}

	const thisInterval = setInterval(() => {
		fullUpdate().catch(error => {
			log.error('Failed to fullUpdate:', error);
		});
	}, 15 * 1000);
	fullUpdateInterval = thisInterval;

	await fullUpdate();
	await createWebsocket(socketUrl, socketKey);

	async function fullUpdate() {
		const newBoardState = await request.get({
			uri: `${roomUrl}/board`,
			json: true
		});

		// Bail if the room changed while this request was in-flight.
		if (fullUpdateInterval !== thisInterval) {
			return;
		}

		// Bail if nothing has changed.
		if (equal(boardRep.value, newBoardState)) {
			return;
		}

        boardRep.value = newBoardState;
	}
}

function createWebsocket(socketUrl: string, socketKey: string) {
	return new Promise((resolve, reject) => {
		let settled = false;

		log.info('Opening socket...');
		socketRep.value.status = 'connecting';
		websocket = new WebSocket(`${socketUrl}/broadcast`);

		websocket.onopen = () => {
			log.info('Socket opened.');
			if (websocket) {
				websocket.send(JSON.stringify({socket_key: socketKey}));
			}
		};

		websocket.onmessage = (event: {data: WebSocket.Data; type: string; target: WebSocket}) => {
			let json;
			try {
				json = JSON.parse(event.data as string);
			} catch (error) { // tslint:disable-line:no-unused
				log.error('Failed to parse message:', event.data);
			}

			if (json.type === 'error') {
				clearInterval(fullUpdateInterval);
				destroyWebsocket();
				socketRep.value.status = 'error';
				log.error('Socket protocol error:', json.error ? json.error : json);
				if (!settled) {
					reject(new Error(json.error ? json.error : 'unknown error'));
					settled = true;
				}
				return;
			}

			if (!settled) {
				resolve();
				socketRep.value.status = 'connected';
				settled = true;
			}

			if (json.type === 'goal') {
				const index = parseInt(json.square.slot.slice(4), 10) - 1;
				boardRep.value[index] = json.square;
			}
		};

		websocket.onclose = (event: {wasClean: boolean; code: number; reason: string; target: WebSocket}) => {
			socketRep.value.status = 'disconnected';
			log.info(`Socket closed (code: ${event.code}, reason: ${event.reason})`);
			destroyWebsocket();
			createWebsocket(socketUrl, socketKey).catch(() => {
				// Intentionally discard errors raised here.
				// They will have already been logged in the onmessage handler.
			});
		};
	});
}

function destroyWebsocket() {
	if (!websocket) {
		return;
	}

	try {
		websocket.onopen = noop;
		websocket.onmessage = noop;
		websocket.onclose = noop;
		websocket.close();
	} catch (_error) { // tslint:disable-line:no-unused
		// Intentionally discard error.
	}

	websocket = null;
}