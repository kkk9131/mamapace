import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/theme';

const items = [
  { id: 'a1', body: '今日は本当に疲れた…でも頑張った自分えらい', time: '58分' },
  { id: 'a2', body: '授乳の間隔がバラバラで眠い…', time: '43分' },
];

export default function AnonFeedScreen({
  onComment,
  onOpenPost,
}: {
  onComment?: () => void;
  onOpenPost?: () => void;
}) {
  const theme = useTheme();
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
        backgroundColor: 'transparent',
        paddingTop: 40,
        paddingBottom: 72,
        opacity: fade,
      }}
    >
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{
          padding: theme.spacing(2),
          paddingBottom: theme.spacing(2),
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: theme.spacing(1.25) }} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              onOpenPost ? onOpenPost() : onComment && onComment()
            }
            style={({ pressed }) => [
              {
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                transform: [{ scale: pressed ? 0.98 : 1 }],
                ...theme.shadow.card,
              },
            ]}
          >
            <BlurView
              intensity={30}
              tint="dark"
              style={{
                padding: theme.spacing(1.75),
                backgroundColor: '#ffffff10',
              }}
            >
              <Text
                style={{ color: colors.text, fontSize: 16, marginBottom: 8 }}
              >
                {item.body}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.subtext, fontSize: 12 }}>
                  消滅まで {item.time}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['💗', '💬'].map(icon => {
                    const scale = new Animated.Value(1);
                    const float = new Animated.Value(0);
                    const onPress = () => {
                      if (icon === '💬' && onComment) {
                        onComment();
                      }
                      Animated.sequence([
                        Animated.spring(scale, {
                          toValue: 0.9,
                          useNativeDriver: true,
                          speed: 16,
                          bounciness: 8,
                        }),
                        Animated.spring(scale, {
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
                    };
                    return (
                      <Pressable
                        key={icon}
                        onPress={onPress}
                        style={({ pressed }) => [
                          {
                            backgroundColor: colors.surface,
                            paddingHorizontal: theme.spacing(1.25),
                            paddingVertical: 6,
                            borderRadius: 999,
                            overflow: 'visible',
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          },
                        ]}
                      >
                        <Animated.Text
                          style={{
                            transform: [{ scale }],
                            color: colors.pink,
                            fontWeight: '700',
                          }}
                        >
                          {icon}
                        </Animated.Text>
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
                    );
                  })}
                </View>
              </View>
            </BlurView>
          </Pressable>
        )}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 56,
          padding: theme.spacing(1.5),
          backgroundColor: colors.card,
          borderTopColor: '#22252B',
          borderTopWidth: 1,
          opacity: 0.98,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: theme.radius.md,
            padding: theme.spacing(1),
          }}
        >
          <TextInput
            placeholder="ここでは完全匿名。気持ちを吐き出してね"
            placeholderTextColor={colors.subtext}
            multiline
            style={{ maxHeight: 120, color: colors.text, fontSize: 16 }}
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            {
              marginTop: theme.spacing(1),
              alignSelf: 'flex-end',
              backgroundColor: colors.pink,
              borderRadius: theme.radius.md,
              paddingVertical: 10,
              paddingHorizontal: theme.spacing(2),
              transform: [{ scale: pressed ? 0.97 : 1 }],
              ...theme.shadow.card,
            },
          ]}
        >
          <Text style={{ color: '#23181D', fontWeight: '700' }}>
            匿名で投稿
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Pill({ children }: { children: any }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 999,
        paddingHorizontal: theme.spacing(1.25),
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: colors.pink, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}
