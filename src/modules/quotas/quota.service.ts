import { query } from '../../config/database';
import { subscriptionService, PLANS } from '../subscriptions/subscription.service';
import logger from '../../config/logger';

export class QuotaService {
  async getCurrentUsage(userId: string): Promise<{
    projects: number;
    storageMB: number;
  }> {
    const result = await query<{
      project_count: string;
      total_storage: string | null;
    }>(
      `SELECT 
        COUNT(*) as project_count,
        SUM(LENGTH(data::text) / 1024 / 1024) as total_storage
       FROM projects 
       WHERE user_id = $1 AND is_archived = false`,
      [userId]
    );

    return {
      projects: parseInt(result.rows[0]?.project_count || '0', 10),
      storageMB: parseFloat(result.rows[0]?.total_storage || '0')
    };
  }

  async checkQuota(userId: string, action: 'create_project' | 'upload_file'): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    reason?: string;
  }> {
    const { plan } = await subscriptionService.getCurrentPlan(userId);
    const usage = await this.getCurrentUsage(userId);

    if (action === 'create_project') {
      const limit = plan.quotas.maxProjects;
      const allowed = limit === -1 || usage.projects < limit;
      
      return {
        allowed,
        current: usage.projects,
        limit,
        reason: allowed ? undefined : `Project limit reached (${limit} projects)`
      };
    }

    if (action === 'upload_file') {
      const limit = plan.quotas.maxStorageMB;
      const allowed = limit === -1 || usage.storageMB < limit;
      
      return {
        allowed,
        current: Math.round(usage.storageMB),
        limit,
        reason: allowed ? undefined : `Storage limit reached (${limit} MB)`
      };
    }

    return { allowed: true, current: 0, limit: -1 };
  }

  async enforceQuota(userId: string, action: 'create_project' | 'upload_file'): Promise<void> {
    const check = await this.checkQuota(userId, action);
    
    if (!check.allowed) {
      throw new Error(check.reason || 'Quota exceeded');
    }
  }

  async getQuotaStatus(userId: string): Promise<{
    plan: string;
    quotas: {
      projects: { used: number; limit: number; available: number };
      storage: { used: number; limit: number; available: number };
    };
    features: string[];
  }> {
    const { plan } = await subscriptionService.getCurrentPlan(userId);
    const usage = await this.getCurrentUsage(userId);

    const maxProjects = plan.quotas.maxProjects;
    const maxStorage = plan.quotas.maxStorageMB;

    return {
      plan: plan.name,
      quotas: {
        projects: {
          used: usage.projects,
          limit: maxProjects,
          available: maxProjects === -1 ? -1 : Math.max(0, maxProjects - usage.projects)
        },
        storage: {
          used: Math.round(usage.storageMB),
          limit: maxStorage,
          available: maxStorage === -1 ? -1 : Math.max(0, maxStorage - usage.storageMB)
        }
      },
      features: plan.quotas.features
    };
  }
}

export const quotaService = new QuotaService();
