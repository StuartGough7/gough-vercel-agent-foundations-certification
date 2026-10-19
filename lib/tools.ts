import { tool } from 'ai'
import { z } from 'zod'
import {
  ApiRequestError,
  createReturn,
  getCategories,
  getOrder,
  getProductById,
  getProducts,
  getProductStock,
  preauthorizeRefund,
  notifyReturnInProcess,
} from '@/lib/api'

export const searchProducts = tool({
  description: `Broad lookup across the Vercel swag store product catalog. Use this when the user asks what the store sells, wants recommendations, or describes a product loosely and you need to find matching items and their IDs. Returns summary fields only (first image, price, short info) — do NOT use it to answer detailed questions about a single item; call getProductDetails with the product id or slug instead. Optionally narrow results to a single category.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
      ),
  }),
  execute: async ({ query, category }) => {
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      })
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Unknown error'
      return { count: 0, products: [], error: message }
    }
  },
})

export const getProductDetails = tool({
  description: `Fetch full details for ONE specific product: description, price, all images, tags, live stock level, and a few related products from the same category. Use this whenever the user asks about a particular item (e.g. "tell me more about the black hoodie", "is the cap in stock?"). If you don't know the product's id or slug yet, call searchProducts first to find it. The UI renders the result as a product card, so you don't need to repeat the image or price in text.`,
  inputSchema: z.object({
    idOrSlug: z.string().min(1).describe(`The product id or slug, as returned by searchProducts.`),
  }),
  execute: async ({ idOrSlug }) => {
    try {
      const [product, stock] = await Promise.all([
        getProductById(idOrSlug),
        getProductStock(idOrSlug).catch(() => null),
      ])
      const related = await getProducts({ category: product.category, limit: 5 }).catch(() => [])
      return {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          currency: product.currency,
          category: product.category,
          images: product.images,
          tags: product.tags,
          featured: product.featured,
        },
        stock: stock && {
          stock: stock.stock,
          inStock: stock.inStock,
          lowStock: stock.lowStock,
        },
        related: related
          .filter((p) => p.id !== product.id)
          .slice(0, 3)
          .map((p) => ({ id: p.id, name: p.name, slug: p.slug, price: p.price, currency: p.currency })),
      }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Unknown error'
      return { error: message }
    }
  },
})

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const categories = await getCategories()
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Unknown error'
      return { count: 0, categories: [], error: message }
    }
  },
})

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z.string().describe('The order ID the user wants to return.'),
    reason: z.string().min(10).max(500).describe('Why the user is returning the order.'),
  }),
  execute: async ({ orderId, reason }) => {
    try {
      const order = await getOrder(orderId)
      await notifyReturnInProcess(orderId)
      await preauthorizeRefund(orderId)
      const filed = await createReturn({
        orderId: order.id,
        items: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        reason,
      })
      return { returnId: filed.id, status: filed.status }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Unknown error'
      return { error: message }
    }
  },
})
