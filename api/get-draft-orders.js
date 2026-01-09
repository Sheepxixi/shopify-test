import { setCorsHeaders } from '../utils/cors-config.js';
import { draftOrderService } from '../services/draft-order-service.js';
import { authService } from '../utils/auth-service.js';
import { shopifyClient } from '../utils/shopify-client.js';
import { handleError, createSuccessResponse, HttpStatus, ErrorCodes } from '../utils/error-handler.js';

/**
 * ═══════════════════════════════════════════════════════════════
 * 获取 Draft Orders 列表 API - 管理端使用
 * ═══════════════════════════════════════════════════════════════
 * 
 * 功能：获取所有 Draft Orders 列表供管理端显示
 * 
 * 用途：
 * - 管理端显示所有询价单
 * - 支持状态过滤
 * - 提供统计信息
 * 
 * 请求示例：
 * GET /api/get-draft-orders?status=pending&limit=20&email=user@example.com&admin=true
 * 
 * 响应示例：
 * {
 *   "success": true,
 *   "draftOrders": [...],
 *   "total": 10,
 *   "pending": 5,
 *   "quoted": 5
 * }
 */

export default async function handler(req, res) {
  // 设置CORS头
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(HttpStatus.NO_CONTENT).end();
  }

  // 只接受GET请求
  if (req.method !== 'GET') {
    return res.status(HttpStatus.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
  }

  try {
    console.log('开始获取Draft Orders列表...');

    // 检查 Shopify 配置
    if (!shopifyClient.isConfigured()) {
      console.log('环境变量未配置，返回模拟数据');
      
      // 返回模拟数据
      return res.status(HttpStatus.OK).json({
        success: true,
        message: '环境变量未配置，返回模拟数据',
        draftOrders: [
          {
            id: 'gid://shopify/DraftOrder/1234567890',
            name: '#D1001',
            email: 'customer@example.com',
            status: 'pending',
            totalPrice: '99.00',
            createdAt: new Date().toISOString(),
            lineItems: [
              {
                title: '3D打印服务',
                quantity: 1,
                originalUnitPrice: '99.00'
              }
            ]
          },
          {
            id: 'gid://shopify/DraftOrder/1234567891',
            name: '#D1002',
            email: 'test@example.com',
            status: 'quoted',
            totalPrice: '199.00',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            lineItems: [
              {
                title: '3D打印服务',
                quantity: 2,
                originalUnitPrice: '99.50'
              }
            ]
          }
        ],
        total: 2,
        pending: 1,
        quoted: 1,
        note: '这是模拟数据，请配置环境变量后重新部署'
      });
    }

    // 获取查询参数
    const { status, limit = 50 } = req.query;

    // 提取认证信息
    const { email: requesterEmail, isAdmin: isAdminRequest } = authService.extractAuthFromRequest(req);

    // 验证邮箱
    const emailValidation = authService.validateEmail(requesterEmail);
    if (!emailValidation.valid) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        error: emailValidation.error,
        message: emailValidation.message
      });
    }

    // 验证管理员权限
    if (req.query.admin && !isAdminRequest) {
      console.warn('❌ 管理员权限被拒绝:', {
        requesterEmail,
        adminWhitelist: authService.parseAdminWhitelist()
      });
      return res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        error: ErrorCodes.FORBIDDEN,
        message: `您无权查看全部询价单。当前邮箱: ${requesterEmail}`
      });
    }

    // 获取 Draft Orders 列表
    const result = await draftOrderService.getDraftOrders({
      requesterEmail,
      isAdmin: isAdminRequest,
      status,
      limit: parseInt(limit, 10) || 50
    });

    // 返回成功响应
    const response = createSuccessResponse({
      ...result,
      message: 'Draft Orders获取成功'
    });

    return res.status(response.status).json(response.body);

  } catch (error) {
    return handleError(error, res, { context: '获取Draft Orders' });
  }
}
