import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { theme } from '../theme/theme';

const initial = [
  { id: 'a1', body: '今日は本当に疲れた…でも頑張った自分えらい', timeLeft: '58分', ai: 'よくここまで頑張りましたね。少しでも休める時間がありますように。' },
  { id: 'a2', body: '授乳の間隔がバラバラで眠い…', timeLeft: '43分', ai: '眠れないのは本当に大変。短い仮眠でもOK、あなたの体も大切に。' },
];

export default function AnonRoomScreen({ onOpenPost }: { onOpenPost?: () => void }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState('');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <View style={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(10) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing(1.5) }} />}
          renderItem={({ item }) => (
            <View>
              <Pressable onPress={() => onOpenPost && onOpenPost()} style={({ pressed }) => [{ backgroundColor: colors.card, borderRadius: theme.radius.lg, padding: theme.spacing(1.75), transform: [{ scale: pressed ? 0.98 : 1 }], ...theme.shadow.card }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.subtext, fontSize: 12 }}>匿名</Text>
                  <View style={{ backgroundColor: colors.pinkSoft, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing(1), paddingVertical: 2 }}>
                    <Text style={{ color: '#302126', fontSize: 12 }}>消滅まで {item.timeLeft}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.text, fontSize: 16, marginBottom: 10 }}>{item.body}</Text>
                <View style={{ marginTop: 8, gap: 6 }}>
                  <Text style={{ color: colors.subtext, fontSize: 12 }}>コメント</Text>
                  <View style={{ backgroundColor: colors.surface, borderRadius: theme.radius.md, padding: theme.spacing(1.25) }}>
                    <Text style={{ color: colors.pink, fontWeight: '700', marginBottom: 4 }}>ママの味方</Text>
                    <Text style={{ color: colors.text }}>{item.ai}</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          )}
        />
      </View>
      <View style={{ padding: theme.spacing(1.5), backgroundColor: colors.card, borderTopColor: '#22252B', borderTopWidth: 1 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: theme.radius.md, padding: theme.spacing(1) }}>
          <TextInput
            placeholder="ここでは完全匿名。気持ちを吐き出してね"
            placeholderTextColor={colors.subtext}
            value={text}
            onChangeText={setText}
            multiline
            style={{ maxHeight: 120, color: colors.text, fontSize: 16 }}
          />
        </View>
        <Pressable style={({ pressed }) => [{ marginTop: theme.spacing(1), alignSelf: 'flex-end', backgroundColor: colors.pink, borderRadius: theme.radius.md, paddingVertical: 10, paddingHorizontal: theme.spacing(2), transform: [{ scale: pressed ? 0.97 : 1 }], ...theme.shadow.card }]}>
          <Text style={{ color: '#23181D', fontWeight: '700' }}>匿名で投稿</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
