// npm run check-bot [-- <message id>]
//
// Checks the full-size photo setup end to end: the bot token, access to the channel and the scratch
// chat, and one photo fetched at Telegram's largest size. Reads the same variables as the sync, e.g.
//   TELEGRAM_BOT_TOKEN=… TELEGRAM_DUMP_CHAT_ID=-100… npm run check-bot
// Without a message id it uses the first photo of the newest synced post.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import config from '../kello.config';
import { TelegramBot } from './sync/bot';
import type { PostFile } from './sync/types';

const { tokenEnv, dumpChatEnv } = config.channel.bot;
const token = process.env[tokenEnv];
const dumpChat = process.env[dumpChatEnv];
if (!token || !dumpChat) {
	console.error(`Set ${tokenEnv} and ${dumpChatEnv} first.`);
	process.exit(1);
}

function newestPhoto() {
	const dir = path.resolve('src/data/posts');
	const posts = fs
		.readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as PostFile)
		.sort((a, b) => b.date.localeCompare(a.date));
	for (const post of posts) {
		const image = post.media.find((m) => m.type === 'image');
		if (image?.messageId) return { messageId: image.messageId, width: image.width };
	}
	return undefined;
}

const problems: string[] = [];
const bot = new TelegramBot(token, config.channel.username, dumpChat, (msg) => problems.push(msg));

try {
	console.log(`Bot @${await bot.check()} can see @${config.channel.username} and the scratch chat.`);
} catch (err) {
	console.error(`Setup problem: ${(err as Error).message}`);
	console.error('Check that the bot is an admin of both the channel and the scratch chat, and that the chat id starts with -100.');
	process.exit(1);
}

const arg = Number(process.argv[2]);
const target = arg ? { messageId: arg, width: undefined } : newestPhoto();
if (!target) {
	console.error('No synced photo to try; pass a message id.');
	process.exit(1);
}

const photo = await bot.photo(target.messageId);
if (!photo) {
	console.error(`Couldn't fetch message ${target.messageId}. ${problems.join(' ')}`);
	process.exit(1);
}
const { width, height } = await sharp(photo).metadata();
console.log(`Message ${target.messageId}: ${width}×${height}, ${Math.round(photo.length / 1024)} KB` + (target.width ? ` (the site has ${target.width}px today)` : ''));
if (problems.length) console.warn(problems.join('\n'));
