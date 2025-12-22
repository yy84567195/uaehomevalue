import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 你现在不用额外配 i18n（App Router + next-intl 用 middleware）
};

export default withNextIntl(nextConfig);
