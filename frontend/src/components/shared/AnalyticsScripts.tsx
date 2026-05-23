/* eslint-disable @next/next/no-img-element */
"use client";

import Script from "next/script";

/**
 * Conditionally injects PostHog + Sentry browser snippets.
 *
 * - PostHog: enabled when NEXT_PUBLIC_POSTHOG_KEY is set. EU region by
 *   default; override with NEXT_PUBLIC_POSTHOG_HOST. Honors Do Not Track.
 * - Sentry: enabled when NEXT_PUBLIC_SENTRY_DSN is set. Browser SDK
 *   loaded via CDN — keeps the bundle out of every page that doesn't
 *   need it. Sample rate 0.2 (configurable via env).
 *
 * Both are no-ops when their env var is missing, so dev and preview
 * builds stay clean.
 */
export function AnalyticsScripts() {
  const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const phHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const sentryRate = process.env.NEXT_PUBLIC_SENTRY_SAMPLE_RATE || "0.2";

  return (
    <>
      {phKey && (
        <Script id="posthog-init" strategy="afterInteractive">
          {`
            if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
              // DNT — skip PostHog init.
            } else {
              !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
              window.posthog.init('${phKey}', { api_host: '${phHost}', person_profiles: 'identified_only', capture_pageview: true });
            }
          `}
        </Script>
      )}
      {sentryDsn && (
        <>
          <Script
            src="https://browser.sentry-cdn.com/8.16.0/bundle.tracing.min.js"
            integrity="sha384-cZvjMA+a8gpfn8XIA9OUEcLfb4mOYDXl6tNb39yDDtfHwLZK+0lJWahkdH+xkLBC"
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
          <Script id="sentry-init" strategy="afterInteractive">
            {`
              if (window.Sentry) {
                window.Sentry.init({
                  dsn: '${sentryDsn}',
                  tracesSampleRate: ${sentryRate},
                  environment: '${process.env.NODE_ENV || "production"}',
                  integrations: [Sentry.browserTracingIntegration()],
                });
              }
            `}
          </Script>
        </>
      )}
    </>
  );
}
