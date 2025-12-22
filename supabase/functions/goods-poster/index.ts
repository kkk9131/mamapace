// Deno Edge Function: goods-poster
// 楽天APIから商品情報を取得し、メインフィードと#official タグ付きルームへ並列投稿
// 重複防止: 過去7日間に投稿した商品はスキップ

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RakutenItem {
  itemCode: string;
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl?: string;
  mediumImageUrls?: string[];
}

/**
 * 過去7日間に投稿した商品コードを取得
 */
async function getPostedItemCodes(supabase: SupabaseClient): Promise<Set<string>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('posted_products')
    .select('rakuten_item_code')
    .gte('posted_at', sevenDaysAgo);
  return new Set(data?.map((d: { rakuten_item_code: string }) => d.rakuten_item_code) || []);
}

/**
 * 楽天商品検索APIでキーワード検索し、未投稿の商品を1件取得
 */
async function fetchRakutenItem(postedCodes: Set<string>): Promise<RakutenItem | null> {
  const APP_ID = Deno.env.get('RAKUTEN_APP_ID')?.trim();
  const AFFILIATE_ID = Deno.env.get('RAKUTEN_AFFILIATE_ID')?.trim();

  console.log('RAKUTEN_APP_ID:', APP_ID?.substring(0, 4) + '...', 'length:', APP_ID?.length || 0);
  console.log('RAKUTEN_AFFILIATE_ID:', AFFILIATE_ID ? AFFILIATE_ID.substring(0, 8) + '...' : '未設定');

  if (!APP_ID) {
    throw new Error('RAKUTEN_APP_ID が設定されていません');
  }

  if (!AFFILIATE_ID) {
    console.warn('⚠️ RAKUTEN_AFFILIATE_ID が未設定です。アフィリエイト報酬が発生しません。');
  }

  // 子育て関連のキーワードをランダムに選択
  const keywords = [
    'ベビー おむつ',
    '子育て グッズ',
    'ベビーカー',
    '離乳食 便利',
    '赤ちゃん おもちゃ',
    'ベビー 抱っこ紐',
    '子供 絵本',
    'マタニティ',
    'ベビー服',
    '知育玩具',
  ];
  const keyword = keywords[Math.floor(Math.random() * keywords.length)];

  const query = new URLSearchParams({
    applicationId: APP_ID,
    keyword: keyword,
    hits: '30',
    sort: '-reviewAverage',
    formatVersion: '2',
  });

  // アフィリエイトIDがあれば追加（これでaffiliateUrlが返される）
  if (AFFILIATE_ID) {
    query.set('affiliateId', AFFILIATE_ID);
  }

  const resp = await fetch(
    `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706?${query}`
  );

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`楽天API呼び出し失敗: ${resp.status} - ${errorText}`);
  }

  const data = await resp.json();
  if (!data.Items || data.Items.length === 0) {
    throw new Error('商品が見つかりません');
  }

  // 未投稿の商品をフィルタ
  const unpostedItems = data.Items.filter(
    (item: RakutenItem) => !postedCodes.has(item.itemCode)
  );

  if (unpostedItems.length === 0) {
    console.log('全ての商品が投稿済みです。キーワードを変えて再検索します。');
    return null;
  }

  // ランダムに1件選択
  return unpostedItems[Math.floor(Math.random() * unpostedItems.length)];
}

/**
 * 投稿用コンテンツを生成
 */
