const board = document.querySelector("#board");
const postDialog = document.querySelector("#postDialog");
const claimDialog = document.querySelector("#claimDialog");
const postForm = document.querySelector("#postForm");
const claimForm = document.querySelector("#claimForm");
const toast = document.querySelector("#toast");
let posts = [];
let statusFilter = "all";
let claimId = null;

const labels = { cooked: "Cooked meals", produce: "Produce", packaged: "Packaged food", available: "Available", claimed: "Claimed", picked_up: "Picked up", expired: "Expired" };
const categoryImages = {
  cooked: { src: "/images/meal-handoff.png", alt: "Volunteers handing over packed meals" },
  packaged: { src: "/images/bakery-donation.png", alt: "Bakery worker packing bread and snacks" },
  produce: { src: "/images/market-produce.png", alt: "Market volunteer holding a crate of fresh produce" }
};
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const number = value => new Intl.NumberFormat("en-IN").format(value);

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function formatTime(value, demo) {
  if (demo) return "Sample timing";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function render() {
  const available = posts.filter(post => post.status === "available");
  const claimed = posts.filter(post => post.status === "claimed");
  const completed = posts.filter(post => post.status === "picked_up");
  document.querySelector("#statAvailable").textContent = available.length;
  document.querySelector("#statPortions").textContent = number(available.reduce((sum, post) => sum + post.portions, 0));
  document.querySelector("#statClaimed").textContent = claimed.length;
  document.querySelector("#statCompleted").textContent = completed.length;
  document.querySelector("#allCount").textContent = posts.length;
  document.querySelector("#availableCount").textContent = available.length;
  document.querySelector("#claimedCount").textContent = claimed.length;
  document.querySelector("#pickedCount").textContent = completed.length;

  const query = document.querySelector("#search").value.trim().toLowerCase();
  const category = document.querySelector("#categoryFilter").value;
  const sort = document.querySelector("#sort").value;
  const visible = posts.filter(post =>
    (statusFilter === "all" || post.status === statusFilter) &&
    (category === "all" || post.category === category) &&
    (!query || `${post.title} ${post.donor} ${post.address}`.toLowerCase().includes(query))
  );
  visible.sort((a, b) => sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : sort === "portions" ? b.portions - a.portions : a.expiresAt.localeCompare(b.expiresAt));
  document.querySelector("#visibleCount").textContent = visible.length;
  board.innerHTML = visible.length ? visible.map(post => `
    <article class="listing" data-id="${escapeHtml(post.id)}">
      <div class="listing-media"><img src="${categoryImages[post.category].src}" alt="${categoryImages[post.category].alt}" loading="lazy"><span>Illustrative photo</span></div>
      <div class="listing-body">
        <div class="listing-top"><div class="listing-tags"><span class="category-tag">${labels[post.category]}</span>${post.demo ? '<span class="demo-tag">DEMO</span>' : ""}</div><span class="status status-${post.status}">${labels[post.status]}</span></div>
        <h3>${escapeHtml(post.title)}</h3><p class="donor">${escapeHtml(post.donor)}</p>
        <div class="listing-meta"><span><b>${number(post.portions)}</b> portions</span><span>${escapeHtml(post.address)}</span><span>Use by: ${formatTime(post.expiresAt, post.demo)}</span></div>
        ${post.notes ? `<p class="notes">${escapeHtml(post.notes)}</p>` : ""}
        <div class="listing-footer"><span>${post.status === "claimed" || post.status === "picked_up" ? `Volunteer: ${escapeHtml(post.volunteer)}` : `Ready: ${formatTime(post.readyAt, post.demo)}`}</span>${post.status === "available" ? `<button type="button" class="action-button" data-action="claim" data-id="${escapeHtml(post.id)}">Claim pickup</button>` : post.status === "claimed" ? `<button type="button" class="action-button" data-action="complete" data-id="${escapeHtml(post.id)}">Mark picked up</button>` : ""}</div>
      </div>
    </article>`).join("") : '<div class="empty-board"><div class="empty-symbol" aria-hidden="true">✳</div><h3>No listings match</h3><p>Try another status, category, or search term.</p></div>';
}

async function loadPosts() {
  try {
    const response = await fetch("/api/posts");
    if (!response.ok) throw new Error("Could not load listings.");
    posts = await response.json();
    render();
  } catch (error) { board.innerHTML = `<div class="empty-board"><h3>Unable to load listings</h3><p>${escapeHtml(error.message)}</p></div>`; }
}

document.querySelector("#statusFilters").addEventListener("click", event => {
  const button = event.target.closest("button[data-status]");
  if (!button) return;
  statusFilter = button.dataset.status;
  document.querySelectorAll("#statusFilters button").forEach(item => item.classList.toggle("active", item === button));
  render();
});
for (const id of ["search", "categoryFilter", "sort"]) document.querySelector(`#${id}`).addEventListener(id === "search" ? "input" : "change", render);

function openPost() {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 60 * 1000);
  const local = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  postForm.elements.readyAt.value = local(now);
  postForm.elements.expiresAt.value = local(future);
  document.querySelector("#formMessage").textContent = "";
  postDialog.showModal();
}
document.querySelector("#openForm").addEventListener("click", openPost);
document.querySelector("#closeForm").addEventListener("click", () => postDialog.close());
document.querySelector("#cancelForm").addEventListener("click", () => postDialog.close());
document.querySelector("#closeClaim").addEventListener("click", () => claimDialog.close());
document.querySelector("#cancelClaim").addEventListener("click", () => claimDialog.close());

postForm.addEventListener("submit", async event => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(postForm));
  input.readyAt = new Date(input.readyAt).toISOString();
  input.expiresAt = new Date(input.expiresAt).toISOString();
  const button = document.querySelector("#submitPost");
  button.disabled = true;
  try {
    const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create listing.");
    postDialog.close();
    postForm.reset();
    await loadPosts();
    notify("Food listing published.");
  } catch (error) { document.querySelector("#formMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

board.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "claim") {
    claimId = button.dataset.id;
    const post = posts.find(item => item.id === claimId);
    document.querySelector("#claimTitle").textContent = `${post.title} · ${post.portions} portions · ${post.address}`;
    document.querySelector("#claimMessage").textContent = "";
    claimDialog.showModal();
  } else {
    button.disabled = true;
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(button.dataset.id)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "picked_up" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await loadPosts();
      notify("Pickup marked complete.");
    } catch (error) { button.disabled = false; notify(error.message); }
  }
});

claimForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = claimForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const response = await fetch(`/api/posts/${encodeURIComponent(claimId)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "claimed", volunteer: claimForm.elements.volunteer.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    claimDialog.close();
    claimForm.reset();
    await loadPosts();
    notify("Pickup claimed.");
  } catch (error) { document.querySelector("#claimMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

loadPosts();
