import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Image, Modal, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/theme';
import { useHandPreference } from '../contexts/HandPreferenceContext';
import { PostWithMeta } from '../types/post';

import ExpandableText from './ExpandableText';
import VerifiedBadge from './VerifiedBadge';
import { submitReport } from '../services/reportService';
import { blockUser } from '../services/blockService';
import { REPORT_REASONS } from '../utils/reportReasons';
import { notifyError, notifyInfo } from '../utils/notify';

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
  const theme = useTheme();
  const { colors } = theme;
  const { handPreference } = useHandPreference();
  const likeScale = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const commentScale = useRef(new Animated.Value(1)).current;
  const handleMenuPress = () => {
    if (isOwner) return;
    Alert.alert('操作を選択', undefined, [
      {
        text: '通報する',
        onPress: () => {
          Alert.alert(
            '通報理由を選択',
            undefined,
            [
              ...REPORT_REASONS.map(r => ({
                text: r.label,
                onPress: async () => {
                  try {
                    await submitReport({
                      targetType: 'post',
                      targetId: post.id,
                      reasonCode: r.code,
                    });
                    notifyInfo('通報を受け付けました');
                  } catch (e: any) {
                    notifyError('通報に失敗しました');
                  }
                },
              })),
              { text: 'キャンセル', style: 'cancel' },
            ],
          );
        },
      },
      {
        text: 'ユーザーをブロック',
        style: 'destructive',
        onPress: () => {
          Alert.alert('確認', 'このユーザーをブロックしますか？', [
            { text: 'キャンセル', style: 'cancel' },
            {
              text: 'ブロック',
              style: 'destructive',
              onPress: async () => {
                try {
                  await blockUser(post.user_id);
                  notifyInfo('ユーザーをブロックしました');
                } catch (e: any) {
                  notifyError('ブロックに失敗しました');
                }
              },
            },
          ]);
        },
      },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const baseReaction = post.reaction_summary || {
    reactedByMe: false,
    count: 0,
  };
  const baseComment = post.comment_summary || { count: 0 };
  const likeCount = Math.max(
    0,
    (baseReaction.count || 0) + (reactionDelta || 0),
  );
  const commentCount = Math.max(
    0,
    (baseComment.count || 0) + (commentDelta || 0),
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
  const [viewer, setViewer] = useState<{ visible: boolean; index: number }>({
    visible: false,
    index: 0,
  });
  const handleLike = async () => {
    if (likeBusy) {
      return;
    }
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
    onToggleLike && onToggleLike(post.id, baseReaction.reactedByMe);
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
        {/* TOP SECTION: Avatar + Username and Time + Menu */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing(1.5),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {/* Avatar: image優先、なければemoji */}
            {post.user?.avatar_url ? (
              <Image
                source={{ uri: post.user.avatar_url }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  marginRight: 8,
                }}
              />
            ) : (
              <Text
                style={{ fontSize: 18, marginRight: 8 }}
                accessibilityLabel="ユーザーアイコン"
              >
                {post.user?.avatar_emoji || '👤'}
              </Text>
            )}

            {/* Username */}
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
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
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
                {post.user?.maternal_verified && <VerifiedBadge size={16} />}
              </View>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                color: colors.subtext,
                fontSize: 14,
              }}
            >
              {new Date(post.created_at).toLocaleString()}
            </Text>
            {!isOwner && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="その他の操作"
                onPress={handleMenuPress}
                style={({ pressed }) => ({
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: pressed ? '#ffffff20' : colors.surface,
                })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>⋯</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* CONTENT SECTION: Post Body (hide placeholder when attachments-only) */}
        {post.body && post.body !== '[image]' && (
          <ExpandableText
            text={post.body}
            maxLines={3}
            containerStyle={{ marginBottom: theme.spacing(2) }}
            textStyle={{ color: colors.text, fontSize: 16, lineHeight: 24 }}
          />
        )}

        {/* Attachments thumbnails */}
        {Array.isArray(post.attachments) && post.attachments.length > 0 && (
          <View style={{ marginBottom: theme.spacing(1.5) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {post.attachments.slice(0, 4).map((att, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => setViewer({ visible: true, index: idx })}
                  style={{
                    width: '48%',
                    aspectRatio: 1,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: '#ffffff12',
                  }}
                >
                  {att.url ? (
                    <Image
                      source={{ uri: att.url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: colors.subtext }}>画像</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* BOTTOM ACTION BAR: Like, Comment, Delete */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Like and Comment buttons - positioned based on hand preference */}
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing(2),
              ...(handPreference === 'right' && {
                marginLeft: 'auto',
                marginRight: isOwner ? theme.spacing(2) : 0,
              }),
            }}
          >
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
                  paddingVertical: 8,
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
                  paddingVertical: 8,
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

          {/* Right side: Delete button (only when owner AND handler provided) */}
          {isOwner && !!onDelete && (
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
                  paddingVertical: 8,
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

      {/* Simple viewer */}
      <Modal
        visible={viewer.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer({ visible: false, index: 0 })}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: '#000000CC',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => setViewer({ visible: false, index: 0 })}
        >
          {post.attachments?.[viewer.index]?.url ? (
            <Image
              source={{ uri: post.attachments[viewer.index].url }}
              style={{ width: '90%', height: '70%', resizeMode: 'contain' }}
            />
          ) : null}
        </Pressable>
      </Modal>

      {/* メニューはボタンハンドラーでAlertを発火 */}
    </View>
  );
}
