import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  Text,
  View,
  AccessibilityInfo,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../theme/theme';
import {
  toggleAnonReaction,
  addAnonComment,
  getAnonMessageMeta,
  getAnonComments,
  AnonComment,
} from '../../services/anonV2Service';
import { getSupabaseClient } from '../../services/supabaseClient';

import Bubble from './Bubble';

const withAlpha = (hex: string, alpha: number) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) {
    return hex;
  }
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
};

type Post = {
  id: string;
  title: string;
  body: string;
  created_at?: string;
  expires_at?: string;
};

type BubbleFieldPost = {
  id: string;
  title: string;
  body: string;
  created_at?: string;
  expires_at?: string;
};

export default function BubbleField({ posts }: { posts: BubbleFieldPost[] }) {
  const { width, height } = Dimensions.get('window');
  const { colors } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const scrollOffset = useRef(new Animated.Value(0)).current; // スクロールオフセット（アニメ）
  const draggingRef = useRef(false);
  const [reactionState, setReactionState] = useState<
    Record<string, { reacted: boolean; count: number }>
  >({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>(
    {}
  );
  const [celebrate, setCelebrate] = useState<{
    postId: string | null;
    tick: number;
    bubbleKey: string | null;
  }>({ postId: null, tick: 0, bubbleKey: null });
  const [expiresAt, setExpiresAt] = useState<Record<string, number>>({}); // postごとの期限（ms）
  const [expired, setExpired] = useState<Record<string, boolean>>({});
  const [expireAnim, setExpireAnim] = useState<{
    postId: string | null;
    tick: number;
  }>({ postId: null, tick: 0 });
  const [commentDraft, setCommentDraft] = useState<string>('');
  const commentInputRef = useRef<TextInput>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, AnonComment[]>>(
    {}
  );
  const commentsRealtimeRef = useRef<ReturnType<
    ReturnType<typeof getSupabaseClient>['channel']
  > | null>(null);
  const [, setNowTick] = useState(0); // 1秒ごとに再描画用

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion as any
    );
    return () => (sub as any)?.remove?.();
  }, []);

  useEffect(() => {
    // 初期値は0（必要時にメタを取得）
    const r: Record<string, { reacted: boolean; count: number }> = {};
    const c: Record<string, number> = {};
    posts.forEach(p => {
      r[p.id] = { reacted: false, count: 0 };
      c[p.id] = 0;
    });
    setReactionState(r);
    setCommentCounts(c);
  }, [posts]);

  // アクティブポストのメタ（共感/コメント数）とコメント一覧を取得
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activePost) {
        return;
      }
      try {
        const meta = await getAnonMessageMeta(activePost.id);
        if (!meta || cancelled) {
          return;
        }
        setReactionState(prev => ({
          ...prev,
          [activePost.id]: {
            reacted: meta.reacted,
            count: meta.reaction_count,
          },
        }));
        setCommentCounts(prev => ({
          ...prev,
          [activePost.id]: meta.comment_count,
        }));
        const list = await getAnonComments(activePost.id, 100);
        if (!cancelled) {
          setCommentsMap(prev => ({ ...prev, [activePost.id]: list }));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [activePost]);

  // コメントRealtime購読（アクティブポスト単位）
  useEffect(() => {
    // クリーンアップ既存チャンネル
    if (commentsRealtimeRef.current) {
      try {
        getSupabaseClient().removeChannel(commentsRealtimeRef.current);
      } catch {}
      commentsRealtimeRef.current = null;
    }
    if (!activePost) {
      return;
    }

    const channel = getSupabaseClient()
      .channel(`anonymous_comments:${activePost.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_message_comments',
          filter: `message_id=eq.${activePost.id}`,
        },
        payload => {
          const row = payload.new as any;
          const c: AnonComment = {
            id: row.id,
            message_id: row.message_id,
            display_name: row.display_name,
            content: row.content,
            created_at: row.created_at,
          };
          let appended = false;
          setCommentsMap(prev => {
            const list = prev[activePost.id] || [];
            if (list.some(x => x.id === c.id)) {
              return prev;
            }
            appended = true;
            return { ...prev, [activePost.id]: [...list, c] };
          });
          if (appended) {
            setCommentCounts(prev => ({
              ...prev,
              [activePost.id]: (prev[activePost.id] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    commentsRealtimeRef.current = channel;
    return () => {
      if (commentsRealtimeRef.current) {
        try {
          getSupabaseClient().removeChannel(commentsRealtimeRef.current);
        } catch {}
        commentsRealtimeRef.current = null;
      }
    };
  }, [activePost]);

  // 期限をサーバ情報（expires_at）/ created_at+1h から設定
  useEffect(() => {
    setExpiresAt(prev => {
      const next = { ...prev } as Record<string, number>;
      posts.forEach(p => {
        if (p.expires_at) {
          next[p.id] = new Date(p.expires_at).getTime();
        } else if (p.created_at) {
          next[p.id] = new Date(p.created_at).getTime() + 60 * 60 * 1000;
        } else if (!next[p.id]) {
          next[p.id] = Date.now() + 60 * 60 * 1000;
        }
      });
      return next;
    });
  }, [posts]);

  // 毎秒再描画（残り時間更新用）
  useEffect(() => {
    const t = setInterval(() => setNowTick(tk => (tk + 1) % 1_000_000), 1000);
    return () => clearInterval(t);
  }, []);

  // 有効期限切れ検知→消失アニメをトリガー
  useEffect(() => {
    const now = Date.now();
    for (const p of posts) {
      const end = expiresAt[p.id];
      if (!end) {
        continue;
      }
      if (!expired[p.id] && end <= now) {
        setExpired(prev => ({ ...prev, [p.id]: true }));
        setExpireAnim(e => ({ postId: p.id, tick: e.tick + 1 }));
      }
    }
  }, [expiresAt, posts, expired]);

  // 期限切れになったものを実際に非表示へ（消失アニメの後）
  useEffect(() => {
    const now = Date.now();
    const toHide = posts.filter(p => expired[p.id]);
    if (toHide.length === 0) {
      return;
    }
    const timers: any[] = [];
    toHide.forEach(p => {
      const t = setTimeout(() => {
        setHiddenIds(prev => ({ ...prev, [p.id]: now }));
        setDisplayed(prev => prev.filter(x => x.id !== p.id));
      }, 560);
      timers.push(t);
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [expired, posts]);

  const formatRemain = (ms: number) => {
    const clamped = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(clamped / 3600);
    const m = Math.floor((clamped % 3600) / 60);
    const s = clamped % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // バブル容量（画面サイズから概算）
  const computeCapacity = () => {
    const avg = 88; // 平均直径の目安
    const pack = 0.28; // 充填率の目安
    const cap = Math.floor((width * height * pack) / (avg * avg));
    return Math.max(8, Math.min(24, cap));
  };
  const capacity = computeCapacity();
  const [displayed, setDisplayed] = useState<BubbleFieldPost[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Record<string, number>>({});
  const bubbleCount = displayed.length;
  // 循環表示はせず1面のみ
  const LOOPS = 1;
  const contentHeight = height * LOOPS;

  const bubbles = useMemo(() => {
    return Array.from({ length: bubbleCount }).map((_, i) => {
      const size = Math.round(56 + Math.random() * 72);
      const x = new Animated.Value(Math.random() * (width - size));
      const y = new Animated.Value(Math.random() * (contentHeight - size));
      // 他UIのトーンに合わせつつ、視認性を出すためにアクセントカラーに薄い透明度を付与
      const color = withAlpha(colors.pink, 0.22);
      return { id: String(i), size, x, y, color } as const;
    });
  }, [bubbleCount, width, contentHeight, colors.pink]);

  // posts変更時に容量管理（overflowは消失アニメ→非表示）
  useEffect(() => {
    const candidates = posts.filter(p => !hiddenIds[p.id]);
    const nextDisplayed = candidates.slice(-capacity);

    const nextIds = new Set(nextDisplayed.map(p => p.id));
    const toRemove = displayed.filter(p => !nextIds.has(p.id)).map(p => p.id);

    if (toRemove.length > 0) {
      toRemove.forEach((id, idx) => {
        setTimeout(() => {
          setExpireAnim(e => ({ postId: id, tick: e.tick + 1 }));
        }, idx * 80);
      });
      const totalDelay = 560 + (toRemove.length - 1) * 80;
      setTimeout(() => {
        setHiddenIds(prev => ({
          ...prev,
          ...Object.fromEntries(toRemove.map(id => [id, Date.now()])),
        }));
        setDisplayed(nextDisplayed);
      }, totalDelay);
    } else {
      setDisplayed(nextDisplayed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, capacity]);

  // 物理ベースの緩い移動＋バブル同士の衝突
  useEffect(() => {
    const motionEnabled = __DEV__ ? true : !reduceMotion;
    if (!motionEnabled) {
      return;
    }
    let raf: number | null = null;
    let last = Date.now();
    let skip = false; // ドラッグ中は隔フレームで軽量化

    // 速度ベクトルを保持
    const vel = bubbles.map(() => ({
      vx: (Math.random() - 0.5) * 60,
      vy: (Math.random() - 0.5) * 60,
    }));

    const step = () => {
      const now = Date.now();
      let dt = (now - last) / 1000; // seconds
      last = now;
      if (dt > 0.05) {
        dt = 0.05;
      } // 大きすぎるデルタは制限

      if (draggingRef.current) {
        skip = !skip;
        if (skip) {
          raf = requestAnimationFrame(step);
          return;
        }
      }

      const centers = bubbles.map(b => ({
        x: (b.x as any).__getValue() + b.size / 2,
        y: (b.y as any).__getValue() + b.size / 2,
        r: b.size / 2,
      }));

      // ランダムな微小加速（漂い）＋減衰
      const MAX_SPEED = 90;
      for (let i = 0; i < bubbles.length; i++) {
        vel[i].vx += (Math.random() - 0.5) * 40 * dt;
        vel[i].vy += (Math.random() - 0.5) * 40 * dt;
        // 減衰（わずか）
        vel[i].vx *= 0.995;
        vel[i].vy *= 0.995;
        // 速度制限
        const sp = Math.hypot(vel[i].vx, vel[i].vy);
        if (sp > MAX_SPEED) {
          vel[i].vx = (vel[i].vx / sp) * MAX_SPEED;
          vel[i].vy = (vel[i].vy / sp) * MAX_SPEED;
        }
      }

      // 位置を更新
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        let nx = (b.x as any).__getValue() + vel[i].vx * dt;
        let ny = (b.y as any).__getValue() + vel[i].vy * dt;

        // コンテンツ境界で反射（画面枠ではない）
        if (nx < 0) {
          nx = 0;
          vel[i].vx *= -0.9;
        }
        if (nx > width - b.size) {
          nx = width - b.size;
          vel[i].vx *= -0.9;
        }
        if (ny < 0) {
          ny = 0;
          vel[i].vy *= -0.9;
        }
        if (ny > contentHeight - b.size) {
          ny = contentHeight - b.size;
          vel[i].vy *= -0.9;
        }

        b.x.setValue(nx);
        b.y.setValue(ny);
        centers[i].x = nx + b.size / 2;
        centers[i].y = ny + b.size / 2;
      }

      // バブル同士の衝突解決（等質量の弾性近似）
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const dx = centers[j].x - centers[i].x;
          const dy = centers[j].y - centers[i].y;
          let dist = Math.hypot(dx, dy);
          const minDist = centers[i].r + centers[j].r;
          if (dist === 0) {
            dist = 0.001;
          }
          if (dist < minDist) {
            // 位置の押し出し
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const shift = overlap / 2;
            centers[i].x -= nx * shift;
            centers[i].y -= ny * shift;
            centers[j].x += nx * shift;
            centers[j].y += ny * shift;
            const bi = bubbles[i]!;
            const bj = bubbles[j]!;
            bi.x.setValue(centers[i].x - bi.size / 2);
            bi.y.setValue(centers[i].y - bi.size / 2);
            bj.x.setValue(centers[j].x - bj.size / 2);
            bj.y.setValue(centers[j].y - bj.size / 2);

            // 速度の交換（法線方向成分）
            const rvx = vel[j].vx - vel[i].vx;
            const rvy = vel[j].vy - vel[i].vy;
            const vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              // 法線方向だけ入れ替える（等質量の弾性）
              const impulse = vn;
              vel[i].vx += nx * impulse;
              vel[i].vy += ny * impulse;
              vel[j].vx -= nx * impulse;
              vel[j].vy -= ny * impulse;
            }
          }
        }
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [bubbles, reduceMotion, width, contentHeight]);

  // Smooth infinite scroll with PanResponder + inertia
  const panStartRef = useRef({ base: 0 });
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8,
        onPanResponderGrant: () => {
          draggingRef.current = true;
          panStartRef.current.base = (scrollOffset as any).__getValue?.() || 0;
          (scrollOffset as any).stopAnimation?.();
        },
        onPanResponderMove: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState
        ) => {
          let next = panStartRef.current.base - g.dy; // finger down => content up
          const m = contentHeight;
          if (next < -m || next > m * 2) {
            next = ((next % m) + m) % m;
          }
          scrollOffset.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          draggingRef.current = false;
          panStartRef.current.base = (scrollOffset as any).__getValue?.() || 0;
          const v = -(g.vy || 0);
          if (Math.abs(v) > 0.01) {
            Animated.decay(scrollOffset, {
              velocity: v,
              deceleration: 0.997,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
          panStartRef.current.base = (scrollOffset as any).__getValue?.() || 0;
        },
      }),
    [contentHeight, scrollOffset]
  );

  const overlay = (
    <View
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['#ffffff06', '#ffffff00']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
    </View>
  );

  // Wrap offset to avoid overflow while keeping seamless view
  useEffect(() => {
    const id = scrollOffset.addListener(({ value }: any) => {
      const m = contentHeight;
      if (value < 0 || value >= m) {
        const wrapped = ((value % m) + m) % m;
        scrollOffset.setValue(wrapped);
        panStartRef.current.base = wrapped;
      }
    });
    return () => scrollOffset.removeListener(id);
  }, [scrollOffset, contentHeight]);

  const tileOffsets = useMemo(
    () => [0].map(v => new Animated.Value(v)),
    [contentHeight]
  );

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {tileOffsets.map((tileOffset, idx) => (
        <Animated.View
          key={`tile-${idx}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: contentHeight,
            transform: [
              {
                translateY: Animated.add(
                  tileOffset,
                  Animated.multiply(scrollOffset, -1)
                ) as any,
              },
            ],
          }}
        >
          {bubbles.map((b, i) => {
            const keyStr = (tileOffset as any).__getValue?.() ?? 0;
            const bubbleKey = `${keyStr}:${b.id}`;
            // バブル数は表示中postと一致
            const post = displayed[i];
            return (
              <Bubble
                key={bubbleKey}
                x={b.x}
                y={b.y}
                size={b.size}
                color={b.color}
                label={post?.title}
                postId={post?.id}
                celebratePostId={celebrate.postId}
                celebrateTick={celebrate.tick}
                expirePostId={expireAnim.postId}
                expireTick={expireAnim.tick}
                bubbleKey={bubbleKey}
                celebrateBubbleKey={celebrate.bubbleKey}
                onPress={() => {
                  if (post) {
                    setActivePost(post);
                    setCelebrate(c => ({ ...c, bubbleKey }));
                  }
                }}
              />
            );
          })}
        </Animated.View>
      ))}
      {overlay}
      <Modal
        visible={!!activePost}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePost(null)}
      >
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Pressable
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
            }}
            onPress={() => setActivePost(null)}
          />
          <View
            style={{
              width: Math.min(360, width - 32),
              borderRadius: 24,
              overflow: 'hidden',
            }}
          >
            <BlurView
              intensity={40}
              tint="dark"
              style={{ padding: 16, backgroundColor: '#ffffff10' }}
            >
              <Text
                style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '800',
                  marginBottom: 6,
                }}
                numberOfLines={2}
              >
                {activePost?.title}
              </Text>
              <Text style={{ color: 'white', opacity: 0.9, lineHeight: 20 }}>
                {activePost?.body}
              </Text>
              {/* Action bar */}
              {activePost && (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    marginTop: 14,
                    alignItems: 'center',
                  }}
                >
                  {/* Like (共感) */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="共感"
                    onPress={async () => {
                      await Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      const res = await toggleAnonReaction(activePost.id);
                      if (res) {
                        const willHit10 = res.count >= 10;
                        setReactionState(prev => ({
                          ...prev,
                          [activePost.id]: {
                            reacted: res.reacted,
                            count: res.count,
                          },
                        }));
                        if (willHit10) {
                          setCelebrate(c => ({
                            postId: activePost.id,
                            tick: c.tick + 1,
                            bubbleKey: c.bubbleKey,
                          }));
                          setExpireAnim(e => ({
                            postId: activePost.id,
                            tick: e.tick + 1,
                          }));
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Success
                          ).catch(() => {});
                        }
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surface,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={
                        (reactionState[activePost.id]?.reacted
                          ? 'heart'
                          : 'heart-outline') as any
                      }
                      size={18}
                      color={colors.pink}
                    />
                    {typeof reactionState[activePost.id]?.count ===
                      'number' && (
                      <Text style={{ color: colors.pink, marginLeft: 6 }}>
                        {reactionState[activePost.id]?.count}
                      </Text>
                    )}
                  </Pressable>
                  {/* Comment */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="コメント"
                    onPress={async () => {
                      await Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      setTimeout(() => commentInputRef.current?.focus(), 50);
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surface,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={'chatbubble-ellipses-outline'}
                      size={18}
                      color={colors.pink}
                    />
                    {typeof commentCounts[activePost.id] === 'number' && (
                      <Text style={{ color: colors.pink, marginLeft: 6 }}>
                        {commentCounts[activePost.id]}
                      </Text>
                    )}
                  </Pressable>
                  {/* Remaining time next to comment */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginLeft: 'auto',
                    }}
                  >
                    <Ionicons
                      name={'time-outline'}
                      size={16}
                      color={colors.subtext}
                    />
                    <Text style={{ color: colors.subtext, marginLeft: 6 }}>
                      {formatRemain(
                        (expiresAt[activePost.id] || 0) - Date.now()
                      )}
                    </Text>
                  </View>
                </View>
              )}
              <View style={{ height: 12 }} />
              {/* コメント一覧 */}
              {activePost && (
                <View style={{ maxHeight: 220, marginBottom: 10 }}>
                  {(commentsMap[activePost.id] || []).length === 0 ? (
                    <Text style={{ color: '#FFFFFF88', fontSize: 13 }}>
                      まだコメントはありません
                    </Text>
                  ) : (
                    <View>
                      {(commentsMap[activePost.id] || []).map(c => (
                        <View key={c.id} style={{ paddingVertical: 6 }}>
                          <Text
                            style={{
                              color: '#FFFFFFCC',
                              fontSize: 12,
                              marginBottom: 2,
                            }}
                          >
                            {c.display_name}
                          </Text>
                          <Text style={{ color: 'white' }}>{c.content}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* コメント入力 */}
              {activePost && (
                <View
                  style={{
                    backgroundColor: '#00000033',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <TextInput
                    ref={commentInputRef}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    placeholder="匿名でコメント…"
                    placeholderTextColor={'#CCCCCCAA'}
                    style={{ color: 'white', paddingVertical: 6 }}
                    multiline
                  />
                </View>
              )}
              <View style={{ height: 8 }} />
              {activePost && (
                <Pressable
                  onPress={async () => {
                    if (!activePost) {
                      return;
                    }
                    const text = commentDraft.trim();
                    if (!text) {
                      return;
                    }
                    const row = await addAnonComment(activePost.id, text);
                    if (row) {
                      let appended = false;
                      setCommentsMap(prev => {
                        const list = prev[activePost.id] || [];
                        if (list.some(x => x.id === row.id)) {
                          return prev;
                        }
                        appended = true;
                        return { ...prev, [activePost.id]: [...list, row] };
                      });
                      if (appended) {
                        setCommentCounts(prev => ({
                          ...prev,
                          [activePost.id]: (prev[activePost.id] || 0) + 1,
                        }));
                      }
                      setCommentDraft('');
                      commentInputRef.current?.clear();
                      await Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                    }
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: '#ffffff22',
                      paddingVertical: 10,
                      borderRadius: 999,
                      alignItems: 'center',
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>
                    送信
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setActivePost(null)}
                style={({ pressed }) => [
                  {
                    backgroundColor: '#ffffff22',
                    paddingVertical: 10,
                    borderRadius: 999,
                    alignItems: 'center',
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>
                  閉じる
                </Text>
              </Pressable>
            </BlurView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
