'use client'

import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/format'
import type { ProductDetailsToolInvocation } from '@/lib/agent'

interface AgentProductCardProps {
  invocation: ProductDetailsToolInvocation
}

export function AgentProductCard({ invocation }: AgentProductCardProps) {
  if (invocation.state === 'input-streaming' || invocation.state === 'input-available') {
    const productId = invocation.input?.productId
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading product details{productId ? ` for "${productId}"` : ''}…
      </div>
    )
  }

  if (invocation.state !== 'output-available') return null

  const product = invocation.output

  if (!product) return null

  if ('error' in product && product.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {product.error}
      </div>
    )
  }

  const images = product.images ?? []
  const tags = product.tags ?? []
  const stockLabel = !product.inStock
    ? 'Out of stock'
    : product.lowStock
      ? `Low stock · ${product.stock} left`
      : `${product.stock} in stock`

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <Link href={`/products/${product.slug}`} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-2">
          <div className="relative aspect-square overflow-hidden rounded-md bg-secondary">
            {images[0] && (
              <Image
                src={images[0]}
                alt={product.name ?? ''}
                fill
                sizes="(max-width: 640px) 100vw, 40vw"
                className="object-cover"
              />
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2" aria-label={`${images.length} product images`}>
              {images.slice(1, 5).map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-sm bg-secondary"
                >
                  <Image
                    src={image}
                    alt={`${product.name ?? 'Product'}, image ${index + 2}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{product.category}</span>
            {product.featured && <span className="rounded-sm bg-secondary px-2 py-1">Featured</span>}
          </div>
          <h3 className="text-lg font-semibold leading-tight">{product.name}</h3>
          {product.price !== undefined && (
            <p className="mt-1 text-base font-medium">{formatPrice(product.price, product.currency)}</p>
          )}
          <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{product.description}</p>
          <p
            className={`mt-3 text-sm ${product.inStock ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}
          >
            {stockLabel}
          </p>
          {tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Product tags">
              {tags.map((tag) => (
                <li key={tag} className="rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </article>
  )
}
