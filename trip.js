(() => {
"use strict";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const refreshIcons = () => {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
  }
};
const menuButton = $("#open-drawer-btn");
const closeButton = $("#close-drawer-btn");
const drawer = $("#mobile-drawer");
const backdrop = $("#drawer-backdrop");
let previousFocus = null;
let savedBackground = [];
const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const getDrawerFocusable = () => drawer ? $$(focusableSelector, drawer).filter((element) => {
  if (!(element instanceof HTMLElement) || element.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}) : [];
const focusSafely = (element) => {
  if (element instanceof HTMLElement && element.isConnected) element.focus({ preventScroll: true });
};
const isolateBackground = () => {
  savedBackground = [];
  for (const element of Array.from(document.body.children)) {
    if (element === drawer || element === backdrop || ["SCRIPT", "STYLE", "LINK", "META"].includes(element.tagName)) continue;
    savedBackground.push({
      element,
      inert: Boolean(element.inert),
      hadAriaHidden: element.hasAttribute("aria-hidden"),
      ariaHidden: element.getAttribute("aria-hidden")
    });
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
  }
};
const restoreBackground = () => {
  for (const state of savedBackground) {
    if (!state.element.isConnected) continue;
    state.element.inert = state.inert;
    if (state.hadAriaHidden) state.element.setAttribute("aria-hidden", state.ariaHidden ?? "");
    else state.element.removeAttribute("aria-hidden");
  }
  savedBackground = [];
};
const setDrawer = (open) => {
  if (!drawer || !backdrop || !menuButton || drawer.classList.contains("open") === open) return;
  if (open) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : menuButton;
    isolateBackground();
    drawer.inert = false;
    drawer.setAttribute("aria-hidden", "false");
    drawer.setAttribute("aria-modal", "true");
    backdrop.inert = false;
    backdrop.setAttribute("aria-hidden", "true");
    drawer.classList.add("open");
    backdrop.classList.add("active");
    menuButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    focusSafely(closeButton);
  } else {
    drawer.classList.remove("open");
    backdrop.classList.remove("active");
    drawer.inert = true;
    drawer.setAttribute("aria-hidden", "true");
    drawer.removeAttribute("aria-modal");
    backdrop.inert = true;
    backdrop.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
    restoreBackground();
    const target = previousFocus && previousFocus.isConnected ? previousFocus : menuButton;
    previousFocus = null;
    focusSafely(target);
  }
};
if (menuButton) menuButton.addEventListener("click", () => setDrawer(true));
if (closeButton) closeButton.addEventListener("click", () => setDrawer(false));
if (backdrop) backdrop.addEventListener("click", () => setDrawer(false));
if (drawer) {
  $$(".drawer-nav a[href]", drawer).forEach((link) => link.addEventListener("click", () => setDrawer(false)));
  drawer.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = getDrawerFocusable();
    if (!controls.length) {
      event.preventDefault();
      focusSafely(drawer);
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      focusSafely(last);
    } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      focusSafely(first);
    }
  });
}
const appHeader = $(".app-header");
const backToTop = $("#back-to-top");
const updateScrollUI = () => {
  if (appHeader) appHeader.classList.toggle("is-scrolled", window.scrollY > 16);
  if (backToTop) backToTop.classList.toggle("is-visible", window.scrollY > 400);
};
window.addEventListener("scroll", updateScrollUI, { passive: true });
updateScrollUI();
if (backToTop) backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
const galleryItems = $$('.gallery-item');
const lightbox = $('#gallery-lightbox');
const lightboxContent = $('#gallery-lightbox-content');
const lightboxImage = $('#gallery-lightbox-image');
const lightboxClose = $('#gallery-lightbox-close');
const lightboxPrevious = $('#gallery-lightbox-previous');
const lightboxNext = $('#gallery-lightbox-next');
const lightboxCount = $('#gallery-lightbox-count');
const lightboxCaption = $('#gallery-lightbox-caption');
const zoomIn = $('#gallery-zoom-in');
const zoomOut = $('#gallery-zoom-out');
const zoomReset = $('#gallery-zoom-reset');
let activeImageIndex = 0;
let zoomScale = 1;
let translateX = 0;
let translateY = 0;
let pointerStart = null;
let dragStart = null;
let pinchStartDistance = 0;
let pinchStartScale = 1;
let suppressNextImageClick = false;
let suppressClickFrame = 0;
let galleryScrollState = null;
const activePointers = new Map();
let galleryTrigger = null;
const galleryIsOpen = () => Boolean(lightbox?.classList.contains('active'));
const resetGestureState = () => {
  translateX = 0;
  translateY = 0;
  pointerStart = null;
  dragStart = null;
  pinchStartDistance = 0;
  pinchStartScale = 1;
  activePointers.clear();
  lightboxImage?.classList.remove('is-dragging', 'is-zoomed');
  lightboxContent?.classList.remove('is-zoomed');
  if (suppressClickFrame) cancelAnimationFrame(suppressClickFrame);
  suppressClickFrame = 0;
  suppressNextImageClick = false;
};
const applyGalleryTransform = () => {
  if (!lightboxImage) return;
  if (zoomScale <= 1) {
    translateX = 0;
    translateY = 0;
  } else {
    const bounds = lightboxContent?.getBoundingClientRect();
    if (bounds) {
      const maxX = Math.max(0, (lightboxImage.offsetWidth * zoomScale - bounds.width) / 2);
      const maxY = Math.max(0, (lightboxImage.offsetHeight * zoomScale - bounds.height) / 2);
      translateX = Math.min(maxX, Math.max(-maxX, translateX));
      translateY = Math.min(maxY, Math.max(-maxY, translateY));
    }
  }
  lightboxImage.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${zoomScale})`;
};
lightboxImage?.addEventListener('load', () => { if (galleryIsOpen()) applyGalleryTransform(); });
window.addEventListener('resize', () => { if (galleryIsOpen()) applyGalleryTransform(); }, { passive: true });
const setZoom = (nextScale) => {
  if (!lightboxImage) return;
  zoomScale = Math.min(4, Math.max(1, nextScale));
  if (zoomScale === 1) { translateX = 0; translateY = 0; }
  lightboxImage.classList.toggle('is-zoomed', zoomScale > 1);
  lightboxContent?.classList.toggle('is-zoomed', zoomScale > 1);
  applyGalleryTransform();
  lightboxImage.style.cursor = zoomScale > 1 ? 'grab' : 'zoom-in';
};
const showGalleryImage = (index) => {
  if (!galleryItems.length || !lightboxImage) return;
  activeImageIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[activeImageIndex];
  const image = $('img', item);
  lightboxImage.src = image?.currentSrc || image?.src || item.href;
  lightboxImage.alt = image?.alt?.trim() || `Gallery photo ${activeImageIndex + 1}`;
  if (lightboxCount) lightboxCount.textContent = `${activeImageIndex + 1} / ${galleryItems.length}`;
  if (lightboxCaption) lightboxCaption.textContent = `Gallery photo ${activeImageIndex + 1}`;
  resetGestureState();
  setZoom(1);
  if (lightboxPrevious) lightboxPrevious.hidden = galleryItems.length < 2;
  if (lightboxNext) lightboxNext.hidden = galleryItems.length < 2;
};
const openGallery = (index, trigger) => {
  if (!lightbox || !galleryItems.length) return;
  galleryTrigger = trigger || galleryItems[index] || null;
  showGalleryImage(index);
  galleryScrollState = { x: window.scrollX, y: window.scrollY, style: document.body.getAttribute('style') };
  document.body.style.position = 'fixed';
  document.body.style.top = `${-galleryScrollState.y}px`;
  document.body.style.left = `${-galleryScrollState.x}px`;
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.classList.add('lightbox-open');
  lightbox.classList.add('active');
  lightbox.setAttribute('aria-hidden', 'false');
  lightbox.removeAttribute('inert');
  lightbox.setAttribute('aria-modal', 'true');
  requestAnimationFrame(() => lightboxClose?.focus({ preventScroll: true }));
};
const closeGallery = () => {
  if (!lightbox || !galleryIsOpen()) return;
  lightbox.classList.remove('active');
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.setAttribute('inert', '');
  lightbox.removeAttribute('aria-modal');
  document.body.classList.remove('lightbox-open');
  if (galleryScrollState) {
    const state = galleryScrollState;
    galleryScrollState = null;
    if (state.style === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style', state.style);
    window.scrollTo(state.x, state.y);
  }
  resetGestureState();
  if (galleryTrigger?.isConnected) galleryTrigger.focus({ preventScroll: true });
};
galleryItems.forEach((item, index) => {
  item.setAttribute('aria-haspopup', 'dialog');
  item.setAttribute('aria-controls', 'gallery-lightbox');
  item.addEventListener('click', (event) => { event.preventDefault(); openGallery(index, item); });
});
lightboxClose?.addEventListener('click', closeGallery);
lightboxPrevious?.addEventListener('click', () => showGalleryImage(activeImageIndex - 1));
lightboxNext?.addEventListener('click', () => showGalleryImage(activeImageIndex + 1));
zoomIn?.addEventListener('click', () => setZoom(zoomScale + .5));
zoomOut?.addEventListener('click', () => setZoom(zoomScale - .5));
zoomReset?.addEventListener('click', () => setZoom(1));
lightbox?.addEventListener('click', (event) => { if (event.target === lightbox) closeGallery(); });
lightbox?.addEventListener('wheel', (event) => {
  if (!galleryIsOpen() || !event.ctrlKey) return;
  event.preventDefault();
  setZoom(zoomScale + (event.deltaY < 0 ? .25 : -.25));
}, { passive: false });
lightboxImage?.addEventListener('click', (event) => {
  if (suppressNextImageClick) { suppressNextImageClick = false; event.preventDefault(); event.stopPropagation(); return; }
  if (!galleryIsOpen()) return;
  setZoom(zoomScale === 1 ? 2 : 1);
  event.stopPropagation();
});
lightboxImage?.addEventListener('pointerdown', (event) => {
  if (!galleryIsOpen() || event.button !== 0) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  try { lightboxImage.setPointerCapture(event.pointerId); } catch (_) {}
  if (activePointers.size === 2) {
    const points = Array.from(activePointers.values());
    pinchStartDistance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    pinchStartScale = zoomScale;
    pointerStart = null;
    dragStart = null;
    return;
  }
  if (zoomScale <= 1) pointerStart = { x: event.clientX, y: event.clientY, time: Date.now(), pointerId: event.pointerId };
  else { dragStart = { x: event.clientX, y: event.clientY, tx: translateX, ty: translateY, pointerId: event.pointerId }; lightboxImage.classList.add('is-dragging'); }
});
lightboxImage?.addEventListener('pointermove', (event) => {
  if (!galleryIsOpen()) return;
  if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activePointers.size >= 2) {
    const points = Array.from(activePointers.values());
    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    if (pinchStartDistance > 0) { setZoom(pinchStartScale * distance / pinchStartDistance); suppressNextImageClick = true; }
    return;
  }
  if (dragStart?.pointerId === event.pointerId) {
    translateX = dragStart.tx + event.clientX - dragStart.x;
    translateY = dragStart.ty + event.clientY - dragStart.y;
    applyGalleryTransform();
  }
});
const endGalleryPointer = (event) => {
  const wasPinching = activePointers.size >= 2;
  if (event) activePointers.delete(event.pointerId);
  if (wasPinching && activePointers.size < 2) {
    suppressNextImageClick = true;
    if (suppressClickFrame) cancelAnimationFrame(suppressClickFrame);
    suppressClickFrame = requestAnimationFrame(() => { suppressNextImageClick = false; suppressClickFrame = 0; });
  }
  if (activePointers.size < 2) pinchStartDistance = 0;
  if (dragStart && (!event || dragStart.pointerId === event.pointerId)) { dragStart = null; lightboxImage?.classList.remove('is-dragging'); }
  if (pointerStart && event && pointerStart.pointerId === event.pointerId && zoomScale === 1) {
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const elapsed = Date.now() - pointerStart.time;
    if (event.type === 'pointerup' && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) && elapsed < 700) {
      showGalleryImage(activeImageIndex + (dx < 0 ? 1 : -1));
      suppressNextImageClick = true;
      if (suppressClickFrame) cancelAnimationFrame(suppressClickFrame);
      suppressClickFrame = requestAnimationFrame(() => { suppressNextImageClick = false; suppressClickFrame = 0; });
    }
    pointerStart = null;
  }
};
lightboxImage?.addEventListener('pointerup', endGalleryPointer);
lightboxImage?.addEventListener('pointercancel', endGalleryPointer);
lightboxImage?.addEventListener('lostpointercapture', endGalleryPointer);
document.addEventListener('keydown', (event) => {
  if (galleryIsOpen()) {
    if (event.key === 'Escape') { event.preventDefault(); closeGallery(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); showGalleryImage(activeImageIndex + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); showGalleryImage(activeImageIndex - 1); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoomScale + .5); }
    else if (event.key === '-') { event.preventDefault(); setZoom(zoomScale - .5); }
    return;
  }
  if (event.key === 'Escape' && drawer?.classList.contains('open')) setDrawer(false);
});
const bookingForm = $("#booking-form");
const feedback = $("#form-feedback");
const dateInput = $("#trip-date");
const guestSelect = $("#guest-count");
const today = new Date();
const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
if (dateInput) dateInput.min = localToday;
if (guestSelect) {
  const maxGuests = Number.parseInt(document.body.dataset.tripMaxGuests || "", 10);
  if (Number.isFinite(maxGuests)) {
    Array.from(guestSelect.options).forEach((option) => {
      if (option.value && Number(option.value) > maxGuests) option.remove();
    });
  }
}
if (bookingForm) {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;
    const formData = new FormData(bookingForm);
    const tripName = String(document.body.dataset.tripName || "").trim();
    const price = String(document.body.dataset.tripPrice || "").trim();
    const priceBasis = String(document.body.dataset.tripPriceBasis || "").trim();
    const whatsappNumber = String(document.body.dataset.whatsappNumber || "").replace(/\D/g, "");
    const guestName = String(formData.get("guestName") || "").trim();
    const guestPhone = String(formData.get("guestPhone") || "").trim();
    const tripDate = String(formData.get("tripDate") || "");
    const guests = String(formData.get("guests") || "");
    const pickup = String(formData.get("pickup") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    if (!tripName || !price || !whatsappNumber) {
      if (feedback) feedback.textContent = "Trip booking data is incomplete.";
      return;
    }
    const lines = [
      "New Trip Booking Request",
      `Trip: ${tripName}`,
      `Listed Trip Price: €${price}${priceBasis ? ` ${priceBasis}` : ""}`,
      `Full Name: ${guestName}`,
      `Phone Number: ${guestPhone}`,
      `Date: ${tripDate}`,
      `Number of Guests: ${guests}`,
      `Hotel/Pickup Location: ${pickup}`
    ];
    if (notes) lines.push(`Special Requests/Notes: ${notes}`);
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
    if (feedback) feedback.textContent = "Opening WhatsApp with your trip request…";
    window.open(url, "_blank", "noopener,noreferrer");
  });
}
$$('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = $(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    if (link.classList.contains("skip-link") && target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
    }
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (history.replaceState) history.replaceState(null, "", link.getAttribute("href"));
  });
});
refreshIcons();
})();
