import { getPosts, type Post } from './posts';

export type { Post };

/** All visible posts, newest first. */
export const getFeed = (): Promise<Post[]> => getPosts();
