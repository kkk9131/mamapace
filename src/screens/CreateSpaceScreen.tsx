/**
 * CREATE SPACE SCREEN
 * 
 * Screen for creating new spaces (paid users only)
 * Follows the requirements from room-feature-requirements-v1.md
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  Animated
} from 'react-native';
import { useTheme } from '../theme/theme';
import { BlurView } from 'expo-blur';
import { useSpaceOperations, useSubscription } from '../hooks/useRooms';
import { CreateSpaceRequest, RoomConstraints } from '../types/room';

interface CreateSpaceScreenProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CreateSpaceScreen({ onSuccess, onCancel }: CreateSpaceScreenProps) {
  const theme = useTheme() as any;
  const { colors } = theme;
  
  // State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState<string>('');
  
  // Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Hooks
  const { loading, error, createSpace } = useSpaceOperations();
  const { subscription, canCreateSpaces } = useSubscription();

  // Animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Check permission
  useEffect(() => {
    if (!canCreateSpaces) {
      Alert.alert(
        '有料プラン限定',
        'スペースの作成には有料プランの契約が必要です',
        [{ text: 'OK', onPress: onCancel }]
      );
    }
  }, [canCreateSpaces, onCancel]);

  // Validate form
  const isFormValid = () => {
    return name.trim().length >= RoomConstraints.space.name.minLength &&
           name.trim().length <= RoomConstraints.space.name.maxLength &&
           (!description || description.length <= RoomConstraints.space.description.maxLength) &&
           tags.length <= RoomConstraints.space.maxTags;
  };

  // Handle add tag
  const handleAddTag = () => {
    const tag = currentTag.trim();
    if (tag && !tags.includes(tag) && tags.length < RoomConstraints.space.maxTags) {
      setTags([...tags, tag]);
      setCurrentTag('');
    }
  };

  // Handle remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle create space
  const handleCreateSpace = async () => {
    if (!isFormValid()) {
      Alert.alert('入力エラー', '入力内容を確認してください');
      return;
    }

    const request: CreateSpaceRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      is_public: isPublic,
      max_members: maxMembers ? parseInt(maxMembers) : undefined
    };

    const result = await createSpace(request);
    if (result) {
      Alert.alert(
        'スペース作成完了',
        `「${name}」を作成しました`,
        [{ text: 'OK', onPress: onSuccess }]
      );
    } else if (error) {
      Alert.alert('エラー', error);
    }
  };

  if (!canCreateSpaces) {
    return null; // Handled by useEffect
  }

  return (
    <Animated.View style={{ 
      flex: 1, 
      backgroundColor: 'transparent',
      opacity: fadeAnim
    }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={{ 
          paddingTop: 48, 
          paddingBottom: 16, 
          paddingHorizontal: theme.spacing(2),
          borderBottomWidth: 1,
          borderBottomColor: colors.subtext + '20'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={onCancel}>
              <Text style={{ color: colors.text, fontSize: 16 }}>キャンセル</Text>
            </Pressable>
            
            <Text style={{ 
              color: colors.text, 
              fontSize: 18, 
              fontWeight: 'bold' 
            }}>
              スペース作成
            </Text>
            
            <Pressable 
              onPress={handleCreateSpace}
              disabled={!isFormValid() || loading}
              style={{ opacity: (!isFormValid() || loading) ? 0.5 : 1 }}
            >
              <Text style={{ 
                color: colors.pink, 
                fontSize: 16, 
                fontWeight: 'bold' 
              }}>
                {loading ? '作成中...' : '作成'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing(2) }}>
          {/* Space Name */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 16, 
              fontWeight: 'bold', 
              marginBottom: 8 
            }}>
              スペース名 *
            </Text>
            <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
              <BlurView intensity={30} tint="dark" style={{ backgroundColor: '#ffffff10' }}>
                <TextInput
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 16
                  }}
                  placeholder="スペース名を入力（1-100文字）"
                  placeholderTextColor={colors.subtext}
                  value={name}
                  onChangeText={setName}
                  maxLength={RoomConstraints.space.name.maxLength}
                />
              </BlurView>
            </View>
            <Text style={{ 
              color: colors.subtext, 
              fontSize: 12, 
              marginTop: 4 
            }}>
              {name.length}/{RoomConstraints.space.name.maxLength}文字
            </Text>
          </View>

          {/* Description */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 16, 
              fontWeight: 'bold', 
              marginBottom: 8 
            }}>
              説明
            </Text>
            <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
              <BlurView intensity={30} tint="dark" style={{ backgroundColor: '#ffffff10' }}>
                <TextInput
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    height: 100,
                    textAlignVertical: 'top'
                  }}
                  placeholder="スペースの説明を入力（任意、最大500文字）"
                  placeholderTextColor={colors.subtext}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={RoomConstraints.space.description.maxLength}
                  multiline
                />
              </BlurView>
            </View>
            <Text style={{ 
              color: colors.subtext, 
              fontSize: 12, 
              marginTop: 4 
            }}>
              {description.length}/{RoomConstraints.space.description.maxLength}文字
            </Text>
          </View>

          {/* Tags */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 16, 
              fontWeight: 'bold', 
              marginBottom: 8 
            }}>
              タグ
            </Text>
            
            {/* Current tags */}
            {tags.length > 0 && (
              <View style={{ 
                flexDirection: 'row', 
                flexWrap: 'wrap', 
                marginBottom: 12 
              }}>
                {tags.map((tag, index) => (
                  <Pressable
                    key={index}
                    onPress={() => handleRemoveTag(tag)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.pinkSoft,
                        borderRadius: theme.radius.sm,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        marginRight: 8,
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        transform: [{ scale: pressed ? 0.95 : 1 }]
                      }
                    ]}
                  >
                    <Text style={{ color: '#302126', fontSize: 14 }}>#{tag}</Text>
                    <Text style={{ color: '#302126', fontSize: 16, marginLeft: 4 }}>×</Text>
                  </Pressable>
                ))}
              </View>
            )}
            
            {/* Add tag input */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
                <BlurView intensity={30} tint="dark" style={{ backgroundColor: '#ffffff10' }}>
                  <TextInput
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 16
                    }}
                    placeholder="タグを追加"
                    placeholderTextColor={colors.subtext}
                    value={currentTag}
                    onChangeText={setCurrentTag}
                    onSubmitEditing={handleAddTag}
                    returnKeyType="done"
                  />
                </BlurView>
              </View>
              
              <Pressable
                onPress={handleAddTag}
                disabled={!currentTag.trim() || tags.length >= RoomConstraints.space.maxTags}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.pink,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    marginLeft: 8,
                    opacity: (!currentTag.trim() || tags.length >= RoomConstraints.space.maxTags) ? 0.5 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  }
                ]}
              >
                <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
                  追加
                </Text>
              </Pressable>
            </View>
            
            <Text style={{ 
              color: colors.subtext, 
              fontSize: 12, 
              marginTop: 4 
            }}>
              {tags.length}/{RoomConstraints.space.maxTags}個のタグ
            </Text>
          </View>

          {/* Visibility */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 16, 
              fontWeight: 'bold', 
              marginBottom: 12 
            }}>
              公開設定
            </Text>
            
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                onPress={() => setIsPublic(true)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    borderRadius: theme.radius.lg,
                    overflow: 'hidden',
                    marginRight: 8,
                    transform: [{ scale: pressed ? 0.98 : 1 }]
                  }
                ]}
              >
                <BlurView 
                  intensity={30} 
                  tint="dark" 
                  style={{ 
                    backgroundColor: isPublic ? colors.pinkSoft + '40' : '#ffffff10',
                    padding: 16,
                    borderWidth: isPublic ? 2 : 0,
                    borderColor: colors.pink
                  }}
                >
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 16, 
                    fontWeight: 'bold',
                    marginBottom: 4
                  }}>
                    公開
                  </Text>
                  <Text style={{ color: colors.subtext, fontSize: 14 }}>
                    誰でも検索・参加可能
                  </Text>
                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                    最大500人
                  </Text>
                </BlurView>
              </Pressable>
              
              <Pressable
                onPress={() => setIsPublic(false)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    borderRadius: theme.radius.lg,
                    overflow: 'hidden',
                    marginLeft: 8,
                    transform: [{ scale: pressed ? 0.98 : 1 }]
                  }
                ]}
              >
                <BlurView 
                  intensity={30} 
                  tint="dark" 
                  style={{ 
                    backgroundColor: !isPublic ? colors.pinkSoft + '40' : '#ffffff10',
                    padding: 16,
                    borderWidth: !isPublic ? 2 : 0,
                    borderColor: colors.pink
                  }}
                >
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 16, 
                    fontWeight: 'bold',
                    marginBottom: 4
                  }}>
                    非公開
                  </Text>
                  <Text style={{ color: colors.subtext, fontSize: 14 }}>
                    招待制・承認が必要
                  </Text>
                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                    最大50人
                  </Text>
                </BlurView>
              </Pressable>
            </View>
          </View>

          {/* Max Members (Optional) */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 16, 
              fontWeight: 'bold', 
              marginBottom: 8 
            }}>
              最大メンバー数（任意）
            </Text>
            <View style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
              <BlurView intensity={30} tint="dark" style={{ backgroundColor: '#ffffff10' }}>
                <TextInput
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 16
                  }}
                  placeholder={`デフォルト: ${isPublic ? '500' : '50'}人`}
                  placeholderTextColor={colors.subtext}
                  value={maxMembers}
                  onChangeText={setMaxMembers}
                  keyboardType="numeric"
                />
              </BlurView>
            </View>
            <Text style={{ 
              color: colors.subtext, 
              fontSize: 12, 
              marginTop: 4 
            }}>
              {isPublic ? '公開スペース: 最大500人' : '非公開スペース: 最大50人'}
            </Text>
          </View>

          {/* Subscription Info */}
          <View style={{ 
            backgroundColor: colors.pinkSoft + '20',
            borderRadius: theme.radius.lg,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.pinkSoft
          }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 14, 
              fontWeight: 'bold',
              marginBottom: 4
            }}>
              💎 有料プラン特典
            </Text>
            <Text style={{ color: colors.subtext, fontSize: 13 }}>
              現在のプラン: {subscription?.plan || 'unknown'}
            </Text>
            <Text style={{ color: colors.subtext, fontSize: 13 }}>
              スペース作成は有料プランユーザー限定の機能です
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}