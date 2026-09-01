import { NextResponse } from 'next/server';
import { API_BASE, getSessionToken } from '@/lib/session';

/**
 * Chuyển tiếp thao tác của dashboard sang backend, gắn token từ cookie httpOnly.
 *
 * Tồn tại vì token cố ý không đọc được từ JavaScript của trang: client component
 * cần gọi API có xác thực thì phải đi qua đây. Proxy không mở rộng quyền của ai —
 * nó dùng đúng token của phiên đang đăng nhập, backend vẫn kiểm quyền như thường.
 */
const ALLOWED = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** Chỉ chấp nhận đoạn đường dẫn "hiền": chặn ../ thoát ra khỏi gốc API. */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

async function forward(request: Request, path: string[]) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
  }

  if (!ALLOWED.has(request.method)) {
    return NextResponse.json({ message: 'Method không được hỗ trợ' }, { status: 405 });
  }

  if (path.length === 0 || !path.every((s) => SAFE_SEGMENT.test(s))) {
    return NextResponse.json({ message: 'Đường dẫn không hợp lệ' }, { status: 400 });
  }

  const query = new URL(request.url).search;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  const body = request.method === 'GET' || request.method === 'DELETE'
    ? undefined
    : await request.text();

  if (body) headers['Content-Type'] = 'application/json';

  // Idempotency-Key phải đi nguyên vẹn tới backend: nó do client sinh và là thứ
  // chặn double-click thành hai lần trừ tiền. Nuốt header này ở proxy là bịt mất
  // đúng cơ chế chống lặp mà tầng dưới dựa vào.
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${API_BASE}/${path.join('/')}${query}`, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });

  const text = await res.text();

  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}

type Ctx = { params: { path: string[] } };

export const GET = (req: Request, { params }: Ctx) => forward(req, params.path);
export const POST = (req: Request, { params }: Ctx) => forward(req, params.path);
export const PUT = (req: Request, { params }: Ctx) => forward(req, params.path);
export const PATCH = (req: Request, { params }: Ctx) => forward(req, params.path);
export const DELETE = (req: Request, { params }: Ctx) => forward(req, params.path);
