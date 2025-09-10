import { useMemo, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { useBlockedList } from '../hooks/useBlock';

const tabs = [
  { key: 'users', label: 'ユーザー' },
  { key: 'rooms', label: 'ルーム' },
  { key: 'tags', label: 'ハッシュタグ' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

type Item = { id: string; title: string; subtitle?: string };

const MOCK = {
  users: [
    { id: 'u1', title: 'alice', subtitle: 'Alice A.' },
    { id: 'u2', title: 'bob', subtitle: 'Bob B.' },
  ],
  rooms: [
    { id: 'r1', title: 'General', subtitle: 'みんなで話そう' },
    { id: 'r2', title: 'Random', subtitle: '雑談' },
  ],
  tags: [
    { id: 't1', title: '#news' },
    { id: 't2', title: '#reactnative' },
  ],
} satisfies Record<TabKey, Item[]>;

export default function SearchScreen() {
  const { colors, radius } = useTheme();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<TabKey>('users');
  const { blocked } = useBlockedList();

  const data = useMemo(() => {
    const filteredByText = MOCK[active].filter(
      i =>
        i.title.toLowerCase().includes(q.toLowerCase()) ||
        (i.subtitle?.toLowerCase().includes(q.toLowerCase()) ?? false)
    );
    // ブロック除外はユーザータブのみ適用（id がユーザーID前提）
    if (active === 'users') {
      return filteredByText.filter(i => !blocked.includes(i.id));
    }
    return filteredByText;
  }, [active, q, blocked]);

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
              placeholder="検索"
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
          <View
            style={{ flexDirection: 'row', gap: 8 as any, marginBottom: 12 }}
          >
            {tabs.map(t => (
              <Pressable
                key={t.key}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                onPress={() => setActive(t.key)}
                style={({ pressed }) => [
                  {
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: radius.md,
                    backgroundColor:
                      active === t.key
                        ? colors.pink
                        : pressed
                          ? '#ffffff10'
                          : colors.card,
                    borderColor: '#22252B',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active === t.key ? '#121418' : colors.text,
                    fontWeight: '700',
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={data}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <View
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: radius.md,
                  backgroundColor: colors.card,
                  borderColor: '#22252B',
                  borderWidth: 1,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {item.title}
                </Text>
                {!!item.subtitle && (
                  <Text style={{ color: colors.subtext }}>{item.subtitle}</Text>
                )}
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
