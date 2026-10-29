import { Helmet } from 'react-helmet-async';
import { useSiteUrl } from '@/lib/site-url';

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: object;
  noIndex?: boolean;
}

export const SEO = ({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  jsonLd,
  noIndex = false,
}: SEOProps) => {
  const siteUrl = useSiteUrl();
  const fullCanonical = canonical
    ? canonical.startsWith('http')
      ? canonical
      : `${siteUrl}${canonical}`
    : undefined;

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}

      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={ogType} />
      {fullCanonical && <meta property="og:url" content={fullCanonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd).replace(/</g, '\\u003c')}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
