/* Shoto Point News configuration.
 * Keep secret API keys on the server; never place them in this browser file.
 * Add the real official social/channel URLs and production video URL below.
 */
window.SHOTO_POINT_NEWS_CONFIG = {
  apiBaseUrl: "",
  endpoints: {
    articles: "/api/public/news/articles",
    ticker: "/api/public/shoto-point-news/ticker",
    externalSources: "/api/public/newsroom",
    newsletter: "/api/public/shoto-point-news/newsletter/subscribe",
    membershipRegister: "/api/public/shoto-point-news/membership/register",
    newsSubmission: "/api/public/shoto-point-news/submissions",
    productionUpdates: "/api/public/shoto-point-production/updates"
  },
  externalSources: ["vanguard", "the-sun", "bbc-news", "fox-news", "al-jazeera", "cnn", "channels-tv", "nta", "africa-magic-tv"],
  productionUpdates: {
    youtubeVideoUrl: "",       // Paste a public Shoto Point Productions YouTube video URL here.
    youtubeChannelUrl: "",     // Paste the official YouTube channel URL here.
    facebookPageUrl: "",       // Paste the official Facebook page URL here.
    instagramProfileUrl: "",   // Paste the official Instagram profile URL here.
    videoTitle: "Latest from Shoto Point Productions",
    videoDescription: "Trailers, behind-the-scenes footage, production announcements and company updates."
  },
  membershipBrand: "Shoto Point News",
  publisherName: "Shoto Point News",
  productionName: "Shoto Point Productions"
};
