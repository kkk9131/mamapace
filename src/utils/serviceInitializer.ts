/**
 * SERVICE INITIALIZATION UTILITIES
 * 
 * Centralized service initialization and startup management
 * Ensures proper service order and dependency management
 * 
 * SECURITY FEATURES:
 * - Service health monitoring
 * - Initialization failure handling
 * - Startup performance tracking
 */

import { initializeSupabase, supabaseClient } from '../services/supabaseClient';
import { initializeEncryption, encryptionService } from '../services/encryptionService';
import { initializeSessionManager, sessionManager } from '../services/sessionManager';
import { initializeAuthService, authService } from '../services/authService';
import { secureLogger } from '../utils/privacyProtection';
import { appConfig } from '../config/appConfig';

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Service initialization status
 */
interface ServiceStatus {
  name: string;
  initialized: boolean;
  initTime: number | null;
  error: string | null;
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
}

/**
 * Overall initialization result
 */
interface InitializationResult {
  success: boolean;
  totalTime: number;
  services: ServiceStatus[];
  criticalErrors: string[];
  warnings: string[];
}

/**
 * Service health check result
 */
interface HealthCheckResult {
  service: string;
  healthy: boolean;
  responseTime: number;
  details?: any;
  timestamp: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const INITIALIZATION_CONFIG = {
  TIMEOUT_MS: 30000, // 30 seconds total timeout
  SERVICE_TIMEOUT_MS: 10000, // 10 seconds per service
  HEALTH_CHECK_INTERVAL_MS: 60000, // 1 minute
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY_MS: 1000
} as const;

// Service initialization order (dependencies first)
const SERVICES = [
  'supabase',
  'encryption',
  'sessionManager',
  'authService'
] as const;

type ServiceName = typeof SERVICES[number];

// =====================================================
// SERVICE INITIALIZER CLASS
// =====================================================

class ServiceInitializer {
  private static instance: ServiceInitializer;
  private initializationResult: InitializationResult | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ServiceInitializer {
    if (!ServiceInitializer.instance) {
      ServiceInitializer.instance = new ServiceInitializer();
    }
    return ServiceInitializer.instance;
  }

  // =====================================================
  // INITIALIZATION METHODS
  // =====================================================

  /**
   * Initializes all services in the correct order
   */
  async initializeAllServices(): Promise<InitializationResult> {
    if (this.isInitialized && this.initializationResult?.success) {
      return this.initializationResult;
    }

    const startTime = Date.now();
    const serviceStatuses: ServiceStatus[] = [];
    const criticalErrors: string[] = [];
    const warnings: string[] = [];

    secureLogger.info('Starting service initialization');

    try {
      // Initialize services in order
      for (const serviceName of SERVICES) {
        const serviceStatus = await this.initializeService(serviceName);
        serviceStatuses.push(serviceStatus);

        if (!serviceStatus.initialized) {
          if (this.isCriticalService(serviceName)) {
            criticalErrors.push(`Critical service ${serviceName} failed: ${serviceStatus.error}`);
          } else {
            warnings.push(`Service ${serviceName} failed: ${serviceStatus.error}`);
          }
        }
      }

      // Check if initialization was successful
      const criticalServicesOk = serviceStatuses
        .filter(s => this.isCriticalService(s.name as ServiceName))
        .every(s => s.initialized);

      const totalTime = Date.now() - startTime;

      this.initializationResult = {
        success: criticalServicesOk,
        totalTime,
        services: serviceStatuses,
        criticalErrors,
        warnings
      };

      if (criticalServicesOk) {
        this.isInitialized = true;
        this.startHealthChecks();
        
        secureLogger.info('Service initialization completed', {
          success: true,
          totalTime,
          services: serviceStatuses.length
        });
      } else {
        secureLogger.error('Critical service initialization failed', {
          criticalErrors,
          totalTime
        });
      }

      return this.initializationResult;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      secureLogger.error('Service initialization exception', {
        error,
        totalTime,
        completedServices: serviceStatuses.length
      });

      this.initializationResult = {
        success: false,
        totalTime,
        services: serviceStatuses,
        criticalErrors: [`Initialization failed: ${error}`],
        warnings
      };

      return this.initializationResult;
    }
  }

