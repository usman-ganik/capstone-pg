Goal: Payment gateway configurator + supplier payment flow

Key flows:

Configurator saves draft in localStorage key pg-config-draft:<slug>

Publish writes config to Postgres customer_configs

Supplier URL /pay/<slug>?...

Pay → creates payment_sessions → session page → step5 auto-run

DB tables: customer_configs, payment_sessions, customer_api_users

Preview tab: iframe /pay/<slug>?preview=1... should use draft + skip API calls + show mapped outputs placeholders

AI Designer: /api/ai/edit-ui returns JSON patch into gatewaySettings.ui

Known gotchas: Render x-forwarded-host redirects; server components cannot have onClick; external payments should use route handler for Basic Auth popup.