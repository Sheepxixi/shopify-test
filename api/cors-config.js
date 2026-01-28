/**
 * 统一配置管理 - CORS 和管理员邮箱
 * 
 * 统一管理所有允许的 Shopify 域名和管理员邮箱，避免在多个文件中重复配置
 * 
 * CORS 使用方法：
 *   setCorsHeaders(req, res); // 默认方法：GET,POST,OPTIONS
 *   setCorsHeaders(req, res, 'GET,OPTIONS'); // 自定义方法
 *   setCorsHeaders(req, res, 'POST,DELETE,OPTIONS'); // 支持 DELETE
 * 
 * 管理员邮箱使用方法：
 *   const adminEmails = getAdminEmails(); // 返回小写邮箱数组
 *   const isAdmin = adminEmails.includes(email.toLowerCase());
 */

// 统一管理管理员邮箱列表
// 可以通过环境变量 ADMIN_EMAIL_WHITELIST 覆盖（逗号分隔）
const DEFAULT_ADMIN_EMAILS = [
  'jonathan.wang@sainstore.com',
  'jonthan.wang@gmail.com',
  'issac.yu@sainstore.com',
  'kitto.chen@sainstore.com',
  'cherry@sain3.com',
  'keihen.luo@sain3.com',
  'nancy.lin@sainstore.com'
];

/**
 * 获取管理员邮箱列表
 * @returns {string[]} 小写邮箱数组
 */
export function getAdminEmails() {
  const envList = process.env.ADMIN_EMAIL_WHITELIST;
  if (envList) {
    return envList
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ADMIN_EMAILS.map(e => e.toLowerCase());
}

/**
 * 检查邮箱是否为管理员
 * @param {string} email - 要检查的邮箱
 * @returns {boolean}
 */
export function isAdminEmail(email) {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.trim().toLowerCase());
}

export function setCorsHeaders(req, res, allowedMethods = 'GET,POST,OPTIONS') {
  // 设置CORS头 - 允许指定的Shopify域名列表
  // 统一在这里管理所有允许的域名，添加新域名只需修改这里
  const allowedOrigins = [
    'https://sain-pdc-test.myshopify.com',
    'https://happy-july.myshopify.com',
    'http://sainsmart.myshopify.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // 可以在这里添加更多允许的域名,
  ];

  // Prefer Origin; fallback to Referer
  const headerOrigin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  let origin = headerOrigin;
  if (!origin && referer) {
    try {
      origin = new URL(referer).origin;
    } catch {}
  }

  // Echo allowed origin; default to store domain
  const allow = allowedOrigins.includes(origin) ? origin : 'https://sain-pdc-test.myshopify.com';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');

  // Allowed methods and headers
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * 统一的 CORS 处理函数
 * 包括：设置 CORS 头、处理 OPTIONS 预检请求、验证请求方法
 * 
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {string|string[]} allowedMethods - 允许的 HTTP 方法，如 'GET,POST' 或 ['GET', 'POST']
 * @returns {boolean} 如果返回 true，表示已处理（OPTIONS 请求或方法不允许），应该直接 return
 * 
 * 使用示例：
 *   // 只允许 POST
 *   if (handleCors(req, res, 'POST')) return;
 *   
 *   // 允许 GET 和 POST
 *   if (handleCors(req, res, ['GET', 'POST'])) return;
 *   
 *   // 允许 POST 和 DELETE
 *   if (handleCors(req, res, 'POST,DELETE')) return;
 */
export function handleCors(req, res, allowedMethods = 'GET,POST,OPTIONS') {
  // 设置 CORS 头
  setCorsHeaders(req, res, allowedMethods);
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // 已处理，应该直接 return
  }
  
  // 验证请求方法
  const methods = typeof allowedMethods === 'string' 
    ? allowedMethods.split(',').map(m => m.trim().toUpperCase())
    : allowedMethods.map(m => m.toUpperCase());
  
  // OPTIONS 已经在上面处理了，这里不需要再检查
  const methodsToCheck = methods.filter(m => m !== 'OPTIONS');
  
  if (!methodsToCheck.includes(req.method.toUpperCase())) {
    res.status(405).json({ 
      error: 'Method not allowed',
      message: `Only ${methodsToCheck.join(', ')} methods are allowed`
    });
    return true; // 已处理，应该直接 return
  }
  
  return false; // 未处理，继续执行后续逻辑
}
