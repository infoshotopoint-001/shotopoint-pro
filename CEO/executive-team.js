document.addEventListener("DOMContentLoaded", () => {
  const video = document.querySelector(".video-bg video");
  if (video) {
    video.play().catch(() => {});
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) video.pause();
      else video.play().catch(() => {});
    });
  }
});
