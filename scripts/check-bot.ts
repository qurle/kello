// npm run check-bot [-- <message id>]
// Checks the bot end to end: token, access to both chats, and one photo at its largest size.
// Without a message id it takes the first photo of the newest synced post.
import './sync/env';
import sharp from 'sharp';
import config from '../kello.config';
import { TelegramBot } from './sync/bot';
import { readPosts } from './sync/store';

const { tokenEnv, dumpChatEnv } = config.channel.bot;
const token = process.env[tokenEnv];
const dumpChat = process.env[dumpChatEnv];
if (!token || !dumpChat) {
	console.error(`Set ${tokenEnv} and ${dumpChatEnv} first.`);
	process.exit(1);
}

async function newestPhoto() {
	const posts = [...(await readPosts()).values()].sort((a, b) => b.date.localeCompare(a.date));
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
const target = arg ? { messageId: arg, width: undefined } : await newestPhoto();
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
