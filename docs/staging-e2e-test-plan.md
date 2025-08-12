# Staging E2E Test Plan - Mamapace Production Migration

## Test Environment Setup

**Target Environment**: Staging Supabase project
**Test Users**: 2 unique email accounts
**Device**: iOS Simulator + Android Emulator
**Deep Link**: `mamapace://auth-callback`

## Pre-Test Checklist

- [ ] Staging Supabase project configured with production auth settings
- [ ] Site URL: `https://staging.mamapace.com`
- [ ] Additional Redirect URLs: `mamapace://auth-callback`
- [ ] Email confirmation: ENABLED
- [ ] v2 RPC functions deployed to staging
- [ ] App built with staging environment variables

## Test Scenario 1: User A - Primary Registration Flow

### 1.1 Registration with Email Verification
**Expected Duration**: 3-5 minutes
**User Email**: `test.user.a@mamapace.staging.com`

1. **Open App** → Initial screen loads
2. **Navigate to Sign Up** → Registration form displays
3. **Enter Details**:
   - Email: `test.user.a@mamapace.staging.com`
   - Password: `SecureTest123!`
   - Display Name: `Test User A`
   - Bio: `Staging test user for production migration`
4. **Submit Registration** → "メール認証が必要です" message displays
5. **Check Email** → Confirmation email received (check spam folder)
6. **Click Email Link** → Redirects to `mamapace://auth-callback`
7. **App Return** → Session established, user logged in
8. **Profile Setup** → Complete profile information

**Success Criteria**:
- ✅ Registration form submits without errors
- ✅ Confirmation email delivered within 30 seconds
- ✅ Deep link redirects to app successfully
- ✅ Session established within 2 seconds of email click
- ✅ User profile accessible and editable

### 1.2 Profile and Content Creation
**Expected Duration**: 2-3 minutes

1. **Update Profile**:
   - Avatar emoji: 👩‍💼
   - Bio: Extended bio with maternal health interests
2. **Create First Post**:
   - Content: "Testing production migration - first post from User A"
   - Verify post appears in feed
3. **Create Second Post**:
   - Content: "Second test post with engagement features"
   - Verify chronological order in feed

**Success Criteria**:
- ✅ Profile updates save and persist
- ✅ Posts appear in personal feed immediately
- ✅ Posts visible in home feed
- ✅ Post timestamps accurate

## Test Scenario 2: User B - Social Interaction Flow

### 2.1 Registration and Setup
**Expected Duration**: 3-5 minutes
**User Email**: `test.user.b@mamapace.staging.com`

1. **Complete Registration Flow** (same as 1.1)
2. **Setup Profile**:
   - Display Name: `Test User B`
   - Avatar emoji: 🤱
   - Bio: `Testing social features`

### 2.2 Social Interactions with User A
**Expected Duration**: 5-7 minutes

1. **Search and Follow User A**:
   - Use search functionality to find User A
   - Follow User A
   - Verify follow relationship established
2. **Engage with User A's Posts**:
   - React (like) to User A's first post
   - Comment on User A's second post: "Great test post!"
   - Verify reactions and comments appear immediately
3. **Test Realtime Updates**:
   - User A creates new post while User B watches feed
   - Verify new post appears without refresh
   - User A reacts to User B's comment
   - Verify notification/update received

**Success Criteria**:
- ✅ Follow/unfollow functionality works
- ✅ Reactions toggle correctly
- ✅ Comments appear immediately after posting
- ✅ Realtime updates work for posts/reactions/comments/follows
- ✅ No duplicate notifications or updates

## Test Scenario 3: v2 RPC Validation

### 3.1 Authenticated Operations
**Both Users**: Test all v2 RPC functions

1. **Profile Operations**:
   - `get_my_profile_v2` → Returns correct user data
   - `update_my_profile_v2` → Updates persist correctly
2. **Social Operations**:
   - `follow_user_v2` → Creates follow relationship
   - `unfollow_user_v2` → Removes follow relationship
3. **Post Operations**:
   - `create_post_v2` → Creates post with correct user_id
   - `delete_post_v2` → Removes own posts only
