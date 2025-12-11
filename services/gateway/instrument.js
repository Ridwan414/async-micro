const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://5ae077294b505b2b1bb8ba53b658a0e0@o4510517239152640.ingest.us.sentry.io/4510517866332160",
  sendDefaultPii: true,
});
