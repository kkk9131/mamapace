import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';
import { PostWithMeta } from '../types/post';

export default function PostCard({
  post,
  onOpenComments,
  onToggleLike,
  commentDelta = 0,
  reactionDelta = 0,
  isOwner = false,
  onDelete
}: {
  post: PostWithMeta;
  onOpenComments?: (postId: string) => void;
  onToggleLike?: (postId: string, current: boolean) => void;
  commentDelta?: number;
  reactionDelta?: number;
  isOwner?: boolean;
  onDelete?: (postId: string) => void;
}) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const likeScale = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const commentScale = useRef(new Animated.Value(1)).current;

  const likeCount = Math.max(0, (post.reaction_summary.count || 0) + (reactionDelta || 0));
  const commentCount = Math.max(0, (post.comment_summary.count || 0) + (commentDelta || 0));
  const likeText = useMemo(() => (likeCount > 0 ? `${likeCount}` : ''), [likeCount]);
  const commentText = useMemo(() => (commentCount > 0 ? `${commentCount}` : ''), [commentCount]);

  const [likeBusy, setLikeBusy] = React.useState(false as boolean);
  const handleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 0.9, useNativeDriver: true, speed: 16, bounciness: 8 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
    ]).start();
    float.setValue(0);
    Animated.timing(float, { toValue: -14, duration: 450, useNativeDriver: true }).start();
    onToggleLike && onToggleLike(post.id, post.reaction_summary.reactedByMe);
    setLikeBusy(false);
  };

  const [expanded, setExpanded] = React.useState(false);
  const MAX_LINES = 4;
  const isLong = (post.body || '').length > 120; // heuristic

  return (
    <View style={{ borderRadius: 24, overflow: 'hidden', ...theme.shadow.card }}>
      <BlurView intensity={40} tint="dark" style={{ padding: theme.spacing(2), backgroundColor: '#ffffff0E' }}>
        <Text style={{ color: colors.text, fontSize: 18, marginBottom: 8 }} numberOfLines={expanded ? undefined : MAX_LINES}>
          {post.body}
        </Text>
        {isLong && (
          <Pressable accessibilityRole="button" accessibilityLabel={expanded? '本文を閉じる':'本文をもっと見る'} onPress={() => setExpanded(v => !v)} style={({ pressed }) => [{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surface, transform: [{ scale: pressed ? 0.98 : 1 }] }]}> 
            <Text style={{ color: colors.pink, fontWeight: '700' }}>{expanded ? '閉じる' : 'もっと見る'}</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.subtext }}>{post.user?.display_name || post.user?.username || '匿名'} ・ {new Date(post.created_at).toLocaleString()}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isOwner && (
              <Pressable accessibilityRole="button" accessibilityLabel="投稿を削除" onPress={() => onDelete && onDelete(post.id)} style={({ pressed }) => [{ backgroundColor: colors.surface, paddingHorizontal: theme.spacing(1), paddingVertical: 6, borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
                <Text style={{ color: colors.pink, fontWeight: '700' }}>🗑</Text>
              </Pressable>
            )}
            <Pressable disabled={likeBusy} onPress={handleLike} accessibilityRole="button" accessibilityLabel="共感" style={({ pressed }) => [{ backgroundColor: colors.surface, paddingHorizontal: theme.spacing(1.25), paddingVertical: 6, borderRadius: 999, overflow: 'visible', opacity: likeBusy?0.6:1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
              <Animated.Text style={{ transform: [{ scale: likeScale }], color: colors.pink, fontWeight: '700' }}>{post.reaction_summary.reactedByMe ? '💗' : '🤍'}</Animated.Text>
              {likeText ? <Text style={{ color: colors.pink, marginLeft: 6 }}>{likeText}</Text> : null}
              <Animated.Text style={{ position: 'absolute', top: -6, right: -6, color: colors.pink, opacity: 0.9, transform: [{ translateY: float }] }}>+1</Animated.Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="コメント" onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Animated.sequence([
                Animated.spring(commentScale, { toValue: 0.9, useNativeDriver: true, speed: 16, bounciness: 8 }),
                Animated.spring(commentScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
              ]).start();
              onOpenComments && onOpenComments(post.id);
            }} style={({ pressed }) => [{ backgroundColor: colors.surface, paddingHorizontal: theme.spacing(1.25), paddingVertical: 6, borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
              <Animated.Text style={{ transform: [{ scale: commentScale }], color: colors.pink, fontWeight: '700' }}>💬</Animated.Text>
              {commentText ? <Text style={{ color: colors.pink, marginLeft: 6 }}>{commentText}</Text> : null}
            </Pressable>
          </View>
        </View>
      </BlurView>
    </View>
  );
}
