import { useMemo, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { useBlockedList } from '../hooks/useBlock';
import { useSearch } from '../hooks/useSearch';
import type { SearchPostItem, SearchUserItem } from '../services/searchService';

export default function SearchScreen({
  onOpenUser,
  onOpenPost,
}: {
  onOpenUser?: (userId: string) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { colors, radius } = useTheme();
  const [q, setQ] = useState('');
  const { blocked } = useBlockedList();
  const { status, kind, users, posts, error } = useSearch(q);

  const filteredUsers = useMemo(() => {
    return users.filter(u => !blocked.includes(u.id));
  }, [users, blocked]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={['top'] as any}
      >
        <View
          style={{
            flex: 1,
            paddingTop: 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <TextInput
              placeholder="検索（#ハッシュタグ または @ユーザー）"
              placeholderTextColor={colors.subtext}
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="検索入力"
              style={{
                flex: 1,
                height: 44,
                paddingHorizontal: 12,
                borderRadius: radius.md,
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: '#22252B',
                borderWidth: 1,
              }}
            />
          </View>
          {status === 'idle' && (
            <View style={{ paddingTop: 20 }}>
              <HintRow
                text="@alice でユーザーを検索"
                colors={{ text: colors.text, sub: colors.subtext }}
              />
              <HintRow
                text="#music でハッシュタグ検索"
                colors={{ text: colors.text, sub: colors.subtext }}
              />
            </View>
          )}
          {status === 'loading' && (
            <View style={{ paddingTop: 20, alignItems: 'center' }}>
              <ActivityIndicator color={colors.pink} />
              <Text style={{ marginTop: 8, color: colors.subtext }}>
                検索中…
              </Text>
            </View>
          )}
          {status === 'error' && (
            <View style={{ paddingTop: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                エラー
              </Text>
              <Text style={{ color: colors.subtext, marginTop: 6 }}>
                {error}
              </Text>
            </View>
          )}
          {status === 'success' && kind === 'user' && (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredUsers}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <UserRow
                  item={item}
                  onPress={() => onOpenUser && onOpenUser(item.id)}
                />
              )}
            />
          )}
          {status === 'success' && kind === 'hashtag' && (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={posts}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <PostRow
                  item={item}
                  onPress={() => onOpenPost && onOpenPost(item.id)}
                />
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function HintRow({
  text,
  colors,
}: {
  text: string;
  colors: { text: string; sub: string };
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.sub }}>{text}</Text>
    </View>
  );
}

function UserRow({
  item,
  onPress,
}: {
  item: SearchUserItem;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
      }}
    >
      {item.avatarUrl ? (
        <Image
          source={{ uri: item.avatarUrl }}
          style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }}
        />
      ) : item.avatarEmoji ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            marginRight: 12,
            backgroundColor: '#ffffff10',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>{item.avatarEmoji}</Text>
        </View>
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            marginRight: 12,
            backgroundColor: '#ffffff10',
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          @{item.username}
        </Text>
        {!!item.displayName && (
          <Text style={{ color: colors.subtext }}>{item.displayName}</Text>
        )}
      </View>
    </Pressable>
  );
}

function PostRow({
  item,
  onPress,
}: {
  item: SearchPostItem;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={{ paddingVertical: 10 }} onPress={onPress}>
      <Text style={{ color: colors.text }}>
        @{item.author.username} ·{' '}
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
      <Text style={{ color: colors.subtext, marginTop: 4 }}>
        {item.contentPreview}
      </Text>
    </Pressable>
  );
}
