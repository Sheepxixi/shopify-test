/**
 * 统一错误处理工具
 * 
 * 职责：
 * - 统一错误响应格式
 * - 错误日志记录
 * - HTTP 状态码映射
 */

/**
 * 创建标准错误响应
 * @param {object} options - 错误选项
 * @param {number} options.status - HTTP 状态码
 * @param {string} options.error - 错误代码
 * @param {string} options.message - 错误消息
 * @param {any} options.details - 错误详情（可选）
 * @returns {object} 标准错误响应对象
 */
export function createErrorResponse({ status = 500, error, message, details }) {
  const response = {
    success: false,
    error: error || 'unknown_error',
    message: message || '操作失败',
    timestamp: new Date().toISOString()
  };

  if (details !== undefined) {
    response.details = details;
  }

  return { status, body: response };
}

/**
 * 创建成功响应
 * @param {object} data - 响应数据
 * @param {number} status - HTTP 状态码（默认 200）
 * @param {string} message - 成功消息（可选）
 * @returns {object} 标准成功响应对象
 */
export function createSuccessResponse(data = {}, status = 200, message) {
  const response = {
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  };

  if (message) {
    response.message = message;
  }

  return { status, body: response };
}

/**
 * 处理错误并返回标准响应
 * @param {Error|object|string} error - 错误对象或消息
 * @param {object} res - Express 响应对象
 * @param {object} options - 选项
 * @param {number} options.defaultStatus - 默认状态码
 * @param {string} options.context - 错误上下文（用于日志）
 * @returns {object} 错误响应
 */
export function handleError(error, res, options = {}) {
  const {
    defaultStatus = 500,
    context = '操作'
  } = options;

  // 提取错误信息
  let status = defaultStatus;
  let errorCode = 'unknown_error';
  let errorMessage = '操作失败';

  if (error instanceof Error) {
    errorMessage = error.message;
    
    // 根据错误消息判断错误类型
    if (error.message.includes('配置缺失') || error.message.includes('Missing')) {
      status = 500;
      errorCode = 'configuration_error';
    } else if (error.message.includes('GraphQL') || error.message.includes('API')) {
      status = 502;
      errorCode = 'shopify_api_error';
    } else if (error.message.includes('forbidden') || error.message.includes('无权')) {
      status = 403;
      errorCode = 'forbidden';
    } else if (error.message.includes('未找到') || error.message.includes('不存在')) {
      status = 404;
      errorCode = 'not_found';
    } else if (error.message.includes('缺少') || error.message.includes('Missing')) {
      status = 400;
      errorCode = 'missing_parameter';
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    errorCode = error.error || errorCode;
    errorMessage = error.message || errorMessage;
    status = error.status || defaultStatus;
  }

  // 记录错误日志
  console.error(`❌ ${context}失败:`, {
    error: errorMessage,
    code: errorCode,
    status,
    stack: error instanceof Error ? error.stack : undefined
  });

  // 返回错误响应
  const errorResponse = createErrorResponse({
    status,
    error: errorCode,
    message: errorMessage
  });

  if (res) {
    return res.status(errorResponse.status).json(errorResponse.body);
  }

  return errorResponse;
}

/**
 * 异步函数错误处理包装器
 * @param {Function} fn - 异步函数
 * @param {object} options - 选项
 * @returns {Function} 包装后的函数
 */
export function asyncHandler(fn, options = {}) {
  return async (req, res, ...args) => {
    try {
      return await fn(req, res, ...args);
    } catch (error) {
      return handleError(error, res, options);
    }
  };
}

/**
 * 常见错误代码映射
 */
export const ErrorCodes = {
  MISSING_EMAIL: 'missing_email',
  INVALID_EMAIL: 'invalid_email',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFIGURATION_ERROR: 'configuration_error',
  SHOPIFY_API_ERROR: 'shopify_api_error',
  MISSING_PARAMETER: 'missing_parameter',
  METHOD_NOT_ALLOWED: 'method_not_allowed',
  VALIDATION_ERROR: 'validation_error'
};

/**
 * 常见 HTTP 状态码
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
};