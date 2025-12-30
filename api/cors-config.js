// 只保留这个版本（选择文件顶部的那个）
export function setCorsHeaders(req, res) {
  // 设置CORS头 - 简化版
  const allowedOrigins = [
    'https://sain-pdc-test.myshopify.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://shopify-test-brown.vercel.app'
  ];
  
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://sain-pdc-test.myshopify.com');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  
  // 如果是OPTIONS请求，返回true表示已处理
  if (req.method === 'OPTIONS') {
    console.log('处理OPTIONS预检请求');
    return true;
  }
  
  return false;
}