import { View, Text, Pressable, Animated, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/theme';
import MyPostsListScreen from './MyPostsListScreen';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabaseClient';

export default function ProfileScreen({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  const { user } = useAuth();
  const [myPostCount, setMyPostCount] = useState<number>(0);
  useEffect(() => {
    (async () => {
      try {
        const client = getSupabaseClient();
        if (!user?.id) return;
        let countVal = 0;
        try {
          const { data, error } = await client.rpc('get_user_post_count_v2');
          if (!error && typeof data !== 'undefined' && data !== null) {
            countVal = Number(data);
          } else {
            // Fallback to direct count if RPC unavailable or no permission
            // Direct table access is revoked under RLS; keep 0
          }
        } catch {
          // Keep default 0 on error
        }
        setMyPostCount(countVal);
      } catch {}
    })();
  }, [user?.id]);
  const rooms = [
    { id: 'r1', name: 'ねんね相談', members: 124 },
    { id: 'r2', name: 'ごはん/離乳食', members: 88 },
    { id: 'r3', name: '0-6ヶ月', members: 203 },
  ];
  return (
    <Animated.View style={{ flex: 1, backgroundColor: 'transparent', padding: theme.spacing(2), paddingTop: 40, opacity: fade }}>
      <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={30} tint="dark" style={{ padding: theme.spacing(1.75), backgroundColor: '#ffffff10' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 30 }}>👩‍🍼</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>ママネーム</Text>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>ママの一言プロフィール</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pill label={`フォロー 32`} onPress={() => onNavigate && onNavigate('following')} />
                <Pill label={`フォロワー 128`} onPress={() => onNavigate && onNavigate('followers')} />
              </View>
            </View>
          </View>
        </BlurView>
      </View>

      <View style={{ marginTop: theme.spacing(1.5), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
          <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 6 }}>プロフィール</Text>
          <Text style={{ color: colors.text, lineHeight: 20 }}>はじめまして。夜間授乳がんばり中。コーヒーと昼寝がご褒美。よろしくお願いします。</Text>
        </BlurView>
      </View>

      <View style={{ marginTop: theme.spacing(1.5), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(1), backgroundColor: '#ffffff10' }}>
          <View style={{ flexDirection: 'row' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing(1), gap: theme.spacing(1) }}>
              <Pill label="共感したポスト" onPress={() => onNavigate && onNavigate('liked')} />
              <Pill label="参加ルーム" onPress={() => onNavigate && onNavigate('roomsList')} />
            </ScrollView>
          </View>
        </BlurView>
      </View>

      <View style={{ marginTop: theme.spacing(1.5), borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.shadow.card }}>
        <BlurView intensity={20} tint="dark" style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text accessibilityRole="text" accessibilityLabel={`あなたのポストは${myPostCount}件`} style={{ color: colors.subtext, fontSize: 12 }}>あなたのポスト（{myPostCount}）</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="あなたのポストをすべて見る" onPress={() => onNavigate && onNavigate('myPosts')} style={({ pressed }) => [{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface, borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
              <Text style={{ color: colors.pink, fontWeight: '700' }}>すべて見る</Text>
            </Pressable>
          </View>
        </BlurView>
      </View>
    </Animated.View>
  );
}

function Pill({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: theme.spacing(1.25), borderRadius: 999, transform: [{ scale: pressed ? 0.97 : 1 }] }]}> 
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme() as any;
  const { colors } = theme;
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.subtext, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
