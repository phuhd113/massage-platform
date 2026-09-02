import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — jade. 50/100/500/600/700 giữ nguyên giá trị cũ để các trang
        // đã build không đổi render; phần còn lại là mở rộng.
        brand: {
          50: '#eef7f5',
          100: '#d3ebe6',
          200: '#b4dcd3',
          300: '#7cc3b6',
          400: '#2f9484',
          500: '#0f6b5f',
          600: '#0b544a',
          700: '#083f38',
          800: '#0a3f38',
          900: '#08312c',
          950: '#052421',
        },

        // Accent — champagne. CHỈ dùng cho vị trí trả phí: khung thẻ VIP, huy
        // hiệu nổi bật, nhãn gói trong dashboard. Dùng nó ở chỗ khác làm loãng
        // tín hiệu "đây là chỗ được mua", và giá trị gói giảm theo.
        champagne: {
          50: '#faf3e4',
          200: '#ecd6a8',
          400: '#d4a75c',
          500: '#b98b3c',
          // Ngưỡng AA cho chữ trên nền trắng (5.6:1). Vàng sáng hơn chỉ đạt
          // 2.0:1 — không đọc được, mà đây đúng là nhãn KTV trả tiền để thấy.
          600: '#8a6420',
        },

        // Neutral lệch lục ~4 độ. Xám thuần ngả tím khi đặt cạnh jade.
        // Thêm song song với stone-* thay vì thay thế: các trang hiện có vẫn
        // dùng stone-*, code mới dùng ink-*.
        ink: {
          0: '#ffffff',
          25: '#fbfcfc',
          50: '#f5f8f7',
          100: '#e9efed',
          200: '#d6e0dd',
          300: '#b3c2be',
          400: '#8b9a96',
          500: '#677774',
          600: '#4c5b58',
          700: '#374442',
          800: '#222d2b',
          900: '#141c1a',
        },

        // Trạng thái. success cố ý KHÁC brand: dấu tích xác thực phải nổi lên
        // khỏi màu thương hiệu, không chìm vào nó.
        success: { fg: '#136c43', bg: '#e4f4ea', bd: '#a8d9bd' },
        warning: { fg: '#8a5a05', bg: '#fdf2dc', bd: '#eccf8e' },
        danger: { fg: '#9c2a2a', bg: '#fceaea', bd: '#eab3b3' },
        // info = tiền đang giữ (held): không phải lỗi, cũng chưa phải đã tiêu.
        info: { fg: '#1f5b8f', bg: '#e6f1fa', bd: '#a9cbe6' },
      },

      fontFamily: {
        display: ['var(--font-lexend)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-be-vietnam)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        label: ['0.6875rem', { lineHeight: '0.9375rem', letterSpacing: '0.075em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.0625rem', letterSpacing: '0.005em' }],
        'body-s': ['0.8125rem', { lineHeight: '1.25rem' }],
        body: ['0.9375rem', { lineHeight: '1.5rem' }],
        'body-l': ['1rem', { lineHeight: '1.625rem' }],
        h4: ['1rem', { lineHeight: '1.375rem', letterSpacing: '-0.008em', fontWeight: '600' }],
        h3: ['1.1875rem', { lineHeight: '1.625rem', letterSpacing: '-0.012em', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.9375rem', letterSpacing: '-0.018em', fontWeight: '600' }],
        h1: ['2rem', { lineHeight: '2.375rem', letterSpacing: '-0.021em', fontWeight: '700' }],
        display: ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.022em', fontWeight: '700' }],
      },

      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px', // card, thẻ KTV, modal
        xl: '16px', // bottom sheet, panel bản đồ
      },

      boxShadow: {
        // Bóng ám jade chứ không ám đen — đen thuần trông như vết bẩn trên nền
        // lệch lục.
        card: '0 1px 2px rgba(8,49,44,.06), 0 4px 16px -6px rgba(8,49,44,.10)',
        'card-hover': '0 2px 4px rgba(8,49,44,.08), 0 10px 24px -8px rgba(8,49,44,.16)',
        // Riêng thẻ VIP. Không dùng ở chỗ nào khác.
        vip: '0 2px 4px rgba(138,100,32,.14), 0 12px 28px -12px rgba(138,100,32,.32)',
        sheet: '0 -2px 24px -6px rgba(8,49,44,.18)',
        sticky: '0 -1px 12px -2px rgba(8,49,44,.12)',
      },

      maxWidth: {
        prose: '68ch', // bio KTV, nội dung review
        shell: '1120px', // khung nội dung trang hồ sơ
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
