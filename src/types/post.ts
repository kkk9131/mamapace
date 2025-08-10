export interface Post {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface ReactionSummary {
  count: number;
  reactedByMe: boolean;
}

export interface CommentSummary {
  count: number;
}

export interface PostWithMeta extends Post {
  reaction_summary: ReactionSummary;
  comment_summary: CommentSummary;
  user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_emoji: string | null;
  } | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_emoji: string | null;
  } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null; // ISO timestamp or null
}
