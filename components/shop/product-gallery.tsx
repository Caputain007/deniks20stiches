/* eslint-disable @next/next/no-img-element -- photos are resized to two widths on upload */
import type { CatalogImage } from '@/lib/catalog'

/** Swipeable strip on phones, a two-column grid of every photo on larger screens. */
export function ProductGallery({ images, name }: { images: CatalogImage[]; name: string }) {
  return (
    // min-w-0 stops the photo strip from widening the page's grid column on phones.
    <div className="min-w-0">
      <ul className="snap-strip -mx-5 flex overflow-x-auto md:hidden" aria-label={`Photos of ${name}`}>
        {images.map((image, i) => (
          <li key={image.url} className="relative w-[86vw] shrink-0 pl-5 last:pr-5">
            <img
              src={image.url}
              srcSet={`${image.thumbUrl} 640w, ${image.url} 1600w`}
              sizes="86vw"
              alt={image.alt || `${name}, photo ${i + 1}`}
              width={image.width}
              height={image.height}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : undefined}
              decoding="async"
              className="aspect-[4/5] w-full bg-blush object-cover"
            />
            <span
              className="absolute bottom-3 right-3 bg-white/90 px-2 py-0.5 text-xs font-semibold"
              aria-hidden="true"
            >
              {i + 1} / {images.length}
            </span>
          </li>
        ))}
      </ul>

      <ul className="hidden grid-cols-2 gap-2 md:grid" aria-label={`Photos of ${name}`}>
        {images.map((image, i) => (
          <li key={image.url} className={i === 0 && images.length % 2 === 1 ? 'col-span-2' : ''}>
            <a href={image.url} target="_blank" rel="noopener" className="block cursor-zoom-in" title="Open full size">
              <img
                src={image.url}
                srcSet={`${image.thumbUrl} 640w, ${image.url} 1600w`}
                sizes={
                  i === 0 && images.length % 2 === 1
                    ? '(min-width: 1240px) 700px, 58vw'
                    : '(min-width: 1240px) 350px, 29vw'
                }
                alt={image.alt || `${name}, photo ${i + 1}`}
                width={image.width}
                height={image.height}
                loading={i < 2 ? 'eager' : 'lazy'}
                decoding="async"
                className="aspect-[4/5] w-full bg-blush object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
