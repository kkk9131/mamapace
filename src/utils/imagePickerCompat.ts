import * as ImagePicker from 'expo-image-picker';

// 画像のみ選択の互換ヘルパー
export function imagesOnlyMediaTypes(): any {
  const anyIP: any = ImagePicker as any;
  if (anyIP?.MediaType?.Images !== undefined) {
    // 新API: 配列で渡す（ライブラリ向け）
    return [anyIP.MediaType.Images];
  }
  // 旧API: 数値のenum
  return anyIP?.MediaTypeOptions?.Images;
}

// カメラ用（単一指定）
export function imageOnlyMediaTypeSingle(): any {
  const anyIP: any = ImagePicker as any;
  if (anyIP?.MediaType?.Images !== undefined) {
    return anyIP.MediaType.Images;
  }
  return anyIP?.MediaTypeOptions?.Images;
}
