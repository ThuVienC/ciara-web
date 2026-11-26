const TMDB_API_KEY = "95e8aa50d063dab25418f999efa27150";
const WORKER_API_URL = "https://cdn.ciara.indevs.in/api/movies";
const ADMIN_KEY_STORAGE = "ciara_admin_key";

const TMDB_GENRES = {
  28: "Phim Hành Động",
  12: "Phim Phiêu Lưu",
  16: "Phim Hoạt Hình",
  35: "Phim Hài",
  80: "Phim Hình Sự",
  99: "Phim Tài Liệu",
  18: "Phim Chính Kịch",
  10751: "Phim Gia Đình",
  14: "Phim Giả Tưởng",
  36: "Phim Lịch Sử",
  27: "Phim Kinh Dị",
  10402: "Phim Nhạc",
  9648: "Phim Bí Ẩn",
  10749: "Phim Lãng Mạn",
  878: "Phim Khoa Học Viễn Tưởng",
  53: "Phim Gây Cấn",
  10752: "Phim Chiến Tranh",
  10759: "Hành Động & Phiêu Lưu",
  10765: "Khoa Học & Giả Tưởng",
};

document.addEventListener("DOMContentLoaded", () => {
  let allMovies = [];
  let filteredMovies = [];
  let currentGenre = "Tất cả";
  let currentType = "Tất cả";
  let currentPage = 1;
  const moviesPerPage = 24;

  let art = null;
  let hls = null;
  let activeBlobUrls = [];

  const movieGrid = document.querySelector(".movie-grid");
  const heroSection = document.querySelector(".hero");
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const dropBtn = document.querySelector(".dropbtn");
  const genreDropdown = document.getElementById("genre-dropdown");
  const categoriesContainer = document.querySelector(".categories-container");
  const modal = document.querySelector(".modal");
  const quickPlayBtn = document.getElementById("quick-play-btn");
  const addMovieBtn = document.getElementById("add-movie-btn");
  const vaultKeyBtn = document.getElementById("vault-key-btn");

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  function getAdminKey() {
    return localStorage.getItem(ADMIN_KEY_STORAGE) || "";
  }

  function updateAuthUI(isLoggedIn) {
    addMovieBtn.style.display = isLoggedIn ? "inline-flex" : "none";
    vaultKeyBtn.textContent = isLoggedIn ? "Đăng xuất" : "🔑 Đăng nhập";
  }

  function destroyPlayer(revokeBlobs = true) {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (art) {
      art.destroy(false);
      art = null;
    }
    if (revokeBlobs && activeBlobUrls.length) {
      activeBlobUrls.forEach((u) => URL.revokeObjectURL(u));
      activeBlobUrls = [];
    }
  }

  function createPlaylistBlobUrl(text) {
    const blob = new Blob([text], { type: "application/vnd.apple.mpegurl" });
    const url = URL.createObjectURL(blob);
    activeBlobUrls.push(url);
    return url;
  }

  function mountArtPlayer(containerEl, sourceUrl, keepBlobs = false) {
    destroyPlayer(!keepBlobs);

    art = new Artplayer({
      container: containerEl,
      url: sourceUrl,
      type: "m3u8",
      autoplay: true,
      pip: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: true,
      theme: "#a855f7",
      lang: "vi",
      customType: {
        m3u8: function (video, url, player) {
          if (typeof Hls !== "undefined" && Hls.isSupported()) {
            hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              fragLoadPolicy: {
                default: {
                  maxTimeToFirstByteMs: 15000,
                  maxLoadTimeMs: 120000,
                  timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
                  errorRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
                },
              },
              manifestLoadPolicy: {
                default: {
                  maxTimeToFirstByteMs: 15000,
                  maxLoadTimeMs: 30000,
                  timeoutRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
                  errorRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
                },
              },
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
              const tracks = data.audioTracks || [];
              if (tracks.length <= 1) return;
              let defaultIdx = hls.audioTrack >= 0 ? hls.audioTrack : 0;
              const selector = tracks.map((t, i) => {
                if (t.default) defaultIdx = i;
                return { html: t.name || t.lang || `Kênh ${i + 1}`, idx: i, default: Boolean(t.default) || i === defaultIdx };
              });
              hls.audioTrack = defaultIdx;
              player.setting.update({
                name: "audio",
                html: "Âm thanh",
                tooltip: tracks[defaultIdx]?.name || tracks[defaultIdx]?.lang || "Mặc định",
                selector,
                onSelect: (item) => {
                  hls.audioTrack = item.idx;
                  return item.html;
                },
              });
            });

            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
              const tracks = data.subtitleTracks || [];
              if (!tracks.length) return;
              let defaultIdx = 0;
              const selector = [
                { html: "Tắt phụ đề", idx: -1 },
                ...tracks.map((t, i) => {
                  if (t.default) defaultIdx = i;
                  return { html: t.name || t.lang || `Phụ đề ${i + 1}`, idx: i, default: Boolean(t.default) };
                }),
              ];
              hls.subtitleTrack = defaultIdx;
              hls.subtitleDisplay = true;

              player.setting.update({
                name: "subtitle",
                html: "Phụ đề",
                tooltip: tracks[defaultIdx]?.name || tracks[defaultIdx]?.lang || "Bật",
                selector,
                onSelect: (item) => {
                  hls.subtitleTrack = item.idx;
                  hls.subtitleDisplay = item.idx >= 0;
                  return item.html;
                },
              });

              player.setting.update({
                name: "sub-size",
                html: "Cỡ phụ đề",
                tooltip: "Lớn",
                selector: [
                  { html: "Vừa", size: "clamp(1.1rem, 2vw, 1.8rem)" },
                  { html: "Lớn", size: "clamp(1.4rem, 2.6vw, 2.4rem)", default: true },
                  { html: "Rất lớn", size: "clamp(1.75rem, 3.2vw, 3rem)" },
                ],
                onSelect: (item) => {
                  document.getElementById("cueSizeStyle").textContent = `video::cue { font-size: ${item.size}; }`;
                  return item.html;
                },
              });
            });

            player.on("destroy", () => {
              if (hls) {
                hls.destroy();
                hls = null;
              }
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
          }
        },
      },
    });
  }

  async function fetchMovies() {
    const key = getAdminKey();
    if (!key) return { locked: true, movies: [] };

    try {
      const res = await fetch(WORKER_API_URL, {
        headers: { "X-Admin-Key": key },
        cache: "no-store",
      });
      if (res.status === 401) return { locked: true, invalidKey: true, movies: [] };
      if (!res.ok) return { locked: false, movies: [] };
      return { locked: false, movies: await res.json() };
    } catch {
      return { locked: false, movies: [] };
    }
  }

  async function refreshLibrary() {
    const { locked, invalidKey, movies } = await fetchMovies();
    if (invalidKey) localStorage.removeItem(ADMIN_KEY_STORAGE);

    const isLoggedIn = !locked && Boolean(getAdminKey());
    updateAuthUI(isLoggedIn);
    allMovies = Array.isArray(movies) ? movies : [];
    renderHero(allMovies[0], locked);
    renderCategories();
    filteredMovies = [...allMovies];
    renderMovies(locked);
  }

  async function handleAuthClick() {
    if (getAdminKey()) {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      await refreshLibrary();
      return;
    }
    const pw = window.prompt("Nhập mật khẩu đăng nhập:");
    if (!pw || !pw.trim()) return;
    localStorage.setItem(ADMIN_KEY_STORAGE, pw.trim());
    const { invalidKey } = await fetchMovies();
    if (invalidKey) {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      alert("Mật khẩu không đúng!");
    }
    await refreshLibrary();
  }

  function initApp() {
    dropBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      genreDropdown.classList.toggle("show");
    });

    quickPlayBtn.addEventListener("click", () => openQuickPlayer());
    addMovieBtn.addEventListener("click", () => openMovieFormModal());
    vaultKeyBtn.addEventListener("click", handleAuthClick);

    window.addEventListener(
      "scroll",
      () => {
        genreDropdown.classList.remove("show");
        searchResults.classList.remove("active");
      },
      { passive: true }
    );

    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.trim().toLowerCase();
      if (!term) {
        searchResults.classList.remove("active");
        return;
      }
      const matches = allMovies
        .filter((m) => m.title.toLowerCase().includes(term) || (m.original_title || "").toLowerCase().includes(term))
        .slice(0, 8);
      renderSearchSuggestions(matches);
      searchResults.classList.add("active");
    });

    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) searchResults.classList.remove("active");
      if (!dropBtn.contains(e.target) && !genreDropdown.contains(e.target)) genreDropdown.classList.remove("show");
    });

    refreshLibrary();
  }

  function renderSearchSuggestions(matches) {
    if (!matches.length) {
      searchResults.innerHTML = '<div class="search-no-results">Không tìm thấy phim nào...</div>';
      return;
    }
    searchResults.innerHTML = matches
      .map(
        (m) => `
        <div class="search-item" data-id="${m.id}">
          <img src="${m.poster_path || ""}" class="search-thumb" onerror="this.style.display='none'">
          <div class="search-item-info">
            <h5>${m.title}</h5>
            <span>${String(m.release_date || "").split("-")[0]} • ★ ${m.vote_average || "HD"}</span>
          </div>
        </div>`
      )
      .join("");
    searchResults.querySelectorAll(".search-item").forEach((el) => {
      el.addEventListener("click", () => {
        searchResults.classList.remove("active");
        searchInput.value = "";
        openMovieModal(el.dataset.id);
      });
    });
  }

  function renderHero(movie, locked = false) {
    if (locked) {
      heroSection.innerHTML = `
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <p style="color: var(--accent-purple); font-weight: bold; margin-bottom: 10px;">RẠP PHIM CÁ NHÂN</p>
          <h1 class="hero-title">Không Gian Điện Ảnh Riêng Tư</h1>
          <p class="hero-overview">Đăng nhập để mở thư viện phim của bạn hoặc phát trực tiếp tệp từ máy.</p>
          <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
            <button class="btn-download" id="hero-unlock-btn">🔑 Đăng nhập</button>
            <button class="ep-btn" id="hero-quick-btn">Phát tệp từ máy</button>
          </div>
        </div>`;
      document.getElementById("hero-unlock-btn")?.addEventListener("click", handleAuthClick);
      document.getElementById("hero-quick-btn")?.addEventListener("click", () => openQuickPlayer());
      return;
    }

    if (!movie) {
      heroSection.innerHTML = `
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <p style="color: var(--accent-purple); font-weight: bold; margin-bottom: 10px;">RẠP PHIM CÁ NHÂN</p>
          <h1 class="hero-title">Chưa Có Phim Nào</h1>
          <p class="hero-overview">Bấm <strong>+ Thêm phim</strong> để thêm bộ phim đầu tiên vào thư viện của bạn.</p>
          <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
            <button class="btn-download" id="hero-add-btn">+ Thêm phim mới</button>
            <button class="ep-btn" id="hero-quick-btn">Phát tệp từ máy</button>
          </div>
        </div>`;
      document.getElementById("hero-add-btn")?.addEventListener("click", () => openMovieFormModal());
      document.getElementById("hero-quick-btn")?.addEventListener("click", () => openQuickPlayer());
      return;
    }

    heroSection.innerHTML = `
      <div class="hero-overlay"></div>
      ${movie.backdrop_path ? `<img src="${movie.backdrop_path}" alt="${movie.title}" class="hero-img" onerror="this.style.display='none'">` : ""}
      <div class="hero-content">
        <p style="color: var(--accent-purple); font-weight: bold; margin-bottom: 10px;">Mới cập nhật</p>
        <h1 class="hero-title">${movie.title}</h1>
        <div class="hero-meta">
          <span class="rating">★ ${movie.vote_average}</span>
          <span>${String(movie.release_date || "").split("-")[0]}</span>
          <span>${movie.type === "movie" ? "Phim Lẻ" : "Phim Bộ"}</span>
        </div>
        <p class="hero-overview">${(movie.overview || "").slice(0, 160)}</p>
        <button class="btn-download" style="margin-top: 20px; font-size: 1.05rem; padding: 12px 28px;" id="hero-watch-btn">▶ Xem ngay</button>
      </div>`;
    document.getElementById("hero-watch-btn")?.addEventListener("click", () => openMovieModal(movie.id));
  }

  function renderCategories() {
    const genres = new Set(["Tất cả"]);
    allMovies.forEach((m) => (m.categories || "").split(",").forEach((c) => c.trim() && genres.add(c.trim())));

    genreDropdown.innerHTML = Array.from(genres)
      .map((g) => `<a href="#" class="genre-item" data-genre="${g}">${g}</a>`)
      .join("");

    genreDropdown.querySelectorAll(".genre-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        currentGenre = item.dataset.genre;
        dropBtn.innerHTML = `${currentGenre === "Tất cả" ? "Danh mục" : currentGenre} <span style="font-size: 0.7rem;">▼</span>`;
        genreDropdown.classList.remove("show");
        applyFilters();
      });
    });

    const types = [
      { id: "Tất cả", label: "Tất cả" },
      { id: "movie", label: "Phim Lẻ" },
      { id: "tv", label: "Phim Bộ" },
    ];
    categoriesContainer.innerHTML = types
      .map((t) => `<div class="cat-pill ${currentType === t.id ? "active" : ""}" data-type="${t.id}">${t.label}</div>`)
      .join("");

    categoriesContainer.querySelectorAll(".cat-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        categoriesContainer.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        currentType = pill.dataset.type;
        applyFilters();
      });
    });
  }

  function applyFilters() {
    filteredMovies = allMovies.filter((m) => {
      const matchGenre = currentGenre === "Tất cả" || (m.categories || "").includes(currentGenre);
      const matchType = currentType === "Tất cả" || m.type === currentType;
      return matchGenre && matchType;
    });
    currentPage = 1;
    renderMovies(false);
  }

  function renderMovies(locked = false) {
    if (locked) {
      movieGrid.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-dim);">Đăng nhập để xem danh sách phim trong thư viện.</p>';
      renderPagination(0);
      return;
    }

    if (!filteredMovies.length) {
      movieGrid.innerHTML = '<p style="text-align: center; width: 100%; color: var(--text-dim);">Chưa có phim nào phù hợp.</p>';
      renderPagination(0);
      return;
    }

    const start = (currentPage - 1) * moviesPerPage;
    const paged = filteredMovies.slice(start, start + moviesPerPage);

    movieGrid.innerHTML = paged
      .map(
        (movie, idx) => `
        <div class="movie-card reveal" data-id="${movie.id}" style="transition-delay: ${(idx % 5) * 0.08}s">
          <div class="poster-container">
            ${
              movie.poster_path
                ? `<img src="${movie.poster_path}" alt="${movie.title}" class="card-poster" loading="lazy" onerror="this.style.display='none'">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;color:var(--accent-purple);font-weight:700;background:rgba(168,85,247,0.08);">▶ PHÁT</div>`
            }
          </div>
          <div class="card-content">
            <h3 class="card-title">${movie.title}</h3>
            <div class="card-info">
              <span>${String(movie.release_date || "").split("-")[0]}</span>
              <span class="rating">★ ${movie.vote_average || "HD"}</span>
            </div>
          </div>
        </div>`
      )
      .join("");

    movieGrid.querySelectorAll(".movie-card").forEach((card) => {
      card.addEventListener("click", () => openMovieModal(card.dataset.id));
      revealObserver.observe(card);
    });

    renderPagination(filteredMovies.length);
  }

  function renderPagination(totalItems) {
    let container = document.querySelector(".pagination-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "pagination-container";
      movieGrid.after(container);
    }
    const totalPages = Math.ceil(totalItems / moviesPerPage);
    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      ${currentPage > 1 ? `<button class="page-btn" id="prev-page">Trang trước</button>` : ""}
      <span class="page-info">Trang ${currentPage} / ${totalPages}</span>
      ${currentPage < totalPages ? `<button class="page-btn" id="next-page">Trang sau</button>` : ""}`;
    document.getElementById("prev-page")?.addEventListener("click", () => { currentPage--; renderMovies(false); });
    document.getElementById("next-page")?.addEventListener("click", () => { currentPage++; renderMovies(false); });
  }

  function closeModal() {
    destroyPlayer(true);
    modal.style.display = "none";
    document.body.style.overflow = "auto";
    modal.querySelector(".modal-content").innerHTML = "";
  }

  function openMovieModal(movieId) {
    const movie = allMovies.find((m) => String(m.id) === String(movieId));
    if (!movie) return;

    const episodes = movie.episodes || [];
    const playEp = (ep, playerEl, labelEl) => {
      if (labelEl) labelEl.innerHTML = `Đang phát: <strong>${movie.title}</strong>${episodes.length > 1 ? ` — ${ep.name}` : ""}`;
      if (ep.m3u8_text) {
        mountArtPlayer(playerEl, createPlaylistBlobUrl(ep.m3u8_text), true);
      } else if (ep.m3u8) {
        mountArtPlayer(playerEl, ep.m3u8);
      }
    };

    const catsHtml = (movie.categories || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => `<span class="cinema-badge">${c}</span>`)
      .join("");

    modal.innerHTML = `
      <span class="close-modal">&times;</span>
      <div class="modal-content cinema-modal-box">
        <div class="cinema-theater">
          <div class="cinema-topbar">
            <div class="cinema-now-playing" id="cinema-now-playing">Đang phát: <strong>${movie.title}</strong></div>
            ${
              getAdminKey()
                ? `<div style="display:flex;gap:8px;flex-shrink:0;">
                     <button class="ep-btn" id="edit-movie-btn" style="padding:6px 12px;font-size:0.8rem;">✏️ Sửa</button>
                     <button class="ep-btn" id="delete-movie-btn" style="color:#f87171;padding:6px 12px;font-size:0.8rem;">Xóa phim</button>
                   </div>`
                : ""
            }
          </div>
          <div class="player-stage" id="modal-player"></div>
        </div>
        <div class="cinema-body">
          ${
            episodes.length > 1
              ? `<div class="ep-section-title">Danh sách tập (${episodes.length})</div>
                 <div class="ep-list">${episodes
                   .map((ep, i) => `<button class="ep-btn ${i === 0 ? "active" : ""}" data-idx="${i}">${ep.name}</button>`)
                   .join("")}</div>`
              : ""
          }
          <div class="cinema-info-card">
            <img src="${movie.poster_path || ""}" alt="${movie.title}" class="cinema-poster" onerror="this.style.display='none'" />
            <div>
              <h2 style="margin:0 0 4px;">${movie.title}</h2>
              ${movie.original_title ? `<div style="color:var(--text-dim);font-style:italic;font-size:0.95rem;">${movie.original_title}</div>` : ""}
              <div class="cinema-meta-row">
                <span class="rating">★ ${movie.vote_average || "HD"}</span>
                <span>${movie.release_date || ""}</span>
                <span>${movie.type === "movie" ? "Phim Lẻ" : "Phim Bộ"}</span>
                ${catsHtml}
              </div>
              <p class="cinema-overview">${movie.overview || "Chưa có mô tả cho phim này."}</p>
            </div>
          </div>
        </div>
      </div>`;

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
    modal.querySelector(".close-modal").addEventListener("click", closeModal);

    const playerEl = document.getElementById("modal-player");
    const labelEl = document.getElementById("cinema-now-playing");
    if (episodes[0]) playEp(episodes[0], playerEl, labelEl);

    modal.querySelectorAll(".ep-btn[data-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll(".ep-btn[data-idx]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const ep = episodes[Number(btn.dataset.idx)];
        if (ep) playEp(ep, playerEl, labelEl);
      });
    });

    document.getElementById("edit-movie-btn")?.addEventListener("click", () => {
      destroyPlayer(true);
      openMovieFormModal(movie);
    });

    document.getElementById("delete-movie-btn")?.addEventListener("click", async () => {
      if (!confirm(`Xóa "${movie.title}" khỏi thư viện?`)) return;
      const res = await fetch(`${WORKER_API_URL}?id=${encodeURIComponent(movie.id)}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": getAdminKey() },
      });
      if (!res.ok) return alert("Xóa thất bại.");
      const data = await res.json();
      allMovies = data.movies || [];
      closeModal();
      renderHero(allMovies[0], false);
      renderCategories();
      applyFilters();
    });
  }

  function openMovieFormModal(existingMovie = null) {
    const isEdit = Boolean(existingMovie);
    let workingEpisodes = isEdit ? (existingMovie.episodes || []).map((e) => ({ ...e })) : [];

    modal.innerHTML = `
      <span class="close-modal">&times;</span>
      <div class="modal-content" style="padding: 28px;">
        <h2 style="margin-bottom: 14px;">${isEdit ? `✏️ Sửa phim: ${existingMovie.title}` : "+ Thêm phim mới"}</h2>

        <div class="admin-row">
          <input type="text" class="field-input" id="tmdb-query" placeholder="Tìm nhanh thông tin phim (vd: One Piece, Inception)..." />
          <button class="btn-download" id="tmdb-search-btn">Tìm</button>
          <button class="ep-btn" id="toggle-manual-btn" type="button">✍️ Tùy chỉnh thông tin</button>
        </div>

        <div id="tmdb-results" class="tmdb-results" style="display:none;"></div>

        <div id="manual-meta-box" style="display:${isEdit ? "block" : "none"};">
          <div class="meta-grid">
            <input type="text" class="field-input" id="m-title" placeholder="Tên phim *" value="${(existingMovie?.title || "").replace(/"/g, "&quot;")}" />
            <input type="text" class="field-input" id="m-orig" placeholder="Tên gốc" value="${(existingMovie?.original_title || "").replace(/"/g, "&quot;")}" />
            <select class="field-input" id="m-type" style="background:#171b26;">
              <option value="movie" ${existingMovie?.type !== "tv" ? "selected" : ""}>Phim Lẻ</option>
              <option value="tv" ${existingMovie?.type === "tv" ? "selected" : ""}>Phim Bộ</option>
            </select>
            <input type="text" class="field-input" id="m-date" placeholder="Năm / Ngày (vd: 2026)" value="${existingMovie?.release_date || "2026"}" />
            <input type="text" class="field-input" id="m-rate" placeholder="Điểm (vd: 8.5)" value="${existingMovie?.vote_average ?? ""}" />
            <input type="text" class="field-input" id="m-cats" placeholder="Thể loại (cách nhau dấu phẩy)" value="${(existingMovie?.categories || "Cá nhân").replace(/"/g, "&quot;")}" />
            <input type="url" class="field-input full" id="m-poster" placeholder="Link ảnh Poster (https://...)" value="${existingMovie?.poster_path || ""}" />
            <input type="url" class="field-input full" id="m-backdrop" placeholder="Link ảnh nền Backdrop (https://...)" value="${existingMovie?.backdrop_path || ""}" />
            <textarea class="field-input full" id="m-overview" rows="3" placeholder="Mô tả nội dung phim...">${existingMovie?.overview || ""}</textarea>
          </div>
        </div>

        <div class="admin-row" style="margin-top: 10px;">
          <label class="ep-btn" for="m3u8-files" style="display:inline-flex;align-items:center;">+ Thêm tệp từ máy</label>
          <input type="file" id="m3u8-files" accept=".m3u8" multiple style="display:none" />
          <input type="url" class="field-input" id="ep-url-input" placeholder="Hoặc dán URL phát trực tiếp..." />
          <button class="ep-btn" id="add-url-ep-btn" type="button">+ Thêm URL</button>
        </div>

        <div id="ep-editor-list" style="margin: 10px 0 16px;"></div>

        <div class="admin-row">
          <button class="btn-download" id="save-kv-btn">${isEdit ? "Lưu thay đổi" : "Lưu vào thư viện"}</button>
        </div>
      </div>`;

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
    modal.querySelector(".close-modal").addEventListener("click", closeModal);

    const queryEl = document.getElementById("tmdb-query");
    const searchBtn = document.getElementById("tmdb-search-btn");
    const toggleManualBtn = document.getElementById("toggle-manual-btn");
    const manualBox = document.getElementById("manual-meta-box");
    const resultsEl = document.getElementById("tmdb-results");
    const filesEl = document.getElementById("m3u8-files");
    const epUrlInput = document.getElementById("ep-url-input");
    const addUrlEpBtn = document.getElementById("add-url-ep-btn");
    const epListEl = document.getElementById("ep-editor-list");
    const saveBtn = document.getElementById("save-kv-btn");

    const fTitle = document.getElementById("m-title");
    const fOrig = document.getElementById("m-orig");
    const fType = document.getElementById("m-type");
    const fDate = document.getElementById("m-date");
    const fRate = document.getElementById("m-rate");
    const fCats = document.getElementById("m-cats");
    const fPoster = document.getElementById("m-poster");
    const fBackdrop = document.getElementById("m-backdrop");
    const fOverview = document.getElementById("m-overview");

    let tmdbId = existingMovie?.tmdb_id || null;

    function renderEpEditor() {
      if (!workingEpisodes.length) {
        epListEl.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Chưa có tập / nguồn phát nào.</p>';
        return;
      }
      epListEl.innerHTML = workingEpisodes
        .map(
          (ep, idx) => `
          <div class="ep-edit-row">
            <input type="text" class="field-input ep-name-inp" data-idx="${idx}" value="${(ep.name || "").replace(/"/g, "&quot;")}" placeholder="Tên tập" />
            <span style="color:var(--text-dim);font-size:0.78rem;white-space:nowrap;">${ep.m3u8_text ? "Tệp đã nạp" : "URL ngoài"}</span>
            <button class="ep-btn ep-del-btn" data-idx="${idx}" type="button" style="color:#f87171;">Xóa</button>
          </div>`
        )
        .join("");

      epListEl.querySelectorAll(".ep-name-inp").forEach((inp) => {
        inp.addEventListener("input", () => {
          workingEpisodes[Number(inp.dataset.idx)].name = inp.value;
        });
      });
      epListEl.querySelectorAll(".ep-del-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          workingEpisodes.splice(Number(btn.dataset.idx), 1);
          renderEpEditor();
        });
      });
    }

    renderEpEditor();

    toggleManualBtn.addEventListener("click", () => {
      manualBox.style.display = manualBox.style.display === "none" ? "block" : "none";
    });

    const doSearch = async () => {
      const q = queryEl.value.trim();
      if (!q) return;
      resultsEl.style.display = "grid";
      resultsEl.innerHTML = '<p style="color:var(--text-dim)">Đang tìm thông tin phim...</p>';
      const res = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=vi-VN&query=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      const items = (data.results || []).filter((r) => r.media_type === "movie" || r.media_type === "tv").slice(0, 12);
      if (!items.length) {
        resultsEl.innerHTML = '<p style="color:var(--text-dim)">Không tìm thấy kết quả. Dùng nút "✍️ Tùy chỉnh thông tin" để tự nhập.</p>';
        manualBox.style.display = "block";
        if (!fTitle.value.trim()) fTitle.value = q;
        return;
      }
      resultsEl.innerHTML = items
        .map(
          (item, idx) => `
          <div class="tmdb-card" data-idx="${idx}">
            <img src="${item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : ""}" onerror="this.style.display='none'">
            <div class="tmdb-card-title">${item.title || item.name}</div>
            <div style="font-size:0.75rem;color:var(--text-dim);">${(item.release_date || item.first_air_date || "").slice(0, 4)}</div>
          </div>`
        )
        .join("");

      resultsEl.querySelectorAll(".tmdb-card").forEach((card) => {
        card.addEventListener("click", () => {
          resultsEl.querySelectorAll(".tmdb-card").forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          const item = items[Number(card.dataset.idx)];
          tmdbId = item.id;
          fTitle.value = item.title || item.name || "";
          fOrig.value = item.original_title || item.original_name || "";
          fType.value = item.media_type === "tv" ? "tv" : "movie";
          fDate.value = item.release_date || item.first_air_date || "2026";
          fRate.value = Number((item.vote_average || 0).toFixed(1));
          fCats.value = (item.genre_ids || []).map((id) => TMDB_GENRES[id]).filter(Boolean).join(", ") || "Cá nhân";
          fPoster.value = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "";
          fBackdrop.value = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : "";
          fOverview.value = item.overview || "";
          manualBox.style.display = "block";
        });
      });
    };

    searchBtn.addEventListener("click", doSearch);
    queryEl.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

    filesEl.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      for (const f of files) {
        const text = await f.text();
        const epName = files.length === 1 && !workingEpisodes.length ? "Full" : f.name.replace(/\.m3u8$/i, "").replace(/[_-]+/g, " ");
        workingEpisodes.push({ name: epName, m3u8_text: text });
      }
      renderEpEditor();
      filesEl.value = "";
    });

    addUrlEpBtn.addEventListener("click", () => {
      const u = epUrlInput.value.trim();
      if (!u) return;
      workingEpisodes.push({ name: `Tập ${workingEpisodes.length + 1}`, m3u8: u });
      epUrlInput.value = "";
      renderEpEditor();
    });

    saveBtn.addEventListener("click", async () => {
      const title = fTitle.value.trim();
      if (!title) {
        manualBox.style.display = "block";
        return alert("Hãy chọn phim hoặc nhập Tên phim.");
      }
      if (!workingEpisodes.length) return alert("Hãy thêm ít nhất 1 tệp hoặc URL phát.");
      const pw = getAdminKey();
      if (!pw) return alert("Vui lòng đăng nhập lại.");

      saveBtn.disabled = true;
      saveBtn.textContent = "Đang lưu...";

      const entry = {
        id: existingMovie?.id || Date.now(),
        tmdb_id: tmdbId,
        type: fType.value === "tv" || workingEpisodes.length > 1 ? "tv" : "movie",
        title,
        original_title: fOrig.value.trim(),
        overview: fOverview.value.trim(),
        poster_path: fPoster.value.trim(),
        backdrop_path: fBackdrop.value.trim(),
        release_date: fDate.value.trim() || "2026",
        vote_average: fRate.value.trim() ? Number(fRate.value) || fRate.value.trim() : "HD",
        categories: fCats.value.trim() || "Cá nhân",
        episodes: workingEpisodes,
      };

      try {
        const res = await fetch(WORKER_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Key": pw },
          body: JSON.stringify(entry),
        });
        if (!res.ok) {
          alert("Lưu thất bại. Kiểm tra lại phiên đăng nhập.");
          saveBtn.disabled = false;
          saveBtn.textContent = isEdit ? "Lưu thay đổi" : "Lưu vào thư viện";
          return;
        }
        const data = await res.json();
        allMovies = data.movies || [entry, ...allMovies];
        closeModal();
        renderHero(allMovies[0], false);
        renderCategories();
        applyFilters();
      } catch (err) {
        alert("Lỗi kết nối: " + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? "Lưu thay đổi" : "Lưu vào thư viện";
      }
    });
  }

  function openQuickPlayer(initialUrl = "", title = "Phát trực tiếp từ máy") {
    modal.innerHTML = `
      <span class="close-modal">&times;</span>
      <div class="modal-content cinema-modal-box">
        <div class="cinema-theater">
          <div class="cinema-topbar">
            <div class="cinema-now-playing" id="qp-title"><strong>${title}</strong></div>
          </div>
          <div class="player-stage" id="qp-player"></div>
        </div>
        <div class="cinema-body">
          <div class="quick-play-bar">
            <input type="url" class="field-input" id="qp-url" placeholder="Dán liên kết phát..." value="${initialUrl}" />
            <button class="btn-download" id="qp-go">Phát</button>
            <label class="ep-btn" for="qp-file" style="display:inline-flex;align-items:center;">Chọn tệp từ máy</label>
            <input type="file" id="qp-file" accept=".m3u8,application/vnd.apple.mpegurl,application/x-mpegurl" style="display:none" />
          </div>
          <div class="quick-drop" id="qp-drop">Kéo & thả tệp phát vào đây</div>
        </div>
      </div>`;

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
    modal.querySelector(".close-modal").addEventListener("click", closeModal);

    const urlInput = document.getElementById("qp-url");
    const goBtn = document.getElementById("qp-go");
    const fileInput = document.getElementById("qp-file");
    const dropEl = document.getElementById("qp-drop");
    const playerEl = document.getElementById("qp-player");
    const titleEl = document.getElementById("qp-title");

    const playFile = async (file) => {
      if (!file) return;
      titleEl.innerHTML = `Đang phát: <strong>${file.name}</strong>`;
      destroyPlayer(true);
      const text = await file.text();
      if (typeof Hls !== "undefined" && Hls.isSupported()) {
        mountArtPlayer(playerEl, createPlaylistBlobUrl(text), true);
      } else {
        const bytes = new TextEncoder().encode(text);
        let bin = "";
        bytes.forEach((b) => { bin += String.fromCharCode(b); });
        mountArtPlayer(playerEl, `data:application/vnd.apple.mpegurl;base64,${btoa(bin)}`);
      }
    };

    goBtn.addEventListener("click", () => {
      const u = urlInput.value.trim();
      if (u) mountArtPlayer(playerEl, u);
    });
    urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") goBtn.click(); });
    fileInput.addEventListener("change", (e) => playFile(e.target.files[0]));
    dropEl.addEventListener("dragover", (e) => { e.preventDefault(); dropEl.classList.add("dragover"); });
    dropEl.addEventListener("dragleave", () => dropEl.classList.remove("dragover"));
    dropEl.addEventListener("drop", (e) => {
      e.preventDefault();
      dropEl.classList.remove("dragover");
      playFile(e.dataTransfer.files[0]);
    });

    if (initialUrl) mountArtPlayer(playerEl, initialUrl);
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  initApp();
});
