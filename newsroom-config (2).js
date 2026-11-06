/* SYFM Newsroom API and media configuration. Empty apiBaseUrl means same-origin. */
window.SYFM_NEWSROOM_CONFIG = {
  apiBaseUrl: "",
  endpoints: {
    articles: "/api/public/news/articles",
    ticker: "/api/public/news/ticker",
    externalSources: "/api/public/newsroom",
    newsletter: "/api/public/newsletter/subscribe",
    membershipRegister: "/api/public/membership/register",
    newsSubmission: "/api/public/news/submissions"
  },
  radioStreamUrl: "",
  externalSources: ["vanguard", "the-sun", "bbc-news", "fox-news", "al-jazeera", "cnn", "channels-tv", "nta", "africa-magic-tv"]
};