function formatContent(item: RakutenItem, maxLength: number = 2000): string {
  const itemName = item.itemName || '商品名不明';
  const itemPrice = item.itemPrice?.toLocaleString() || '価格不明';
  const url = item.affiliateUrl || item.itemUrl || '';

  const content = `🛒【おすすめ商品】\n${itemName}\n💰 ${itemPrice}円\n🔗 ${url}`;
  return content.substring(0, maxLength);
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase の環境変数が設定されていません');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ========== 1. 公式ルーム（#official タグ付き）を検索 ==========
    const { data: spaces, error: spaceError } = await supabase
      .from('spaces')
      .select('id, name, owner_id, tags')
      .limit(100);

    if (spaceError) {
      throw new Error(`スペース検索エラー: ${spaceError.message}`);
    }

    // タグに 'official' が含まれるスペースを探す
    const officialSpace = spaces?.find((s: { tags?: string[] }) =>
      s.tags?.some((t: string) => t.replace(/^#/, '').toLowerCase() === 'official')
    );

    if (!officialSpace) {
      return new Response(
        JSON.stringify({ error: '公式ルームが見つかりません。タグ #official を付けたルームを作成してください。' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`公式ルーム発見: ${officialSpace.name} (ID: ${officialSpace.id})`);

    // ========== 2. そのスペースのデフォルトチャンネルを取得 ==========
    const { data: channels, error: channelError } = await supabase
      .from('channels')
      .select('id')
      .eq('space_id', officialSpace.id)
      .limit(1);

    if (channelError) {
      throw new Error(`チャンネル検索エラー: ${channelError.message}`);
    }

    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: '公式ルームのチャンネルが見つかりません' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const channelId = channels[0].id;
    console.log(`チャンネルID: ${channelId}`);

    // ========== 3. 重複チェック用に過去の投稿済み商品を取得 ==========
    const postedCodes = await getPostedItemCodes(supabase);
    console.log(`過去7日間の投稿済み商品数: ${postedCodes.size}`);

    // ========== 4. 楽天APIから未投稿商品を取得 ==========
    const item = await fetchRakutenItem(postedCodes);

    if (!item) {
      return new Response(
        JSON.stringify({ success: false, message: '未投稿の商品が見つかりませんでした' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`選択した商品: ${item.itemName?.substring(0, 50)}...`);

    // ========== 5. 並列投稿: メインフィード + ルーム ==========
    const feedContent = formatContent(item, 300);  // メインフィードは300文字制限
    const roomContent = formatContent(item, 2000); // ルームは2000文字制限

    // 商品画像URLを取得（最大1枚）
    const imageUrl = item.mediumImageUrls?.[0] || null;
    const attachments = imageUrl ? [{ url: imageUrl }] : [];
    console.log(`商品画像: ${imageUrl ? imageUrl.substring(0, 50) + '...' : 'なし'}`);

    const [postResult, messageResult] = await Promise.all([
      // メインフィード投稿（画像付き・広告フラグ）
      supabase.from('posts').insert({
        user_id: officialSpace.owner_id,
        body: feedContent,
        attachments: attachments,
        is_ad: true,
      }).select('id').single(),

      // ルーム投稿（画像付き）
      supabase.from('room_messages').insert({
        channel_id: channelId,
        sender_id: officialSpace.owner_id,
        content: roomContent,
        message_type: imageUrl ? 'image' : 'text',
        attachments: attachments,
      }).select('id').single(),
    ]);

    if (postResult.error) {
      console.error('メインフィード投稿エラー:', postResult.error);
    }
    if (messageResult.error) {
      console.error('ルーム投稿エラー:', messageResult.error);
    }

    // ========== 6. 投稿記録を保存 ==========
    const { error: recordError } = await supabase.from('posted_products').insert({
      rakuten_item_code: item.itemCode,
      product_name: item.itemName,
      price: item.itemPrice,
      affiliate_url: item.affiliateUrl || item.itemUrl,
      post_id: postResult.data?.id || null,
      room_message_id: messageResult.data?.id || null,
    });

    if (recordError) {
      console.error('投稿記録エラー:', recordError);
    }

    console.log('並列投稿成功');

    return new Response(
      JSON.stringify({
        success: true,
        item: {
          name: item.itemName,
          price: item.itemPrice,
          code: item.itemCode,
          image: imageUrl,
        },
        posted_to: {
          feed: postResult.data?.id ? true : false,
          room: messageResult.data?.id ? true : false,
        },
        space: officialSpace.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('エラー発生:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
