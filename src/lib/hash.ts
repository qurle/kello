/** Integer hash (murmur3 finaliser): spreads consecutive ids apart. */
export const hash = (n: number) => {
	let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	return (h ^ (h >>> 16)) >>> 0;
};
