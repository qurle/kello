import { spawn, spawnSync } from 'node:child_process';

/** Display size from the first track's `tkhd` box. */
export function mp4Size(buf: Buffer): { width: number; height: number } | undefined {
	const walk = (start: number, end: number): { width: number; height: number } | undefined => {
		let pos = start;
		while (pos + 8 <= end) {
			let size = buf.readUInt32BE(pos);
			const type = buf.toString('latin1', pos + 4, pos + 8);
			let header = 8;
			if (size === 1) {
				size = Number(buf.readBigUInt64BE(pos + 8));
				header = 16;
			} else if (size === 0) {
				size = end - pos;
			}
			if (size < header || pos + size > end) return undefined;
			if (type === 'moov' || type === 'trak') {
				const found = walk(pos + header, pos + size);
				if (found) return found;
			} else if (type === 'tkhd') {
				const body = pos + header;
				const version = buf.readUInt8(body);
				// Version 1 has 64-bit times: matrix at 52, size at 88; version 0: 40 and 76.
				const matrix = body + (version === 1 ? 52 : 40);
				const dims = body + (version === 1 ? 88 : 76);
				const width = Math.round(buf.readUInt32BE(dims) / 65536);
				const height = Math.round(buf.readUInt32BE(dims + 4) / 65536);
				if (width && height) {
					// A 90° rotation matrix has a = 0: sides swapped.
					const rotated = buf.readInt32BE(matrix) === 0;
					return rotated ? { width: height, height: width } : { width, height };
				}
			}
			pos += size;
		}
		return undefined;
	};
	try {
		return walk(0, buf.length);
	} catch {
		return undefined;
	}
}

let ffmpeg: boolean | undefined;
export const hasFfmpeg = () => (ffmpeg ??= spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0);

/** First frame of a video file as PNG. */
export function firstFrame(file: string): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const proc = spawn('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-']);
		const chunks: Buffer[] = [];
		let stderr = '';
		proc.stdout.on('data', (c: Buffer) => chunks.push(c));
		proc.stderr.on('data', (c: Buffer) => (stderr += c));
		proc.on('error', reject);
		proc.on('close', (code) =>
			code === 0 && chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg: ${stderr.trim() || code}`)),
		);
	});
}