4. **Reaction Operations**:
   - `add_reaction_v2` → Adds reaction to any post
   - `remove_reaction_v2` → Removes own reactions

### 3.2 Security Validation
**Test Unauthorized Access**: 

1. **Logout User A** → Attempt v2 RPC calls
2. **Expected**: All calls return authentication errors
3. **Error Messages**: Generic, no internal details exposed
4. **Cross-User Operations**: User B cannot delete User A's posts

**Success Criteria**:
- ✅ All v2 RPC functions work for authenticated users
- ✅ Unauthenticated calls properly rejected
- ✅ Cross-user operations blocked by RLS
- ✅ Error messages are generic and safe

## Test Scenario 4: Edge Cases and Error Handling

### 4.1 Network Interruptions
1. **Disconnect Network** during post creation
2. **Reconnect** → Verify retry mechanism works
3. **Background App** during email confirmation
4. **Return to App** → Session should persist

### 4.2 Email Delivery Issues
1. **Use Invalid Email** for registration
2. **Verify Error Handling** → Clear error message
3. **Resend Confirmation** → Test rate limiting

### 4.3 Deep Link Edge Cases
1. **Click Email Link Multiple Times**
2. **Open Link in Different Browser**
3. **Manual Deep Link**: `mamapace://auth-callback?token=invalid`

**Success Criteria**:
- ✅ Graceful handling of network issues
- ✅ Session persistence across app states
- ✅ Clear error messages for all failure modes
- ✅ Rate limiting prevents abuse
- ✅ Invalid deep links handled safely

## Performance Validation

### 4.1 Response Time Metrics
- **Registration**: <3 seconds (excluding email delivery)
- **Email Delivery**: <30 seconds
- **Deep Link Redirect**: <2 seconds
- **v2 RPC Calls**: <500ms average
- **Realtime Updates**: <1 second delay

### 4.2 Resource Usage
- **Memory Usage**: Stable, no leaks during 30-minute session
- **Battery Impact**: Normal for active social app usage
- **Network Usage**: Efficient, no excessive requests

## Test Completion Checklist

### Functional Requirements
- [ ] Email confirmation flow works end-to-end
- [ ] Deep link `mamapace://auth-callback` redirects correctly
- [ ] Session establishment within 2 seconds of email click
- [ ] All v2 RPC functions work for authenticated users
- [ ] RLS policies block unauthorized access
- [ ] Realtime updates work for all subscription channels
- [ ] Generic error messages, no sensitive data exposure

### Performance Requirements  
- [ ] Registration success rate >95% (19/20 attempts)
- [ ] Email delivery rate >90% (9/10 emails delivered)
- [ ] Deep link success rate >98% (49/50 redirects work)
- [ ] v2 RPC average response time <500ms
- [ ] Realtime update delay <1 second

### Security Requirements
- [ ] Direct table access properly blocked (REVOKE enforced)
- [ ] Cross-user operations blocked by RLS
- [ ] Email rate limiting prevents abuse
- [ ] Session tokens properly secured in AsyncStorage
- [ ] Error messages reveal no internal structure

## Test Report Template

### Summary
- **Total Test Duration**: X hours
- **Test Cases Executed**: X/X
- **Pass Rate**: X%
- **Critical Issues**: X
- **Medium Issues**: X
- **Performance**: PASS/FAIL

### Issues Found
1. **Issue**: Description
   - **Severity**: Critical/Medium/Low
   - **Steps to Reproduce**: ...
   - **Expected**: ...
   - **Actual**: ...
   - **Resolution**: ...

### Performance Metrics
- **Registration Success**: X% (X/X)
- **Email Delivery**: X% (X/X delivered within 30s)
- **Deep Link Success**: X% (X/X redirects successful)
- **Avg RPC Response**: Xms
- **Realtime Delay**: Xms

### Recommendation
- [ ] **PROCEED TO PRODUCTION**: All tests pass, performance acceptable
- [ ] **REQUIRES FIXES**: Critical issues must be resolved first
- [ ] **NEEDS OPTIMIZATION**: Performance improvements needed

### Next Steps
1. Address any critical issues found
2. Optimize performance bottlenecks  
3. Update production migration plan based on findings
4. Schedule production deployment