  /**
   * Initializes a single service with timeout and retry
   */
  private async initializeService(serviceName: ServiceName): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    secureLogger.debug(`Initializing ${serviceName} service`);

    const serviceStatus: ServiceStatus = {
      name: serviceName,
      initialized: false,
      initTime: null,
      error: null,
      healthStatus: 'unknown'
    };

    // Skip client encryption/session manager when disabled (Phase 2)
    if ((serviceName === 'encryption' || serviceName === 'sessionManager') && (appConfig.useServerHashing === true || (appConfig as any).disableClientEncryption)) {
      serviceStatus.initialized = true;
      serviceStatus.initTime = Date.now() - startTime;
      serviceStatus.healthStatus = 'healthy';
      secureLogger.info(`Skipping ${serviceName} initialization (client-side disabled)`);
      return serviceStatus;
    }

    for (let attempt = 1; attempt <= INITIALIZATION_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        await Promise.race([
          this.callServiceInitializer(serviceName),
          this.createTimeoutPromise(INITIALIZATION_CONFIG.SERVICE_TIMEOUT_MS)
        ]);

        const initTime = Date.now() - startTime;
        serviceStatus.initialized = true;
        serviceStatus.initTime = initTime;
        serviceStatus.healthStatus = 'healthy';

        secureLogger.debug(`${serviceName} service initialized`, {
          initTime,
          attempt
        });

        return serviceStatus;

      } catch (error) {
        const isLastAttempt = attempt === INITIALIZATION_CONFIG.RETRY_ATTEMPTS;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (isLastAttempt) {
          serviceStatus.error = errorMessage;
          serviceStatus.healthStatus = 'critical';
          
          secureLogger.error(`${serviceName} service initialization failed`, {
            error: errorMessage,
            attempts: attempt,
            initTime: Date.now() - startTime
          });
        } else {
          secureLogger.warn(`${serviceName} service initialization attempt ${attempt} failed`, {
            error: errorMessage,
            retryDelay: INITIALIZATION_CONFIG.RETRY_DELAY_MS
          });

          await this.delay(INITIALIZATION_CONFIG.RETRY_DELAY_MS);
        }
      }
    }

