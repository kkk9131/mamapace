# Operations Monitoring & Rollback - Mamapace Production Migration

## Monitoring Strategy

### Core Metrics Dashboard

#### Authentication Metrics
```bash
# Registration Success Rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_registrations,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed,
  ROUND(COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as confirmation_rate
FROM auth.users 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

# Authentication Error Rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN last_sign_in_at IS NULL THEN 1 END) as failed_signins,
  ROUND(COUNT(CASE WHEN last_sign_in_at IS NULL THEN 1 END) * 100.0 / COUNT(*), 2) as failure_rate
FROM auth.users 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE(created_at);
```

#### Performance Metrics
```bash
# v2 RPC Performance
-- Monitor via Supabase Dashboard > API > RPC Functions
-- Target: <500ms average response time
-- Alert: >1000ms or >5% error rate

# Deep Link Success Rate
-- Monitor via app analytics (Firebase/Mixpanel)
-- Target: >98% success rate
-- Track: mamapace://auth-callback redirects

# Email Delivery Metrics
-- Monitor via Supabase Auth logs
-- Target: >90% delivery within 30 seconds
-- Alert: <80% delivery rate
```

### Alerting Thresholds

#### Critical Alerts (Immediate Response)
- **Auth Failure Rate >20%**: Authentication system issues
- **Email Delivery <50%**: Critical email delivery failure
- **Deep Link Failure >10%**: App store/OS deep link issues
- **v2 RPC Error Rate >10%**: Database or RLS configuration issues
- **Zero Successful Registrations >30 minutes**: Complete system failure

#### Warning Alerts (Monitor Closely)
- **Auth Failure Rate >10%**: Potential authentication issues
- **Email Delivery <80%**: Email delivery degradation
- **Deep Link Failure >5%**: Potential OS/browser issues
- **v2 RPC Response Time >1s**: Performance degradation
- **Registration Rate Drop >50%**: User experience issues

#### Info Alerts (Track Trends)
- **Auth Failure Rate >5%**: Normal operational variance
- **Email Delivery <90%**: Baseline performance monitoring
- **v2 RPC Response Time >500ms**: Performance awareness

### Monitoring Implementation

#### Supabase Dashboard Monitoring
1. **Authentication > Users**: Monitor registration and confirmation rates
2. **API > Logs**: Track RPC function performance and errors
3. **Database > Logs**: Monitor query performance and errors
4. **Auth > Settings**: Verify configuration remains correct

#### Application Performance Monitoring
1. **Sentry/Crashlytics**: Application error tracking
2. **Firebase Analytics**: User flow and deep link success
3. **Custom Logging**: secureLogger output for auth events
4. **Network Monitoring**: API response times and failure rates

#### Manual Verification Checks
```bash
# Daily Health Check Script
echo "=== Mamapace Production Health Check ==="
echo "Date: $(date)"
echo ""

# 1. Test Registration Flow
echo "1. Testing registration endpoint..."
curl -X POST https://your-project.supabase.co/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"health-check@test.com","password":"TestPass123!"}'

# 2. Test v2 RPC Functions  
echo "2. Testing authenticated RPC..."
# (Requires valid session token)

# 3. Check Email Service
echo "3. Checking email delivery..."
# Monitor email delivery metrics

# 4. Deep Link Validation
echo "4. Testing deep link scheme..."
# Test mamapace://auth-callback on test devices

echo "Health check completed."
```

## Rollback Procedures

### Immediate Rollback Triggers
- **Registration Success Rate <50%** for >15 minutes
- **Email Delivery Rate <30%** for >10 minutes  
- **Deep Link Failure Rate >30%** for >5 minutes
- **v2 RPC Error Rate >30%** for >5 minutes
- **Security Incident**: Unauthorized access detected

### Rollback Plan A: Auth Configuration Rollback

#### Trigger Conditions
- Email delivery issues
- Deep link redirection problems
- Auth configuration errors

#### Rollback Steps
1. **Supabase Dashboard Changes**:
   ```bash
   # Revert Auth Settings
   Site URL: Previous production URL
   Redirect URLs: Remove mamapace://auth-callback if problematic
   Confirm Email: DISABLE if causing issues
   ```

2. **Application Configuration**:
   ```bash
   # Revert to previous app.json if needed
   git checkout HEAD~1 -- app.json
   
   # Remove deep link handling temporarily
   # Update auth redirect to web-based flow
   ```

3. **Verification**:
   - Test registration with reverted settings
   - Verify email delivery improvement
   - Confirm auth flow works without deep links

#### Estimated Rollback Time: 15-30 minutes

### Rollback Plan B: v2 RPC Rollback

#### Trigger Conditions
- v2 RPC functions failing
- RLS policy issues
- Database permission problems

#### Rollback Steps
1. **Database Changes**:
   ```sql
   -- Restore anon role access temporarily (EMERGENCY ONLY)
   GRANT USAGE ON SCHEMA public TO anon;
   GRANT SELECT ON posts TO anon;
   GRANT SELECT ON post_reactions TO anon;
   GRANT SELECT ON post_comments TO anon;
   
   -- Restore v1 RPC functions if available
   -- (Only if v1 functions were preserved)
   ```

