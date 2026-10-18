export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RetryOptions {
	attempts: number;
	/** Wait before the retry after attempt number `attempt`. */
	delay: (attempt: number) => number;
	/** Covers the whole exchange, body included. */
	timeoutMs: number;
}

/** Fetches, retrying network errors, timeouts, 429 and 5xx. Other statuses throw at once. */
export async function fetchRetry(url: string, init: RequestInit, { attempts, delay, timeoutMs }: RetryOptions) {
	for (let attempt = 1; ; attempt++) {
		let status: number | undefined;
		let reason: string;
		try {
			const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
			if (res.ok) return res;
			await res.body?.cancel();
			status = res.status;
			reason = `HTTP ${status}`;
		} catch (err) {
			reason = (err as Error).name === 'TimeoutError' ? 'timed out' : (err as Error).message;
		}
		const retryable = status === undefined || status === 429 || status >= 500;
		if (!retryable || attempt >= attempts) throw new Error(reason);
		await sleep(delay(attempt));
	}
}