    return serviceStatus;
  }

  /**
   * Calls the appropriate service initializer
   */
  private async callServiceInitializer(serviceName: ServiceName): Promise<void> {
    switch (serviceName) {
      case 'supabase':
        await initializeSupabase();
        break;
      case 'encryption':
        await initializeEncryption();
        break;
      case 'sessionManager':
        await initializeSessionManager();
        break;
      case 'authService':
        await initializeAuthService();
        break;
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
  }

  // =====================================================
  // HEALTH MONITORING
  // =====================================================

  /**
   * Starts periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        secureLogger.error('Health check failed', { error });
      }
    }, INITIALIZATION_CONFIG.HEALTH_CHECK_INTERVAL_MS);

    secureLogger.debug('Health check monitoring started');
  }

  /**
   * Performs health checks on all services
   */
  async performHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    const servicesToCheck = (appConfig.useServerHashing || (appConfig as any).disableClientEncryption)
      ? [...SERVICES].filter(s => s !== 'encryption' && s !== 'sessionManager')
      : [...SERVICES];

    for (const serviceName of servicesToCheck) {
      const result = await this.checkServiceHealth(serviceName);
      results.push(result);
    }

    // Update service statuses
    if (this.initializationResult) {
      for (const result of results) {
        const serviceStatus = this.initializationResult.services.find(s => s.name === result.service);
        if (serviceStatus) {
          serviceStatus.healthStatus = result.healthy ? 'healthy' : 'critical';
        }
      }
    }

    // Log any unhealthy services
    const unhealthyServices = results.filter(r => !r.healthy);
    if (unhealthyServices.length > 0) {
      secureLogger.warn('Unhealthy services detected', {
        services: unhealthyServices.map(r => r.service),
        count: unhealthyServices.length
      });
    }

    return results;
  }

  /**
   * Checks health of a single service
   */
  private async checkServiceHealth(serviceName: ServiceName): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      let healthy = false;
      let details: any = null;

      switch (serviceName) {
        case 'supabase':
          const healthCheck = await supabaseClient.healthCheck();
          const rlsCheck = await supabaseClient.validateRLSEnabled();
          healthy = healthCheck.isHealthy && rlsCheck.isValid;
          details = { latency: healthCheck.latency, rls: rlsCheck };
          break;

        case 'encryption':
          const encryptionStats = encryptionService.getStats();
          healthy = encryptionStats.isInitialized;
          details = encryptionStats;
          break;

        case 'sessionManager':
          const sessionStats = sessionManager.getConfig();
          healthy = sessionStats.isInitialized;
          details = sessionStats;
          break;

        case 'authService':
          const initStatus = authService.getInitializationStatus();
          healthy = initStatus.authService;
          details = initStatus;
          break;

        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }

      return {
        service: serviceName,
        healthy,
        responseTime: Date.now() - startTime,
        details,
        timestamp: Date.now()
      };

    } catch (error) {
      secureLogger.error(`Health check failed for ${serviceName}`, { error });
      
      return {
        service: serviceName,
        healthy: false,
        responseTime: Date.now() - startTime,
        details: { error: String(error) },
        timestamp: Date.now()
      };
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Determines if a service is critical for app functionality
   */
  private isCriticalService(serviceName: ServiceName): boolean {
    const criticalServices: ServiceName[] = ['supabase', ...((appConfig.useServerHashing || (appConfig as any).disableClientEncryption) ? [] : ['sessionManager' as ServiceName,'encryption' as ServiceName])];
    return criticalServices.includes(serviceName);
  }

  /**
   * Creates a timeout promise
   */
  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Delays execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stops health monitoring
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================

  /**
   * Gets the current initialization result
   */
  getInitializationResult(): InitializationResult | null {
    return this.initializationResult;
  }

  /**
   * Checks if services are initialized
   */
  isServicesInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Gets current service health status
   */
  getServiceHealthStatus(): Record<string, 'healthy' | 'degraded' | 'critical' | 'unknown'> {
    if (!this.initializationResult) {
      return {};
    }

    const status: Record<string, 'healthy' | 'degraded' | 'critical' | 'unknown'> = {};
    
    for (const service of this.initializationResult.services) {
      status[service.name] = service.healthStatus;
    }

    return status;
  }

  /**
   * Gets comprehensive service statistics
   */
  getServiceStats() {
    return {
      initialization: this.initializationResult,
      isInitialized: this.isInitialized,
      healthStatus: this.getServiceHealthStatus(),
      services: {
        supabase: supabaseClient.getStats(),
        encryption: encryptionService.getStats(),
        sessionManager: sessionManager.getStats(),
        authService: authService.getServiceStats()
      }
    };
  }
}

// =====================================================
// SINGLETON EXPORT AND CONVENIENCE FUNCTIONS
// =====================================================

export const serviceInitializer = ServiceInitializer.getInstance();

/**
 * Initialize all authentication services
 * Should be called at app startup
 */
export const initializeAllServices = async (): Promise<InitializationResult> => {
  return await serviceInitializer.initializeAllServices();
};

/**
 * Check if services are ready
 */
export const areServicesReady = (): boolean => {
  return serviceInitializer.isServicesInitialized();
};

/**
 * Get current service health status
 */
export const getServiceHealth = (): Record<string, 'healthy' | 'degraded' | 'critical' | 'unknown'> => {
  return serviceInitializer.getServiceHealthStatus();
};

/**
 * Perform health checks manually
 */
export const checkServiceHealth = async (): Promise<HealthCheckResult[]> => {
  return await serviceInitializer.performHealthChecks();
};

/**
 * Get comprehensive service statistics
 */
export const getServiceStats = () => {
  return serviceInitializer.getServiceStats();
};

export default serviceInitializer;