/**
 * ═══════════════════════════════════════════════════════════════
 * 批量下载订单文件API - 根据Draft Order ID下载所有文件
 * ═══════════════════════════════════════════════════════════════
 * 
 * 功能：根据Draft Order ID获取所有关联文件，打包成ZIP下载
 * 
 * 请求示例：
 * GET /api/download-order-files?draftOrderId=gid://shopify/DraftOrder/123456789
 * 
 * 响应：
 * - 成功：返回ZIP文件流
 * - 失败：返回JSON错误信息
 */

import { setCorsHeaders } from '../utils/cors-config.js';

// 导入JSZip（使用默认导出）
import JSZipLib from 'jszip';
const JSZip = JSZipLib.default || JSZipLib;

// 本地实现 shopGql，避免跨路由导入在 Vercel 中丢失
async function shopGql(query, variables) {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOP;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.ADMIN_TOKEN;

  if (!storeDomain || !accessToken) {
    return { errors: [{ message: 'Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN' }] };
  }

  const endpoint = `https://${storeDomain}/admin/api/2024-01/graphql.json`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await resp.json();
  return json;
}

// 从Shopify Files下载文件
async function downloadFileFromShopify(fileUrl) {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('从Shopify Files下载文件失败:', error);
    throw error;
  }
}

// 从Metaobject获取文件数据
async function getFileFromMetaobject(fileId) {
  const FILE_METAOBJECT_TYPE = 'uploaded_file';
  
  // 优先按handle查询
  const handleQuery = `
    query($handle: String!, $type: String!) {
      metaobjectByHandle(handle: $handle, type: $type) {
        id
        fields { key value }
      }
    }
  `;

  let fileRecord = null;
  try {
    const handleResult = await shopGql(handleQuery, { handle: fileId, type: FILE_METAOBJECT_TYPE });
    fileRecord = handleResult?.data?.metaobjectByHandle || null;
  } catch (err) {
    console.warn('按handle查询失败，尝试列表查询:', err.message);
  }

  // 降级为列表查询
  if (!fileRecord) {
    const listQuery = `
      query($type: String!, $first: Int!) {
        metaobjects(type: $type, first: $first) {
          nodes {
            id
            handle
            fields { key value }
          }
        }
      }
    `;
    try {
      const result = await shopGql(listQuery, { type: FILE_METAOBJECT_TYPE, first: 100 });
      const nodes = result?.data?.metaobjects?.nodes || [];
      fileRecord = nodes.find(node => {
        const f = node.fields.find(x => x.key === 'file_id');
        return f && f.value === fileId;
      }) || null;
    } catch (gqlErr) {
      console.error('列表查询失败:', gqlErr);
    }
  }

  if (!fileRecord) {
    return null;
  }

  const getField = (key) => {
    const f = fileRecord.fields.find(x => x.key === key);
    return f ? f.value : '';
  };

  const fileUrl = getField('file_url');
  const fileData = getField('file_data');
  const fileName = getField('file_name') || 'download.bin';

  // 优先使用CDN URL
  if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
    return { url: fileUrl, fileName, type: 'url' };
  }

  // 使用Base64数据
  if (fileData) {
    return { data: fileData, fileName, type: 'base64' };
  }

  return null;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { draftOrderId } = req.query;

    if (!draftOrderId) {
      return res.status(400).json({ 
        error: 'Missing draftOrderId parameter',
        usage: 'GET /api/download-order-files?draftOrderId=gid://shopify/DraftOrder/123456789'
      });
    }

    console.log('📦 开始批量下载订单文件:', draftOrderId);

    // 1. 查询Draft Order
    const draftOrderQuery = `
      query($id: ID!) {
        draftOrder(id: $id) {
          id
          name
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                customAttributes {
                  key
                  value
                }
              }
            }
          }
        }
      }
    `;

    const draftOrderResult = await shopGql(draftOrderQuery, { id: draftOrderId });

    if (draftOrderResult.errors && draftOrderResult.errors.length > 0) {
      console.error('查询Draft Order失败:', draftOrderResult.errors);
      return res.status(500).json({
        error: '查询订单失败',
        details: draftOrderResult.errors[0].message
      });
    }

    const draftOrder = draftOrderResult?.data?.draftOrder;
    if (!draftOrder) {
      return res.status(404).json({ error: '订单未找到' });
    }

    console.log(`找到订单 ${draftOrder.name}，包含 ${draftOrder.lineItems.edges.length} 个文件`);

    // 2. 提取所有文件信息
    const files = [];
    for (const edge of draftOrder.lineItems.edges) {
      const lineItem = edge.node;
      const attributes = lineItem.customAttributes || [];

      // 获取文件信息
      const getAttr = (key) => {
        const attr = attributes.find(a => a.key === key);
        return attr ? attr.value : null;
      };

      const fileName = getAttr('文件') || lineItem.title || '未知文件';
      const shopifyFileUrl = getAttr('Shopify文件URL');
      const shopifyFileId = getAttr('Shopify文件ID');
      const fileId = getAttr('文件ID');

      if (shopifyFileUrl && shopifyFileUrl !== '未上传' && shopifyFileUrl.startsWith('http')) {
        files.push({
          fileName,
          url: shopifyFileUrl,
          type: 'shopify_url'
        });
      } else if (fileId) {
        files.push({
          fileName,
          fileId,
          type: 'metaobject'
        });
      } else {
        console.warn(`跳过文件 ${fileName}：未找到有效的文件URL或ID`);
      }
    }

    if (files.length === 0) {
      return res.status(404).json({
        error: '未找到可下载的文件',
        message: '订单中没有找到有效的文件链接'
      });
    }

    console.log(`准备下载 ${files.length} 个文件`);

    // 检查JSZip是否可用
    if (!JSZip) {
      return res.status(500).json({
        error: 'ZIP打包功能不可用',
        message: '请安装jszip依赖: npm install jszip'
      });
    }

    // 3. 下载所有文件并打包
    const zip = new JSZip();
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let fileBuffer = null;

        if (file.type === 'shopify_url') {
          // 从Shopify CDN下载
          console.log(`下载文件 ${i + 1}/${files.length}: ${file.fileName} (Shopify URL)`);
          fileBuffer = await downloadFileFromShopify(file.url);
        } else if (file.type === 'metaobject') {
          // 从Metaobject获取
          console.log(`获取文件 ${i + 1}/${files.length}: ${file.fileName} (Metaobject)`);
          const fileInfo = await getFileFromMetaobject(file.fileId);
          
          if (!fileInfo) {
            throw new Error('从Metaobject获取文件失败');
          }

          if (fileInfo.type === 'url') {
            fileBuffer = await downloadFileFromShopify(fileInfo.url);
          } else if (fileInfo.type === 'base64') {
            const base64Data = fileInfo.data.includes(',') 
              ? fileInfo.data.split(',')[1] 
              : fileInfo.data;
            fileBuffer = Buffer.from(base64Data, 'base64');
          } else {
            throw new Error('未知的文件类型');
          }
        }

        if (fileBuffer) {
          zip.file(file.fileName, fileBuffer);
          successCount++;
          console.log(`✅ 文件 ${i + 1} 添加成功: ${file.fileName}`);
        }
      } catch (error) {
        failCount++;
        console.error(`❌ 文件 ${i + 1} 下载失败: ${file.fileName}`, error.message);
        // 添加错误标记文件
        zip.file(`错误_${file.fileName}.txt`, `文件下载失败: ${error.message}`);
      }
    }

    if (successCount === 0) {
      return res.status(500).json({
        error: '所有文件下载失败',
        details: `成功: ${successCount}, 失败: ${failCount}`
      });
    }

    // 4. 生成ZIP文件
    console.log(`生成ZIP文件，成功: ${successCount}, 失败: ${failCount}`);
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // 5. 返回ZIP文件
    const zipFileName = `${draftOrder.name || 'order'}_files_${Date.now()}.zip`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFileName)}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    console.log(`✅ ZIP文件生成成功: ${zipFileName}, 大小: ${zipBuffer.length} 字节`);
    
    return res.status(200).send(zipBuffer);

  } catch (error) {
    console.error('批量下载文件失败:', error);
    return res.status(500).json({
      error: '批量下载失败',
      details: error.message
    });
  }
}
