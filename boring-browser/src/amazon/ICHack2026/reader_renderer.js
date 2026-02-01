let currentSourceUrl = null;
let imagesRevealed = false;

const titleEl = document.getElementById("title");
const metaEl = document.getElementById("meta");
const contentEl = document.getElementById("content");
const footerEl = document.getElementById("footer");

const toggleBtn = document.getElementById("toggleImages");
const openSourceBtn = document.getElementById("openSource");

toggleBtn.onclick = () => {
  imagesRevealed = !imagesRevealed;
  toggleBtn.textContent = imagesRevealed ? "Hide images" : "Reveal images";

  contentEl.querySelectorAll("img, video, iframe").forEach((node) => {
    node.style.display = imagesRevealed ? "" : "none";
  });
};

openSourceBtn.onclick = () => {
  if (currentSourceUrl) window.readerAPI.openExternal(currentSourceUrl);
};

window.readerAPI.onArticle(({ article, sourceUrl, extractedAt }) => {
  currentSourceUrl = sourceUrl;

  titleEl.textContent = article.title || "Untitled";

  const bits = [];
  if (article.byline) bits.push(`By ${article.byline}`);
  if (article.siteName) bits.push(article.siteName);
  if (article.excerpt) bits.push(`“${article.excerpt}”`);
  metaEl.textContent = bits.join(" • ");

  // Sanitize and inject HTML
  const safeHtml = window.readerAPI.sanitize(article.content || "");
  contentEl.innerHTML = safeHtml;

  // Default: hide images/media
  contentEl.querySelectorAll("img, video, iframe").forEach((node) => {
    node.style.display = "none";
  });

  footerEl.textContent = `Source: ${sourceUrl} • Extracted: ${new Date(extractedAt).toLocaleString()}`;
});