/**
 * Shopify API 客户端 - 统一管理 Shopify GraphQL API 调用
 * 
 * 职责：
 * - 统一 Shopify API 配置和调用
 * - 统一错误处理
 * - 提供便捷的 GraphQL 查询方法
 */

class ShopifyClient {
  constructor() {
    this.storeDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOP;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || process.env.ADMIN_TOKEN;
    this.apiVersion = '2024-01';
    this.endpoint = this.storeDomain 
      ? `https://${this.storeDomain}/admin/api/${this.apiVersion}/graphql.json`
      : null;
  }

  /**
   * 检查配置是否完整
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.storeDomain && this.accessToken);
  }

  /**
   * 获取配置状态（用于模拟数据场景）
   * @returns {object}
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      hasStoreDomain: !!this.storeDomain,
      hasAccessToken: !!this.accessToken,
      endpoint: this.endpoint
    };
  }

  /**
   * 执行 GraphQL 查询/变更
   * @param {string} query - GraphQL 查询字符串
   * @param {object} variables - GraphQL 变量
   * @returns {Promise<object>} GraphQL 响应
   * @throws {Error} 如果配置缺失或 API 调用失败
   */
  async query(query, variables = {}) {
    if (!this.isConfigured()) {
      throw new Error('Shopify 配置缺失：请设置 SHOPIFY_STORE_DOMAIN/SHOP 和 SHOPIFY_ACCESS_TOKEN/ADMIN_TOKEN');
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`Shopify API 请求失败: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();

      // 处理 GraphQL 错误
      if (json.errors && json.errors.length > 0) {
        const firstError = json.errors[0];
        console.error('GraphQL 错误:', json.errors);
        throw new Error(`GraphQL 错误: ${firstError.message}`);
      }

      // 处理用户错误（在 mutation 中）
      if (json.data) {
        const mutationKeys = Object.keys(json.data);
        for (const key of mutationKeys) {
          const mutationResult = json.data[key];
          if (mutationResult && mutationResult.userErrors && mutationResult.userErrors.length > 0) {
            const firstUserError = mutationResult.userErrors[0];
            throw new Error(`操作失败: ${firstUserError.message}`);
          }
        }
      }

      return json;
    } catch (error) {
      // 增强错误信息
      if (error.message.includes('Shopify') || error.message.includes('GraphQL')) {
        throw error;
      }
      throw new Error(`Shopify API 调用失败: ${error.message}`);
    }
  }

  /**
   * 便捷方法：查询单个 Draft Order
   * @param {string} draftOrderId - Draft Order ID (GID 格式)
   * @returns {Promise<object>} Draft Order 数据
   */
  async getDraftOrder(draftOrderId) {
    const query = `
      query($id: ID!) {
        draftOrder(id: $id) {
          id
          name
          email
          totalPrice
          status
          createdAt
          updatedAt
          invoiceUrl
          note
          lineItems(first: 20) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPrice
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

    const result = await this.query(query, { id: draftOrderId });
    return result.data?.draftOrder || null;
  }

  /**
   * 便捷方法：查询 Draft Orders 列表
   * @param {object} options - 查询选项
   * @param {number} options.first - 返回数量
   * @param {string} options.search - 搜索查询字符串
   * @returns {Promise<Array>} Draft Orders 数组
   */
  async getDraftOrders({ first = 50, search = '' } = {}) {
    const query = `
      query($first: Int!, $search: String!) {
        draftOrders(first: $first, query: $search) {
          edges {
            node {
              id
              name
              email
              totalPrice
              status
              createdAt
              updatedAt
              invoiceUrl
              note
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    title
                    quantity
                    originalUnitPrice
                    customAttributes {
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.query(query, { first, search });
    return (result.data?.draftOrders?.edges || []).map(edge => edge.node);
  }

  /**
   * 便捷方法：创建 Draft Order
   * @param {object} input - DraftOrderInput
   * @returns {Promise<object>} 创建的 Draft Order
   */
  async createDraftOrder(input) {
    const mutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            email
            invoiceUrl
            totalPrice
            createdAt
            lineItems(first: 20) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalUnitPrice
                  customAttributes { key value }
                }
              }
            }
          }
          userErrors { field message }
        }
      }
    `;

    const result = await this.query(mutation, { input });
    return result.data?.draftOrderCreate?.draftOrder || null;
  }

  /**
   * 便捷方法：更新 Draft Order
   * @param {string} draftOrderId - Draft Order ID
   * @param {object} input - DraftOrderInput
   * @returns {Promise<object>} 更新后的 Draft Order
   */
  async updateDraftOrder(draftOrderId, input) {
    const mutation = `
      mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
        draftOrderUpdate(id: $id, input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
            totalPrice
            updatedAt
          }
          userErrors { field message }
        }
      }
    `;

    const result = await this.query(mutation, { id: draftOrderId, input });
    return result.data?.draftOrderUpdate?.draftOrder || null;
  }

  /**
   * 便捷方法：删除 Draft Order
   * @param {string} draftOrderId - Draft Order ID
   * @returns {Promise<string>} 删除的 ID
   */
  async deleteDraftOrder(draftOrderId) {
    const mutation = `
      mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
        draftOrderDelete(input: $input) {
          deletedId
          userErrors { field message }
        }
      }
    `;

    const result = await this.query(mutation, {
      input: { id: draftOrderId }
    });
    return result.data?.draftOrderDelete?.deletedId || null;
  }

  /**
   * 便捷方法：发送发票邮件
   * @param {string} draftOrderId - Draft Order ID
   * @returns {Promise<object>} 结果
   */
  async sendInvoiceEmail(draftOrderId) {
    const mutation = `
      mutation draftOrderInvoiceSend($id: ID!) {
        draftOrderInvoiceSend(id: $id) {
          draftOrder {
            id
            name
            invoiceUrl
          }
          userErrors { field message }
        }
      }
    `;

    const result = await this.query(mutation, { id: draftOrderId });
    return result.data?.draftOrderInvoiceSend?.draftOrder || null;
  }
}

// 导出单例实例
export const shopifyClient = new ShopifyClient();

// 也导出类以便测试或需要多个实例的场景
export default ShopifyClient;