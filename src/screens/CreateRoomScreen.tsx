import { View, Text, TextInput, Pressable, Animated } from 'react-native';
import { useTheme } from '../theme/theme';

export default function CreateRoomScreen() {
  const theme = useTheme() as any;
  const { colors } = theme;
  const fade = new Animated.Value(0);
  Animated.timing(fade, {
    toValue: 1,
    duration: 200,
    useNativeDriver: true,
  }).start();
  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        padding: theme.spacing(2),
        paddingTop: 40,
        opacity: fade,
      }}
    >
      <View
        style={{
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          ...theme.shadow.card,
        }}
      >
        <View
          style={{ padding: theme.spacing(1.5), backgroundColor: '#ffffff10' }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: theme.spacing(1),
            }}
          >
            ルーム作成
          </Text>
          <Text
            style={{
              color: colors.subtext,
              fontSize: 12,
              marginBottom: theme.spacing(1),
            }}
          >
            テーマと説明を入力してね
          </Text>
          <View
            style={{
              height: 1,
              backgroundColor: '#ffffff14',
              marginBottom: theme.spacing(1),
            }}
          />
          <View style={{ gap: theme.spacing(1) }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing(1),
              }}
            >
              <TextInput
                placeholder="ルーム名（例：ねんね相談）"
                placeholderTextColor={colors.subtext}
                style={{ color: colors.text, fontSize: 16, height: 44 }}
              />
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing(1),
                paddingVertical: theme.spacing(0.5),
              }}
            >
              <TextInput
                placeholder="説明（目的やルールなど）"
                placeholderTextColor={colors.subtext}
                style={{ color: colors.text, fontSize: 16, minHeight: 96 }}
                multiline
              />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing(1) }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing(1),
                  height: 40,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  公開範囲: みんなに公開
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing(1),
                  height: 40,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  招待制
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              {
                marginTop: theme.spacing(1.5),
                alignSelf: 'flex-end',
                backgroundColor: colors.pink,
                borderRadius: theme.radius.md,
                paddingVertical: 12,
                paddingHorizontal: theme.spacing(2),
                transform: [{ scale: pressed ? 0.97 : 1 }],
                ...theme.shadow.card,
              },
            ]}
          >
            <Text style={{ color: '#23181D', fontWeight: '700' }}>作成</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
