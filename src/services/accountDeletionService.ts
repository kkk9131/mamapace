import { secureLogger } from '../utils/privacyProtection';

import { getSupabaseClient } from './supabaseClient';

export class AccountDeletionError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AccountDeletionError';
    this.code = code;
  }
}

async function reauthenticate(email: string, password: string) {
  const client = getSupabaseClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new AccountDeletionError(
      error.message || '認証に失敗しました。パスワードを確認してください。',
      error.name,
    );
  }
}

export async function deleteMyAccount(password: string): Promise<void> {
  const client = getSupabaseClient();

  // 1) Ensure authenticated and get email
  const { data: userRes, error: getUserErr } = await client.auth.getUser();
  if (getUserErr) {
    secureLogger.error('deleteMyAccount: getUser failed', {
      error: getUserErr,
    });
  }
  const authUser = userRes?.user;
  if (!authUser) {
    throw new AccountDeletionError(
      '未認証のためアカウント削除できません。',
      'NOT_AUTH',
    );
  }
  const email = authUser.email;
  if (!email) {
    throw new AccountDeletionError(
      'メール/パスワードでログインしているアカウントのみ削除できます。',
      'NO_EMAIL',
    );
  }

  // 2) Re-authenticate with password to confirm user intent
  await reauthenticate(email, password);

  // 3) Invoke Edge Function to perform server-side deletion
  //    This function verifies the JWT and deletes both public.user_profiles and auth user
  try {
    const invoker = (client as any).functions?.invoke as
      | ((name: string, options: any) => Promise<{ data: unknown; error: any }>)
      | undefined;
    if (!invoker) {
      throw new AccountDeletionError(
        'エッジ関数の呼び出しが利用できません。',
        'NO_FUNCTIONS',
      );
    }

    const { data, error } = await (client as any).functions.invoke(
      'delete-account',
      { method: 'POST' }
    );
    if (error) {
      const status = (error as any)?.context?.status || (error as any)?.status;
      const message = (error as any)?.message || 'アカウント削除に失敗しました';
      throw new AccountDeletionError(
        message,
        String(status || 'FUNCTION_ERROR'),
      );
    }

    // Optional sanity: check shape
    if ((data as any)?.ok !== true) {
      throw new AccountDeletionError(
        'サーバー応答が不正です。',
        'BAD_RESPONSE',
      );
    }
  } catch (e: any) {
    if (e instanceof AccountDeletionError) {
      throw e;
    }
    secureLogger.error('deleteMyAccount: function invoke failed', { error: e });
    throw new AccountDeletionError(
      'アカウント削除に失敗しました。',
      'INVOKE_FAILED',
    );
  }
}

export const accountDeletionService = {
  deleteMyAccount,
};
