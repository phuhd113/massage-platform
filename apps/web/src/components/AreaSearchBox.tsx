'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { areaScopeLabel } from '@/lib/area-search';
import type { AreaSuggestion } from '@/lib/types';

/**
 * Ô tìm khu vực có gợi ý, thay cho thẻ `<select>` phẳng 696 quận/huyện.
 *
 * Vì sao không lọc trên cây khu vực ở client: cây chỉ mang slug trần, mà slug quận
 * trùng nhau giữa các tỉnh — mười "Huyện Châu Thành" sẽ hiện thành mười dòng giống hệt
 * nhau. Endpoint `/areas/suggest` trả kèm vế cha nên mỗi dòng tự phân biệt được, và
 * tiện thể tìm được cả 10.000 phường mà cây cố ý không chở.
 *
 * Bàn phím theo đúng combobox pattern của WAI-ARIA: ↑ ↓ chạy trong danh sách, Enter
 * chọn, Esc đóng. Không có JS thì đây vẫn là một `<input name="q">` bình thường trong
 * form bọc ngoài — xem ghi chú ở HeroSearch.
 */
export function AreaSearchBox({
  onSelect,
  onClear,
  initialLabel = '',
  placeholder = 'Nhập quận, huyện hoặc phường…',
  inputClassName,
  autoFocus = false,
}: {
  onSelect: (s: AreaSuggestion) => void;
  /** Gọi khi khách xoá trắng ô — để trang bỏ lọc khu vực thay vì giữ lại lựa chọn cũ. */
  onClear?: () => void;
  initialLabel?: string;
  placeholder?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [text, setText] = useState(initialLabel);
  const [items, setItems] = useState<AreaSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Nhãn của lựa chọn hiện tại. Giữ riêng để phân biệt "khách đang gõ dở" với "đã chọn
  // xong": chỉ khi hai thứ khác nhau mới cần gọi API.
  const chosen = useRef(initialLabel);
  const boxRef = useRef<HTMLDivElement>(null);

  // Đồng bộ khi trang đổi khu vực từ bên ngoài (bấm nút "Tìm quanh tôi", back/forward).
  useEffect(() => {
    setText(initialLabel);
    chosen.current = initialLabel;
  }, [initialLabel]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q === chosen.current) {
      setItems([]);
      setLoading(false);
      return;
    }

    // AbortController chứ không chỉ debounce: mạng chậm thì phản hồi của từ khoá cũ
    // có thể về sau phản hồi mới và ghi đè lên nó — danh sách gợi ý khi đó không khớp
    // với chữ đang nằm trong ô.
    const ctrl = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/areas/suggest?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as AreaSuggestion[];
        setItems(data);
        setOpen(true);
        setActive(data.length > 0 ? 0 : -1);
      } catch {
        // Bị huỷ vì khách gõ tiếp, hoặc mạng lỗi. Cả hai đều không phải chuyện để
        // báo lỗi: ô chỉ đơn giản là chưa gợi ý được.
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [text]);

  // Bấm ra ngoài thì đóng. Dùng pointerdown để danh sách đóng trước khi con trỏ kịp
  // rơi vào một phần tử khác.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function choose(s: AreaSuggestion) {
    const label = areaScopeLabel(s);
    chosen.current = label;
    setText(label);
    setOpen(false);
    setItems([]);
    setActive(-1);
    onSelect(s);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open || items.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
      return;
    }

    if (e.key === 'Enter' && open && active >= 0 && items[active]) {
      // Chỉ chặn submit khi thật sự đang chọn một gợi ý; ngoài ra để Enter gửi form
      // như bình thường (đường không-JS ở HeroSearch dựa vào điều đó).
      e.preventDefault();
      choose(items[active]);
    }
  }

  function clear() {
    chosen.current = '';
    setText('');
    setItems([]);
    setOpen(false);
    setActive(-1);
    onClear?.();
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        name="area"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === '') clear();
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        className={
          inputClassName ??
          'w-full rounded-md border border-ink-200 bg-white px-3 py-2.5 pr-9 text-body text-ink-900 ' +
            'transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none ' +
            'focus:ring-2 focus:ring-brand-500/20'
        }
      />

      {text && (
        <button
          type="button"
          onClick={clear}
          aria-label="Xoá khu vực đang chọn"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-600"
        >
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Gợi ý khu vực"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        >
          {items.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // pointerdown chứ không click: blur của input xảy ra trước click và sẽ
              // đóng danh sách, làm cú bấm rơi vào khoảng không.
              onPointerDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                i === active ? 'bg-brand-50' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-body-s font-medium text-ink-900">{s.name}</span>
                {s.parentPath && (
                  <span className="block truncate text-label text-ink-500">{s.parentPath}</span>
                )}
              </span>

              {/*
                Khu vực chưa có KTV vẫn hiện, chỉ nhạt đi: ẩn chúng làm khách tưởng ô
                tìm kiếm hỏng khi gõ đúng tên quận nhà mình mà không thấy gì.
              */}
              <span
                className={`shrink-0 text-label ${s.ktvCount > 0 ? 'text-ink-600' : 'text-ink-400'}`}
              >
                {s.ktvCount > 0 ? `${s.ktvCount} KTV` : 'Chưa có KTV'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && items.length === 0 && text.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-body-s text-ink-600 shadow-lg">
          Không tìm thấy khu vực nào khớp “{text.trim()}”.
        </div>
      )}
    </div>
  );
}
