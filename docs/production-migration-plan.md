# Production Migration Plan - Mamapace Supabase Auth

## Migration Overview

**Target**: Production-ready Supabase Auth configuration with email verification
**Branch**: `release/production`
**Environment**: React Native + Expo + Supabase

## Critical Requirements ✅

- **v2 RPC only**: NO GRANT to anon role (enforced in SQL)
- **Direct DML REVOKE**: Maintained on all tables (security constraint)
- **Limited Realtime**: posts/post_reactions/post_comments/user_follows only
- **Generic error messages**: No internal structure exposure

## Task 1: Supabase Auth Settings Configuration ✅

### Required Settings (Configure in Supabase Dashboard)

**Authentication > Settings**:
1. **Site URL**: `https://app.mamapace.com` (production HTTPS only)
2. **Additional Redirect URLs**: `mamapace://auth-callback`
3. **Confirm email**: ENABLED
4. **Email rate limiting**: 60 requests/hour (default)
5. **SMTP Provider**: Use built-in or configure custom SMTP

### Implementation Status
- ✅ Deep link scheme: `mamapace://` configured in app.json
- ✅ Auth redirect URL: `mamapace://auth-callback` implemented in AuthContext (line 317)
- ✅ Email confirmation flow with proper error handling
- ✅ Rate limiting and resend handling via auth.resend, admin.generateLink

## Task 2: Deep Link Recovery Flow ✅

### Current Implementation
- **Registration**: `supabaseAuthAdapter.signUp()` → email confirmation → `mamapace://auth-callback`
- **Confirmation**: User clicks email link → redirects to app → session establishment
- **Error Handling**: "メール認証が必要です" message for unconfirmed emails
- **v2 RPC Guards**: Unauthenticated calls properly rejected

### Verification Checklist
- [x] Email confirmation redirects to `mamapace://auth-callback`
- [x] App handles deep link return and establishes session
- [x] v2 RPC functions enforce authentication
- [x] Graceful error messages for unconfirmed users

## Task 3: Production Environment Configuration

### Required Environment Variables
```bash
# Production Supabase Settings (Set in hosting environment)
EXPO_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[anon-key]

# Security Settings
ENABLE_SECURITY_LOGGING=true
ENABLE_AUDIT_TRAIL=true
ENABLE_RATE_LIMITING=true
API_RATE_LIMIT_PER_MINUTE=60
```

### Build Configuration
- **app.json**: Currently has empty SUPABASE_URL/SUPABASE_ANON_KEY (environment-based)
- **supabaseClient.ts**: Reads from Constants.expoConfig.extra or process.env
- **Security**: Credentials never hardcoded, environment-based only

## Task 4: Staging E2E Testing Protocol

### Test Scenarios (2 Users)
1. **User A - Registration Flow**:
   - Register with email/password
   - Receive confirmation email
   - Click email link → `mamapace://auth-callback`
   - Verify session establishment
   - Create profile, make posts

2. **User B - Social Interaction**:
   - Register and confirm email
   - Follow User A
   - React to User A's posts
   - Comment on posts
   - Test Realtime updates

### v2 RPC Validation
- Profile operations: `get_my_profile_v2`, `update_my_profile_v2`
- Social operations: `follow_user_v2`, `unfollow_user_v2`
- Post operations: `create_post_v2`, `delete_post_v2`
- Reaction operations: `add_reaction_v2`, `remove_reaction_v2`

### Expected Results
- ✅ Email confirmation → session establishment
- ✅ v2 RPC functions work with authenticated users
- ✅ RLS permissions enforced correctly
- ✅ Realtime updates for posts/reactions/comments/follows
- ✅ Generic error messages for auth failures

## Task 5: Operations & Monitoring

### Monitoring Metrics
- **Auth Success Rate**: Registration/login success %
- **Email Delivery**: Confirmation email delivery rate
- **Deep Link Success**: `mamapace://auth-callback` success rate
- **RPC Performance**: v2 function response times
- **Error Rates**: Authentication and RPC error rates

### Rollback Procedures
1. **Auth Settings Rollback**: Disable email confirmation if issues
2. **Deep Link Fallback**: Manual email verification instructions
3. **Database Rollback**: Snapshot before v2 RPC deployment
4. **Code Rollback**: Git revert to stable commit

### Emergency Procedures
- **v2 RPC REVOKE**: Remove anon access if security breach
- **Rate Limiting**: Increase limits if legitimate traffic blocked
- **SMTP Fallback**: Switch to alternative email provider

## Task 6: Security Validation

### Current Security Implementation
- ✅ **Supabase Client**: Secure session handling with AsyncStorage
- ✅ **Auth Events**: Comprehensive logging for SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
- ✅ **Request Interceptor**: RPC call monitoring and sanitized logging
- ✅ **Session Management**: Auto-refresh with 5-minute monitoring intervals
- ✅ **Error Handling**: Generic error messages, no sensitive data exposure

### RLS Verification
- Critical tables: `user_profiles`, `auth_sessions`, `security_audit_log`
- v2 RPC functions respect RLS policies
- Direct DML REVOKE maintained for anon role

## Risk Assessment

### High Risk
- **Email Delivery**: Confirmation emails in spam/blocked
- **Deep Link Handler**: OS-level deep link conflicts
- **Session Persistence**: AsyncStorage corruption

### Medium Risk
- **Rate Limiting**: Legitimate users blocked
- **SMTP Reliability**: Built-in email provider issues
- **v2 RPC Performance**: Increased function call latency

### Low Risk
- **Schema Changes**: Minimal database modifications
- **Client Updates**: Stable Supabase client library

## Deployment Checklist

### Pre-Deployment
- [ ] Verify Supabase project URL and keys
- [ ] Configure auth settings in Supabase dashboard
- [ ] Set up monitoring alerts
- [ ] Prepare rollback procedures
- [ ] Test email delivery in staging

### Deployment
- [ ] Deploy app with production environment variables
- [ ] Verify deep link handling on iOS/Android
- [ ] Monitor email confirmation rates
- [ ] Test v2 RPC functions with real users
- [ ] Validate Realtime functionality

### Post-Deployment
- [ ] Monitor auth success rates for 24 hours
- [ ] Check email delivery metrics
- [ ] Verify deep link analytics
- [ ] Review security logs for anomalies
- [ ] Document any issues and resolutions

## Success Criteria

- **Registration Success Rate**: >95%
- **Email Confirmation Rate**: >90%
- **Deep Link Success Rate**: >98%
- **Session Establishment**: <2 seconds after email click
- **v2 RPC Performance**: <500ms average response time
- **Zero Security Incidents**: No unauthorized access or data exposure

## Next Steps

1. **Configure Supabase Dashboard** settings per Task 1
2. **Deploy to staging** for E2E testing
3. **Execute User Testing** scenarios per Task 4
4. **Monitor and validate** all metrics
5. **Deploy to production** with full monitoring
6. **Document final configuration** and lessons learned