2. **Application Changes**:
   ```bash
   # Revert to previous service implementation
   git checkout HEAD~1 -- src/services/
   
   # Redeploy app with v1 RPC calls
   # (Requires pre-existing fallback implementation)
   ```

3. **Verification**:
   - Test all core app functionality
   - Verify posts, reactions, comments work
   - Confirm security is maintained

#### Estimated Rollback Time: 45-90 minutes

### Rollback Plan C: Complete Migration Rollback

#### Trigger Conditions
- Multiple system failures
- Security breach
- Unrecoverable configuration state

#### Rollback Steps
1. **Database Snapshot Restoration**:
   ```bash
   # Restore from pre-migration snapshot
   # (Requires pre-created database backup)
   # Data loss: All changes since migration
   ```

2. **Application Deployment**:
   ```bash
   # Deploy previous stable release
   git checkout [previous-stable-tag]
   
   # Restore previous environment configuration
   # Redeploy app to app stores if necessary
   ```

3. **Configuration Restoration**:
   - Restore all Supabase settings to pre-migration state
   - Verify all services return to normal operation
   - Implement temporary auth flow if needed

#### Estimated Rollback Time: 2-4 hours

### Emergency Procedures

#### Security Incident Response
1. **Immediate Actions**:
   ```sql
   -- REVOKE all anon access immediately
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
   REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
   
   -- Disable auth endpoints if compromised
   -- (Via Supabase dashboard)
   ```

2. **Assessment**:
   - Identify scope of security incident
   - Determine if data was accessed/modified
   - Assess need for user notification

3. **Recovery**:
   - Apply security patches
   - Reset compromised credentials
   - Re-enable services incrementally with monitoring

#### Communication Plan
- **Engineering Team**: Slack #incidents channel + on-call rotation
- **Management**: Incident severity determines escalation path
- **Users**: Status page + in-app notifications for major incidents
- **Regulatory**: Security incident reporting if required

### Post-Rollback Actions

#### Immediate (0-2 hours)
1. **Incident Documentation**:
   - Root cause analysis
   - Timeline of events
   - Actions taken and results
   - Lessons learned

2. **System Stabilization**:
   - Monitor reverted system for stability
   - Verify all core functionality working
   - Check user impact and satisfaction

3. **Communication**:
   - Internal incident report
   - User communication if service was affected
   - Stakeholder briefing

#### Short-term (2-24 hours)
1. **Investigation**:
   - Detailed analysis of failure causes
   - Identification of preventive measures
   - Testing of fixes in staging environment

2. **Planning**:
   - Revised migration approach if needed
   - Additional monitoring/testing requirements
   - Updated rollback procedures

#### Long-term (1-7 days)
1. **Process Improvement**:
   - Enhanced monitoring and alerting
   - Additional automated tests
   - Improved deployment procedures

2. **Re-migration Planning**:
   - Address root causes identified
   - Enhanced testing and validation
   - Staged rollout approach

## Monitoring Tools and Dashboards

### Supabase Native Monitoring
- **Dashboard > Overview**: Real-time metrics
- **Auth > Users**: Registration and confirmation trends  
- **API > Logs**: Function performance and errors
- **Database > Performance**: Query performance

### External Monitoring Integration
```typescript
// Application monitoring setup
import * as Sentry from '@sentry/react-native';

// Performance monitoring
Sentry.addGlobalEventProcessor((event) => {
  if (event.tags?.function_name?.startsWith('v2_')) {
    // Track v2 RPC performance
    event.tags.migration_related = true;
  }
  return event;
});

// Custom metrics for auth flow
const trackAuthEvent = (event: string, metadata?: any) => {
  Sentry.addBreadcrumb({
    message: `Auth: ${event}`,
    category: 'auth',
    data: metadata,
    level: 'info'
  });
};
```

### Alert Integration
```bash
# Webhook integration for critical alerts
curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 CRITICAL: Mamapace auth failure rate >20%",
    "attachments": [{
      "color": "danger",
      "fields": [{
        "title": "Current Failure Rate",
        "value": "25%",
        "short": true
      }, {
        "title": "Duration",
        "value": "15 minutes",
        "short": true
      }]
    }]
  }'
```

## Success Metrics for Stable Operation

### 24-Hour Stability Window
- **Registration Success Rate**: >95%
- **Email Delivery Rate**: >90%
- **Deep Link Success Rate**: >98%
- **v2 RPC Error Rate**: <2%
- **Average Response Time**: <500ms
- **Zero Critical Incidents**: No rollbacks triggered

### Weekly Performance Baseline
- **User Growth**: Maintained or improved
- **Engagement Metrics**: No degradation
- **Error Rates**: Stable or decreased
- **Performance**: Maintained or improved
- **Security Incidents**: Zero

Migration is considered successful and stable when all metrics remain within acceptable ranges for 7 consecutive days with no rollback procedures triggered.