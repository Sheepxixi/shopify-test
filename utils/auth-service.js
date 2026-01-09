/**
 * 权限验证服务 - 统一管理身份验证和授权
 * 
 * 职责：
 * - 管理员白名单管理
 * - 权限验证
 * - 邮箱验证
 */

class AuthService {
  constructor() {
    this.adminWhitelist = this.parseAdminWhitelist();
  }

  /**
   * 从环境变量解析管理员白名单
   * @returns {Array<string>} 管理员邮箱列表（小写）
   */
  parseAdminWhitelist() {
    const raw = process.env.ADMIN_EMAIL_WHITELIST || 
                'jonathan.wang@sainstore.com,issac.yu@sainstore.com';
    return raw
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);
  }

  /**
   * 规范化邮箱地址
   * @param {string} email - 原始邮箱
   * @returns {string} 规范化后的邮箱（小写，去空格）
   */
  normalizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }
    return email.trim().toLowerCase();
  }

  /**
   * 验证邮箱格式
   * @param {string} email - 邮箱地址
   * @returns {boolean} 是否有效
   */
  isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 检查是否为管理员
   * @param {string} email - 用户邮箱
   * @returns {boolean} 是否为管理员
   */
  isAdmin(email) {
    const normalizedEmail = this.normalizeEmail(email);
    return this.adminWhitelist.includes(normalizedEmail);
  }

  /**
   * 检查是否具有管理员权限（基于请求参数）
   * @param {object} params - 请求参数
   * @param {string} params.email - 用户邮箱
   * @param {string|boolean} params.admin - admin 标志
   * @returns {boolean} 是否具有管理员权限
   */
  hasAdminPermission({ email, admin }) {
    const normalizedEmail = this.normalizeEmail(email);
    
    // admin 参数必须是 '1', 'true', 'yes' 之一
    const adminFlag = ['1', 'true', 'yes'].includes(
      String(admin || '').toLowerCase()
    );
    
    // 必须同时满足：admin 标志为 true 且邮箱在白名单中
    return adminFlag && this.isAdmin(normalizedEmail);
  }

  /**
   * 验证请求所需的邮箱参数
   * @param {string} email - 邮箱地址
   * @returns {object} { valid: boolean, error?: string }
   */
  validateEmail(email) {
    const normalizedEmail = this.normalizeEmail(email);
    
    if (!normalizedEmail) {
      return {
        valid: false,
        error: 'missing_email',
        message: '缺少客户邮箱，无法验证身份'
      };
    }

    if (!this.isValidEmail(normalizedEmail)) {
      return {
        valid: false,
        error: 'invalid_email',
        message: `邮箱格式无效: ${normalizedEmail}`
      };
    }

    return { valid: true };
  }

  /**
   * 验证 Draft Order 所有权（非管理员必须验证）
   * @param {string} requesterEmail - 请求者邮箱
   * @param {string} orderEmail - 订单所属邮箱
   * @param {boolean} isAdmin - 是否为管理员
   * @returns {object} { authorized: boolean, error?: string }
   */
  verifyDraftOrderOwnership(requesterEmail, orderEmail, isAdmin = false) {
    // 管理员跳过所有权验证
    if (isAdmin) {
      return { authorized: true };
    }

    const normalizedRequester = this.normalizeEmail(requesterEmail);
    const normalizedOrder = this.normalizeEmail(orderEmail);

    if (!normalizedOrder || normalizedOrder !== normalizedRequester) {
      return {
        authorized: false,
        error: 'forbidden',
        message: '仅允许访问本人未支付的询价单'
      };
    }

    return { authorized: true };
  }

  /**
   * 从请求中提取认证信息
   * @param {object} req - 请求对象
   * @returns {object} { email: string, isAdmin: boolean }
   */
  extractAuthFromRequest(req) {
    // 支持从 body (POST) 或 query (GET) 中获取
    const email = req.body?.email || req.query?.email || '';
    const admin = req.body?.admin || req.query?.admin || '';
    
    const normalizedEmail = this.normalizeEmail(email);
    const isAdmin = this.hasAdminPermission({ email: normalizedEmail, admin });

    return {
      email: normalizedEmail,
      isAdmin
    };
  }
}

// 导出单例实例
export const authService = new AuthService();

// 也导出类以便测试
export default AuthService;