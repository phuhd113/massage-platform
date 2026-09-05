import Link from 'next/link';
import { absolute } from '@/lib/site';
import { JsonLd } from './JsonLd';

export interface Crumb {
  name: string;
  href: string;
}

/**
 * Breadcrumb hiển thị được **và** đánh dấu BreadcrumbList.
 *
 * Hai thứ này phải khớp nhau: đánh dấu một đường dẫn khác với đường người dùng
 * nhìn thấy là structured data không khớp nội dung, và Google gỡ rich result của
 * cả tên miền chứ không riêng trang sai.
 */
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <>
      <nav aria-label={label} className="mb-4 text-sm text-ink-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, i) => (
            <li key={item.href} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">›</span>}
              {i === items.length - 1 ? (
                <span className="text-ink-700">{item.name}</span>
              ) : (
                <Link href={item.href} className="hover:text-brand-600 hover:underline">
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: absolute(item.href),
          })),
        }}
      />
    </>
  );
}
