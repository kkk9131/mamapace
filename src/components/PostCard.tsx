import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/theme';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { PostWithMeta } from '../types/post';
import ExpandableText from './ExpandableText';

export default function PostCard({
  post,
  onOpenComments,
  onOpenUser,
  onToggleLike,
  commentDelta = 0,
  reactionDelta = 0,
  isOwner = false,
  onDelete,
}: {
  post: PostWithMeta;
  onOpenComments?: (postId: string) => void;
  onOpenUser?: (userId: string) => void;
  onToggleLike?: (postId: string, current: boolean) => void;
  commentDelta?: number;
  reactionDelta?: number;
  isOwner?: boolean;
  onDelete?: (postId: string) => void;
}) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const { handPreference } = useHandPreference();
  const likeScale = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const commentScale = useRef(new Animated.Value(1)).current;

  const likeCount = Math.max(
    0,
    (post.reaction_summary.count || 0) + (reactionDelta || 0)
  );
  const commentCount = Math.max(
    0,
    (post.comment_summary.count || 0) + (commentDelta || 0)
  );
  const likeText = useMemo(
    () => (likeCount > 0 ? `${likeCount}` : ''),
    [likeCount]
  );
  const commentText = useMemo(
    () => (commentCount > 0 ? `${commentCount}` : ''),
    [commentCount]
  );

  const [likeBusy, setLikeBusy] = React.useState(false as boolean);
  const handleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 0.9,
        useNativeDriver: true,
        speed: 16,
        bounciness: 8,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 8,
      }),
    ]).start();
    float.setValue(0);
    Animated.timing(float, {
      toValue: -14,
      duration: 450,
      useNativeDriver: true,
    }).start();
    onToggleLike && onToggleLike(post.id, post.reaction_summary.reactedByMe);
    setLikeBusy(false);
  };

  return (
    <View
      style={{ borderRadius: 24, overflow: 'hidden', ...theme.shadow.card }}
    >
      <BlurView
        intensity={40}
        tint="dark"
        style={{ padding: theme.spacing(2), backgroundColor: '#ffffff0E' }}
      >
        {/* TOP SECTION: Username and Time */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing(1.5),
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ユーザープロフィールを開く"
            onPress={e => {
              e.stopPropagation();
              onOpenUser && onOpenUser(post.user_id);
            }}
            style={{ flex: 1 }}
            hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 16,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {post.user?.display_name || post.user?.username || '匿名'}
            </Text>
          </Pressable>
          <Text
            style={{
              color: colors.subtext,
              fontSize: 14,
              marginLeft: theme.spacing(1),
            }}
          >
            {new Date(post.created_at).toLocaleString()}
          </Text>
        </View>

        {/* CONTENT SECTION: Post Body */}
        <ExpandableText
          text={post.body || ''}
          maxLines={3}
          containerStyle={{ marginBottom: theme.spacing(2) }}
          textStyle={{ color: colors.text, fontSize: 16, lineHeight: 24 }}
        />

        {/* BOTTOM ACTION BAR: Like, Comment, Delete */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Like and Comment buttons - positioned based on hand preference */}
          <View style={{ 
            flexDirection: 'row', 
            gap: theme.spacing(2),
            ...(handPreference === 'right' && { marginLeft: 'auto', marginRight: isOwner ? theme.spacing(2) : 0 })
          }}>
            {/* Like Button */}
            <Pressable
              disabled={likeBusy}
              onPress={e => {
                e.stopPropagation();
                handleLike();
              }}
              accessibilityRole="button"
              accessibilityLabel="共感"
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  paddingHorizontal: theme.spacing(1.25),
                  paddingVertical: 6,
                  borderRadius: 999,
                  overflow: 'visible',
                  opacity: likeBusy ? 0.6 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.Text
                style={{
                  transform: [{ scale: likeScale }],
                  color: colors.pink,
                  fontWeight: '700',
                }}
              >
                {post.reaction_summary.reactedByMe ? '💗' : '🤍'}
              </Animated.Text>
              {likeText ? (
                <Text style={{ color: colors.pink, marginLeft: 6 }}>
                  {likeText}
                </Text>
              ) : null}
              <Animated.Text
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  color: colors.pink,
                  opacity: 0.9,
                  transform: [{ translateY: float }],
                }}
              >
                +1
              </Animated.Text>
            </Pressable>

            {/* Comment Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="コメント"
              onPress={async e => {
                e.stopPropagation();
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Animated.sequence([
                  Animated.spring(commentScale, {
                    toValue: 0.9,
                    useNativeDriver: true,
                    speed: 16,
                    bounciness: 8,
                  }),
                  Animated.spring(commentScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    speed: 16,
                    bounciness: 8,
                  }),
                ]).start();
                onOpenComments && onOpenComments(post.id);
              }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  paddingHorizontal: theme.spacing(1.25),
                  paddingVertical: 6,
                  borderRadius: 999,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.Text
                style={{
                  transform: [{ scale: commentScale }],
                  color: colors.pink,
                  fontWeight: '700',
                }}
              >
                💬
              </Animated.Text>
              {commentText ? (
                <Text style={{ color: colors.pink, marginLeft: 6 }}>
                  {commentText}
                </Text>
              ) : null}
            </Pressable>
          </View>

          {/* Right side: Delete button (only for own posts) */}
          {isOwner && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="投稿を削除"
              onPress={e => {
                e.stopPropagation();
                onDelete && onDelete(post.id);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  paddingHorizontal: theme.spacing(1),
                  paddingVertical: 6,
                  borderRadius: 999,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ color: colors.pink, fontWeight: '700' }}>🗑</Text>
            </Pressable>
          )}
        </View>
      </BlurView>
    </View>
  );
}
