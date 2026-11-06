(() => {
  async function refreshDashboardCounts() {
    const token = localStorage.t;
    if (!token || document.querySelector("#portal")?.hidden) return;
    try {
      const response = await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok || !result.data) return;
      const values = [result.data.content, result.data.meetings, result.data.orders, `₦${Number(result.data.revenue).toLocaleString()}`];
      document.querySelectorAll(".stats .stat b").forEach((node, index) => { if (values[index] !== undefined) node.textContent = values[index]; });
      let stamp = document.querySelector("#mysqlLiveStamp");
      if (!stamp) { stamp = document.createElement("small"); stamp.id = "mysqlLiveStamp"; stamp.style.cssText = "color:#70e19c;display:block;margin:12px 0"; document.querySelector("#view")?.prepend(stamp); }
      stamp.textContent = `● Live MySQL data · updated ${new Date().toLocaleTimeString()}`;
    } catch (_) {}
  }
  setInterval(refreshDashboardCounts, 10000);
  document.addEventListener("DOMContentLoaded", refreshDashboardCounts);
})();
