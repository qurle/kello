// Full-size media through the Bot API. Bots can't read channel history, so each item is forwarded
// into a private scratch chat, downloaded from there and deleted. Setup is in AGENTS.md.
// Every failure is reported and returns undefined, so the sync falls back to the preview's copy.

import { sleep } from './http';

const api = 'https://api.telegram.org';
/** Bot API downloads stop at 20 MB. */
const maxDownload = 20 * 1024 * 1024;
/** Spaced to stay under Telegram's ~20 messages a minute per chat. */
const forwardInterval = 3100;
/** Consecutive failures after which the bot is dropped for the run. */
const maxFailures = 3;


interface FileRef {
	file_id: string;
	file_size?: number;
	width?: number;
	height?: number;
	mime_type?: string;
}

interface Message {
	message_id: number;
	photo?: FileRef[];
	video?: FileRef;
	animation?: FileRef;
	document?: FileRef;
}

/** `counts` is false for errors about one message, which say nothing about the bot's health. */
class BotError extends Error {
	constructor(
		message: string,
		readonly counts = true,
	) {
		super(message);
	}
}

export class TelegramBot {
	private lastForward = 0;
	private failures = 0;
	private disabled = false;
	/** Forwards run one at a time. */
	private queue: Promise<unknown> = Promise.resolve();

	constructor(
		private token: string,
		/** Channel username without `@`. */
		private channel: string,
		private dumpChat: string,
		private warn: (msg: string) => void,
	) {}

	/** Calls a Bot API method, waiting out rate limits. Errors never contain the token. */
	private async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
		for (let attempt = 1; ; attempt++) {
			const res = await fetch(`${api}/bot${this.token}/${method}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(params),
				signal: AbortSignal.timeout(30_000),
			}).catch(() => undefined);
			if (!res) {
				if (attempt >= 3) throw new BotError(`${method}: network error`);
				await sleep(2000 * attempt);
				continue;
			}
			const body = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				result?: T;
				description?: string;
				parameters?: { retry_after?: number; migrate_to_chat_id?: number };
			};
			if (body.ok) return body.result as T;
			// A group upgraded to a supergroup gets a new id.
			const moved = body.parameters?.migrate_to_chat_id;
			if (moved && String(params.chat_id) === this.dumpChat && attempt < 5) {
				this.dumpChat = String(moved);
				params = { ...params, chat_id: this.dumpChat };
				this.warn(`Telegram bot: the scratch chat became a supergroup with id ${moved}; using it for this run. Update the dump chat id secret to ${moved}.`);
				continue;
			}
			const wait = body.parameters?.retry_after;
			if (res.status === 429 && wait && attempt < 5) {
				this.warn(`Telegram bot: rate limited, waiting ${wait}s`);
				await sleep((wait + 1) * 1000);
				continue;
			}
			if (res.status >= 500 && attempt < 3) {
				await sleep(2000 * attempt);
				continue;
			}
			throw new BotError(`${method}: ${body.description ?? `HTTP ${res.status}`}`, res.status !== 400);
		}
	}

	private async download(ref: FileRef): Promise<Buffer | undefined> {
		if (ref.file_size && ref.file_size > maxDownload) return undefined;
		const file = await this.call<{ file_path?: string }>('getFile', { file_id: ref.file_id });
		if (!file.file_path) return undefined;
		const res = await fetch(`${api}/file/bot${this.token}/${file.file_path}`, { signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
		if (!res?.ok) throw new BotError(`download: ${res ? `HTTP ${res.status}` : 'network error'}`);
		return Buffer.from(await res.arrayBuffer());
	}

	/** Forwards a message into the scratch chat, passes it to `use`, then deletes the forward. */
	private withForward<T>(messageId: number, use: (message: Message) => Promise<T | undefined>): Promise<T | undefined> {
		const run = this.queue.then(() => this.forwardOnce(messageId, use));
		this.queue = run.catch(() => undefined);
		return run;
	}

	private async forwardOnce<T>(messageId: number, use: (message: Message) => Promise<T | undefined>): Promise<T | undefined> {
		if (this.disabled) return undefined;
		try {
			await sleep(Math.max(0, this.lastForward + forwardInterval - Date.now()));
			this.lastForward = Date.now();
			const message = await this.call<Message>('forwardMessage', {
				chat_id: this.dumpChat,
				from_chat_id: `@${this.channel}`,
				message_id: messageId,
				disable_notification: true,
			});
			try {
				const result = await use(message);
				this.failures = 0;
				return result;
			} finally {
				await this.call('deleteMessage', { chat_id: this.dumpChat, message_id: message.message_id }).catch((err) =>
					this.warn(`Telegram bot: couldn't delete forward of ${messageId}: ${(err as Error).message}`),
				);
			}
		} catch (err) {
			this.warn(`Telegram bot: message ${messageId}: ${(err as Error).message}`);
			if (!(err instanceof BotError && !err.counts) && ++this.failures >= maxFailures) {
				this.disabled = true;
				this.warn(`Telegram bot: ${maxFailures} failures in a row, using the web preview for the rest of this run`);
			}
			return undefined;
		}
	}

	/** The largest copy of a photo. */
	photo(messageId: number): Promise<Buffer | undefined> {
		return this.withForward(messageId, async (message) => {
			const largest = message.photo?.at(-1);
			if (largest) return this.download(largest);
			// A photo sent as a file keeps its original size.
			if (message.document?.mime_type?.startsWith('image/')) return this.download(message.document);
			return undefined;
		});
	}

	/** A video's file, if under 20 MB and `maxBytes`. */
	video(messageId: number, maxBytes: number): Promise<Buffer | undefined> {
		return this.withForward(messageId, async (message) => {
			const ref = message.video ?? message.animation ?? (message.document?.mime_type?.startsWith('video/') ? message.document : undefined);
			if (!ref || (ref.file_size ?? 0) > maxBytes) return undefined;
			return this.download(ref);
		});
	}

	/** Checks the token and access to both chats; returns the bot's username. */
	async check(): Promise<string> {
		const me = await this.call<{ username: string }>('getMe', {});
		await this.call('getChat', { chat_id: `@${this.channel}` });
		await this.call('getChat', { chat_id: this.dumpChat });
		return me.username;
	}
}
