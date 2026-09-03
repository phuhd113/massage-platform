import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — xanh dương. Lấy từ artboard "Thiết kế mới": #0e5aa7 là nút chính
        // và link, #0b4682 là trạng thái nhấn/hover.
        //
        // Trước đây là jade (#0f6b5f). Đổi cả thang một lần thay vì thêm họ màu thứ
        // hai song song: hai màu thương hiệu cùng tồn tại thì mỗi trang mới lại phải
        // chọn một cái, và sàn trôi dần thành hai phong cách.
        brand: {
          50: '#f7fbff',
          100: '#e8f2fd',
          200: '#d9e9fa',
          300: '#a8cdf1',
          400: '#4a8bc9',
          500: '#0e5aa7',
          600: '#0b4682',
          700: '#093a6b',
          800: '#082f57',
          900: '#06243f',
          950: '#041729',
        },

        // Accent — champagne. CHỈ dùng cho vị trí trả phí: khung thẻ VIP, huy
        // hiệu nổi bật, nhãn gói trong dashboard. Dùng nó ở chỗ khác làm loãng
        // tín hiệu "đây là chỗ được mua", và giá trị gói giảm theo.
        champagne: {
          50: '#fdf5e6',
          100: '#f4e8cd',
          200: '#ecd7a6',
          400: '#d8b566',
          500: '#d8a520',
          // Ngưỡng AA cho chữ trên nền trắng. Vàng sáng hơn chỉ đạt ~2.0:1 — không
          // đọc được, mà đây đúng là nhãn KTV trả tiền để thấy.
          600: '#8a5f12',
        },

        // Neutral ngả lam, để hoà với brand xanh dương thay vì xám trung tính (xám
        // thuần ngả nâu khi đặt cạnh #0e5aa7).
        //
        // Bốn bậc chữ của artboard, dùng đúng vai trò này:
        //   900 #0d1b2a  tiêu đề, tên KTV
        //   700 #2c4256  nội dung chính
        //   600 #52677c  chú thích, mô tả
        //   500 #7b8fa3  metadata mờ (ngày tháng, đơn vị)
        ink: {
          0: '#ffffff',
          25: '#fbfcfe',
          50: '#f7fbff',
          100: '#eef3f8',
          200: '#e2e9f1',
          300: '#cfdae6',
          400: '#a5b5c4',
          500: '#7b8fa3',
          600: '#52677c',
          700: '#2c4256',
          800: '#1a2b3d',
          900: '#0d1b2a',
        },

        // Trạng thái. success cố ý KHÁC brand: dấu tích xác thực phải nổi lên
        // khỏi màu thương hiệu, không chìm vào nó.
        success: { fg: '#0a6c4b', bg: '#e6f4ee', bd: '#b3ddca' },
        warning: { fg: '#8a5f12', bg: '#fdf5e6', bd: '#ecd7a6' },
        danger: { fg: '#a32a2a', bg: '#fbeaea', bd: '#edb6b6' },
        // info = tiền đang giữ (held): không phải lỗi, cũng chưa phải đã tiêu.
        // Cố ý lệch khỏi brand-500 để "đang giữ" không đọc như một nút bấm được.
        info: { fg: '#1f5b8f', bg: '#e9f1f9', bd: '#a8cdf1' },
      },

      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      // Thang chữ lấy nguyên từ artboard (px → rem ở 16px gốc). Tiêu đề dùng
      // letter-spacing âm tăng dần theo cỡ chữ: cỡ càng lớn thì khoảng cách mặc
      // định càng trông rời rạc.
      fontSize: {
        label: ['0.6875rem', { lineHeight: '0.9375rem', letterSpacing: '0.075em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.0625rem', letterSpacing: '0.005em' }],
        'body-s': ['0.8125rem', { lineHeight: '1.25rem' }],
        body: ['0.9375rem', { lineHeight: '1.4375rem' }],
        'body-l': ['1rem', { lineHeight: '1.5625rem' }],
        h4: ['1.0625rem', { lineHeight: '1.4375rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.625rem', letterSpacing: '-0.014em', fontWeight: '700' }],
        h2: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.018em', fontWeight: '700' }],
        h1: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        // Hero trang chủ và h1 trang hồ sơ — weight 800, phải có font thật.
        display: ['2.625rem', { lineHeight: '3rem', letterSpacing: '-0.026em', fontWeight: '800' }],
        'display-l': ['3.25rem', { lineHeight: '3.5rem', letterSpacing: '-0.028em', fontWeight: '800' }],
      },

      borderRadius: {
        sm: '4px',
        md: '8px', // nút, ô nhập, chip vuông
        lg: '10px', // ô tìm kiếm, khối bộ lọc
        xl: '12px', // card, thẻ KTV, modal
        '2xl': '14px', // panel lớn, bottom sheet
      },

      boxShadow: {
        // Bóng ám xanh đen (#0d1b2a) chứ không đen thuần — đen thuần trông như vết
        // bẩn trên nền ngả lam.
        card: '0 1px 2px rgba(13,27,42,.05), 0 12px 32px -18px rgba(13,27,42,.22)',
        'card-hover': '0 1px 2px rgba(13,27,42,.05), 0 14px 34px -20px rgba(13,27,42,.28)',
        // Riêng thẻ VIP: quầng champagne thay vì quầng xanh, để thẻ trả phí tự tách
        // khỏi nền mà không cần to hơn thẻ thường.
        vip: '0 1px 2px rgba(13,27,42,.05), 0 10px 28px -18px rgba(138,95,18,.35)',
        // Nút primary nổi (CTA chính, nút "Gọi").
        button: '0 6px 18px -8px rgba(13,27,42,.3)',
        sheet: '0 8px 24px -12px rgba(13,27,42,.35)',
        sticky: '0 -1px 12px -2px rgba(13,27,42,.12)',
      },

      maxWidth: {
        prose: '68ch', // bio KTV, nội dung review
        shell: '1160px', // khung nội dung — khớp artboard
      },

      transitionDuration: { DEFAULT: '150ms' },

      keyframes: {
        shimmer: { '0%': { opacity: '.55' }, '50%': { opacity: '1' }, '100%': { opacity: '.55' } },
      },
      animation: { skeleton: 'shimmer 1.5s ease-in-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
