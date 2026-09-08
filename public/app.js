/* ============================================================
   TANULÓBARÁT - TELJES APP.JS
   A jelenlegi public/index.html-hez igazítva.
   ============================================================ */

"use strict";

/* ============================================================
   ÁLLAPOT
   ============================================================ */

const state = {
    user: null,
    friends: [],
    requests: [],
    materials: [],
    grades: [],

    currentFriend: null,
    currentMessages: [],
    currentPage: "home",

    ratingTargetId: null,
    ratingValue: 0,

    gradeTargetId: null,
    gradeValue: 0,

    generatedAI: null,
    aiType: "material",

    searchUsers: []
};

let friendSearchTimer = null;


/* ============================================================
   SEGÉDFÜGGVÉNYEK
   ============================================================ */

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(date) {
    if (!date) return "";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "";
    }

    return d.toLocaleString("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}


/* ============================================================
   API
   ============================================================ */

async function api(url, options = {}) {
    const config = {
        method: options.method || "GET",
        credentials: "include",
        ...options
    };

    /*
       JSON body esetén Content-Type.
       FormData esetén NEM állítjuk be kézzel.
    */

    const headers = {
        ...(options.headers || {})
    };

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers["Content-Type"]
    ) {
        headers["Content-Type"] = "application/json";
    }

    config.headers = headers;

    let response;

    try {
        response = await fetch(url, config);
    } catch (error) {
        throw new Error(
            "Nem sikerült kapcsolódni a szerverhez."
        );
    }

    let data = {};

    try {
        data = await response.json();
    } catch (_) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Szerverhiba (${response.status})`
        );
    }

    return data;
}


/* ============================================================
   ÉRTESÍTÉS
   ============================================================ */

function showToast(message, type = "info") {
    const container =
        $("toastContainer") ||
        document.body;

    const toast =
        document.createElement("div");

    toast.className =
        `toast toast-${type}`;

    toast.textContent =
        String(message || "");

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.add("hide");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}


/* ============================================================
   BETÖLTÉS
   ============================================================ */

function setLoading(show, text = "Betöltés...") {
    const loading = $("globalLoading");

    if (!loading) {
        return;
    }

    if ($("loadingText")) {
        $("loadingText").textContent = text;
    }

    loading.classList.toggle(
        "hidden",
        !show
    );
}


/* ============================================================
   MODALOK
   ============================================================ */

function openModal(id) {
    const modal = $(id);

    if (!modal) {
        console.warn(
            "Nem található modal:",
            id
        );
        return;
    }

    modal.classList.remove("hidden");
    modal.classList.add("active");
    modal.style.display = "flex";
}

function closeModal(id) {
    const modal = $(id);

    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.classList.add("hidden");
    modal.style.display = "none";
}


/* ============================================================
   BEJELENTKEZÉS / APP MEGJELENÍTÉSE
   ============================================================ */

function showAuth() {
    const auth = $("authView");
    const app = $("appView");

    if (auth) {
        auth.classList.remove("hidden");
        auth.style.display = "";
    }

    if (app) {
        app.classList.add("hidden");
        app.style.display = "none";
    }
}

function showApp() {
    const auth = $("authView");
    const app = $("appView");

    if (auth) {
        auth.classList.add("hidden");
        auth.style.display = "none";
    }

    if (app) {
        app.classList.remove("hidden");
        app.style.display = "block";
    }

    updateUserUI();
    navigate("home");
    ensureProfileEditButton();
}


/* ============================================================
   OLDALVÁLTÁS
   ============================================================ */

function navigate(page) {
    const pages = [
        "home",
        "learning",
        "grades",
        "friends",
        "profile"
    ];

    if (!pages.includes(page)) {
        page = "home";
    }

    state.currentPage = page;

    document
        .querySelectorAll(".page")
        .forEach(section => {
            const active =
                section.id === `page-${page}`;

            section.classList.toggle(
                "active",
                active
            );

            section.classList.toggle(
                "hidden",
                !active
            );

            section.style.display =
                active ? "" : "none";
        });

    document
        .querySelectorAll("[data-page]")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

    $("sidebar")?.classList.remove("open");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ============================================================
   FELHASZNÁLÓI FELÜLET
   ============================================================ */

function updateUserUI() {
    if (!state.user) {
        return;
    }

    const name =
        state.user.name ||
        state.user.username ||
        "Tanuló";

    const username =
        state.user.username ||
        "";

    const grade =
        state.user.grade
            ? `${state.user.grade}. osztály`
            : "";

    const initial =
        name.charAt(0).toUpperCase();

    [
        "homeName",
        "profileName",
        "userName",
        "welcomeName",
        "topUserName",
        "sidebarUserName"
    ].forEach(id => {
        if ($(id)) {
            $(id).textContent = name;
        }
    });

    if ($("profileUsername")) {
        $("profileUsername").textContent =
            `@${username}`;
    }

    if ($("profileEmail")) {
        $("profileEmail").textContent =
            state.user.email || "-";
    }

    if ($("profileGrade")) {
        $("profileGrade").textContent =
            grade || "-";
    }

    if ($("topUserGrade")) {
        $("topUserGrade").textContent =
            grade;
    }

    if ($("sidebarUserUsername")) {
        $("sidebarUserUsername").textContent =
            `@${username}`;
    }

    /*
       Ha van valódi profilkép, megpróbáljuk képként
       megjeleníteni. Ha nincs, kezdőbetű marad.
    */

    [
        "profileAvatar",
        "userAvatar",
        "sidebarAvatar"
    ].forEach(id => {
        const el = $(id);

        if (!el) {
            return;
        }

        if (
            state.user.avatar &&
            state.user.avatar.startsWith("data:image/")
        ) {
            if (el.tagName === "IMG") {
                el.src = state.user.avatar;
            } else {
                el.innerHTML =
                    `<img src="${escapeHTML(state.user.avatar)}"
                    alt="Profilkép"
                    style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            }
        } else {
            el.textContent = initial;
        }
    });

    if ($("profileJoined")) {
        $("profileJoined").textContent =
            state.user.createdAt
                ? formatDate(state.user.createdAt).split(",")[0]
                : "-";
    }

    if ($("currentDate")) {
        $("currentDate").textContent =
            new Date().toLocaleDateString(
                "hu-HU",
                {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            );
    }
}


/* ============================================================
   BEJELENTKEZÉS ELLENŐRZÉSE
   ============================================================ */

async function checkLogin() {
    try {
        const data =
            await api("/api/me");

        if (data && data.user) {
            state.user = data.user;

            showApp();

            await loadAll();
        } else {
            state.user = null;
            showAuth();
        }
    } catch (error) {
        state.user = null;
        showAuth();
    }
}


/* ============================================================
   BEJELENTKEZÉS
   ============================================================ */

async function login() {
    const username =
        $("loginUsername")?.value.trim();

    const password =
        $("loginPassword")?.value || "";

    if (!username || !password) {
        showToast(
            "Add meg a felhasználónevet és a jelszót!",
            "error"
        );
        return;
    }

    const button =
        $("loginButton");

    if (button) {
        button.disabled = true;
        button.textContent =
            "⏳ Belépés...";
    }

    try {
        const data =
            await api(
                "/api/login",
                {
                    method: "POST",
                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );

        if (!data.user) {
            throw new Error(
                "A szerver nem adott vissza felhasználót."
            );
        }

        state.user = data.user;

        showApp();

        await loadAll();

        showToast(
            "Sikeres bejelentkezés! 👋",
            "success"
        );

    } catch (error) {
        console.error(
            "Bejelentkezési hiba:",
            error
        );

        showToast(
            error.message ||
            "Sikertelen bejelentkezés.",
            "error"
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                "Belépés";
        }
    }
}


/* ============================================================
   REGISZTRÁCIÓ
   ============================================================ */

async function register() {
    const name =
        $("registerName")?.value.trim();

    const username =
        $("registerUsername")?.value.trim();

    const email =
        $("registerEmail")?.value.trim();

    const password =
        $("registerPassword")?.value || "";

    const grade =
        Number(
            $("registerGrade")?.value
        );

    if (
        !name ||
        !username ||
        !email ||
        !password ||
        !grade
    ) {
        showToast(
            "Tölts ki minden mezőt!",
            "error"
        );
        return;
    }

    if (grade < 5 || grade > 12) {
        showToast(
            "Az évfolyam 5 és 12 között lehet.",
            "error"
        );
        return;
    }

    if (password.length < 6) {
        showToast(
            "A jelszó legalább 6 karakter legyen.",
            "error"
        );
        return;
    }

    const button =
        $("registerButton");

    if (button) {
        button.disabled = true;
        button.textContent =
            "⏳ Regisztráció...";
    }

    try {
        const data =
            await api(
                "/api/register",
                {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        username,
                        email,
                        password,
                        grade
                    })
                }
            );

        if (!data.user) {
            throw new Error(
                "A regisztráció nem sikerült."
            );
        }

        state.user = data.user;

        showApp();

        await loadAll();

        showToast(
            "Sikeres regisztráció! 🎉",
            "success"
        );

    } catch (error) {
        console.error(
            "Regisztrációs hiba:",
            error
        );

        showToast(
            error.message ||
            "Sikertelen regisztráció.",
            "error"
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                "Regisztráció";
        }
    }
}


/* ============================================================
   KIJELENTKEZÉS
   ============================================================ */

async function logout() {
    try {
        await api(
            "/api/logout",
            {
                method: "POST"
            }
        );
    } catch (error) {
        console.warn(
            "Kijelentkezési API hiba:",
            error
        );
    }

    state.user = null;
    state.friends = [];
    state.requests = [];
    state.materials = [];
    state.grades = [];
    state.currentFriend = null;
    state.currentMessages = [];
    state.searchUsers = [];

    showAuth();

    showToast(
        "Kijelentkeztél.",
        "info"
    );
}


/* ============================================================
   BARÁTOK BETÖLTÉSE
   ============================================================ */

async function loadFriends() {
    try {
        const data =
            await api("/api/friends");

        state.friends =
            Array.isArray(data.friends)
                ? data.friends
                : [];

        renderFriends();
        renderSendFriendList();
        renderSearchResults();

        if ($("friendCount")) {
            $("friendCount").textContent =
                state.friends.length;
        }

        if ($("friendListCount")) {
            $("friendListCount").textContent =
                state.friends.length;
        }

        if ($("profileFriendCount")) {
            $("profileFriendCount").textContent =
                state.friends.length;
        }

    } catch (error) {
        console.error(
            "Barátok betöltési hiba:",
            error
        );
    }
}


function renderFriends() {
    const box =
        $("friendsList");

    if (!box) {
        return;
    }

    if (!state.friends.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">👥</div>
                <h3>Még nincsenek barátaid</h3>
                <p>
                    Keress rá valakire, és küldj neki
                    baráti kérést.
                </p>
            </div>
        `;
        return;
    }

    box.innerHTML =
        state.friends.map(friend => {
            const initial =
                (
                    friend.name ||
                    friend.username ||
                    "?"
                )
                .charAt(0)
                .toUpperCase();

            return `
                <div class="friend-card">

                    <div class="friend-avatar">
                        ${escapeHTML(initial)}
                    </div>

                    <div class="friend-info">
                        <strong>
                            ${escapeHTML(friend.name || "")}
                        </strong>

                        <span>
                            @${escapeHTML(friend.username || "")}
                        </span>
                    </div>

                    <div class="friend-actions">

                        <button
                            type="button"
                            class="secondary-button"
                            data-chat-id="${Number(friend.id)}">
                            💬 Chat
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-rate-id="${Number(friend.id)}">
                            ⭐ Értékelés
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-grade-id="${Number(friend.id)}">
                            📊 Jegy
                        </button>

                    </div>

                </div>
            `;
        }).join("");
}


/* ============================================================
   BARÁTI KÉRÉSEK
   ============================================================ */

async function loadRequests() {
    try {
        const data =
            await api(
                "/api/friends/requests"
            );

        state.requests =
            Array.isArray(data.requests)
                ? data.requests
                : [];

        renderRequests();

        const badge =
            $("friendRequestBadge");

        if (badge) {
            badge.textContent =
                state.requests.length;

            badge.classList.toggle(
                "hidden",
                state.requests.length === 0
            );
        }

    } catch (error) {
        console.error(
            "Kérések betöltési hiba:",
            error
        );
    }
}


function renderRequests() {
    const box =
        $("friendRequests");

    if (!box) {
        return;
    }

    if (!state.requests.length) {
        box.innerHTML =
            `<div class="empty-inline">
                Nincs új baráti kérés.
            </div>`;
        return;
    }

    box.innerHTML =
        state.requests.map(request => `
            <div class="request-card">

                <div class="friend-avatar">
                    ${escapeHTML(
                        (
                            request.name || "?"
                        )
                        .charAt(0)
                        .toUpperCase()
                    )}
                </div>

                <div class="friend-info">
                    <strong>
                        ${escapeHTML(request.name || "")}
                    </strong>

                    <span>
                        @${escapeHTML(request.username || "")}
                    </span>
                </div>

                <div class="friend-actions">

                    <button
                        type="button"
                        class="primary-button"
                        data-accept-id="${Number(request.id)}">
                        ✓ Elfogad
                    </button>

                    <button
                        type="button"
                        class="secondary-button"
                        data-reject-id="${Number(request.id)}">
                        ✕ Elutasít
                    </button>

                </div>

            </div>
        `).join("");
}


async function acceptFriend(id) {
    try {
        await api(
            `/api/friends/${Number(id)}/accept`,
            {
                method: "POST",
                body: JSON.stringify({})
            }
        );

        await Promise.all([
            loadFriends(),
            loadRequests()
        ]);

        showToast(
            "Barátkérelem elfogadva! 👥",
            "success"
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


async function rejectFriend(id) {
    try {
        await api(
            `/api/friends/${Number(id)}/reject`,
            {
                method: "POST",
                body: JSON.stringify({})
            }
        );

        await loadRequests();

        showToast(
            "Barátkérelem elutasítva.",
            "info"
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   🔎 BARÁTKERESÉS
   ============================================================ */

async function searchUsers() {
    const input =
        $("userSearch");

    const box =
        $("searchResults");

    if (!input || !box) {
        console.error(
            "Hiányzik a userSearch vagy searchResults."
        );
        return;
    }

    const query =
        String(input.value || "").trim();

    if (!query) {
        state.searchUsers = [];

        box.innerHTML =
            `<div class="empty-inline">
                Írj be egy nevet vagy felhasználónevet.
            </div>`;

        return;
    }

    box.innerHTML =
        `<div class="empty-inline">
            🔎 Keresés: <strong>${escapeHTML(query)}</strong>...
        </div>`;

    try {
        /*
           FONTOS:
           encodeURIComponent miatt szóköz, ékezet,
           @ stb. is biztonságosan elküldhető.
        */

        const url =
            `/api/users?q=${encodeURIComponent(query)}`;

        const data =
            await api(url);

        state.searchUsers =
            Array.isArray(data.users)
                ? data.users
                : [];

        renderSearchResults();

    } catch (error) {
        console.error(
            "Barátkeresési hiba:",
            error
        );

        state.searchUsers = [];

        box.innerHTML =
            `<div class="empty-inline">
                ❌ ${escapeHTML(
                    error.message ||
                    "Hiba történt a keresés közben."
                )}
            </div>`;
    }
}


function scheduleFriendSearch() {
    clearTimeout(
        friendSearchTimer
    );

    friendSearchTimer =
        setTimeout(
            searchUsers,
            300
        );
}


function renderSearchResults() {
    const box =
        $("searchResults");

    if (!box) {
        return;
    }

    if (!state.searchUsers.length) {
        box.innerHTML =
            `<div class="empty-inline">
                Nem található ilyen tanuló.
            </div>`;
        return;
    }

    const friendIds =
        new Set(
            state.friends.map(
                friend => Number(friend.id)
            )
        );

    box.innerHTML =
        state.searchUsers
            .map(user => {
                const id =
                    Number(user.id);

                const isFriend =
                    friendIds.has(id);

                const name =
                    user.name ||
                    user.username ||
                    "Ismeretlen";

                const username =
                    user.username ||
                    "";

                const grade =
                    user.grade
                        ? `${user.grade}. osztály`
                        : "";

                return `
                    <div class="search-result-card">

                        <div class="friend-avatar">
                            ${escapeHTML(
                                name
                                    .charAt(0)
                                    .toUpperCase()
                            )}
                        </div>

                        <div class="friend-info">

                            <strong>
                                ${escapeHTML(name)}
                            </strong>

                            <span>
                                @${escapeHTML(username)}
                                ${grade
                                    ? ` · ${escapeHTML(grade)}`
                                    : ""}
                            </span>

                        </div>

                        ${
                            isFriend
                                ? `
                                    <span class="count-pill">
                                        ✓ Barát
                                    </span>
                                  `
                                : `
                                    <button
                                        type="button"
                                        class="primary-button"
                                        data-request-id="${id}">
                                        + Barátnak jelölés
                                    </button>
                                  `
                        }

                    </div>
                `;
            })
            .join("");
}


async function sendFriendRequest(id) {
    try {
        await api(
            "/api/friends/request",
            {
                method: "POST",
                body: JSON.stringify({
                    userId: Number(id)
                })
            }
        );

        showToast(
            "Barátkérelem elküldve! 👥",
            "success"
        );

        await searchUsers();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   CHAT
   ============================================================ */

async function openChat(friendId) {
    const friend =
        state.friends.find(
            f =>
                Number(f.id) ===
                Number(friendId)
        );

    if (!friend) {
        showToast(
            "A barát nem található.",
            "error"
        );
        return;
    }

    state.currentFriend =
        friend;

    if ($("chatTitle")) {
        $("chatTitle").textContent =
            friend.name;
    }

    if ($("chatAvatar")) {
        $("chatAvatar").textContent =
            (
                friend.name ||
                "?"
            )
            .charAt(0)
            .toUpperCase();
    }

    if ($("chatStatus")) {
        $("chatStatus").textContent =
            "Barát";
    }

    openModal(
        "chatModal"
    );

    await loadMessages();

    setTimeout(
        () => {
            $("chatInput")?.focus();
        },
        100
    );
}


async function loadMessages() {
    if (!state.currentFriend) {
        return;
    }

    try {
        const data =
            await api(
                `/api/messages/${Number(
                    state.currentFriend.id
                )}`
            );

        state.currentMessages =
            Array.isArray(data.messages)
                ? data.messages
                : [];

        renderMessages();

    } catch (error) {
        console.error(
            "Üzenetek betöltési hiba:",
            error
        );
    }
}


function renderMessages() {
    const box =
        $("chatMessages");

    if (!box) {
        return;
    }

    if (!state.currentMessages.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">💬</div>
                <h3>Még nincs üzenet</h3>
                <p>
                    Írj egy üzenetet a beszélgetés
                    indításához.
                </p>
            </div>
        `;
        return;
    }

    box.innerHTML =
        state.currentMessages
            .map(message => {
                const mine =
                    Number(message.sender) ===
                    Number(state.user?.id);

                const isMaterial =
                    message.type === "material";

                return `
                    <div class="message-row ${
                        mine
                            ? "mine"
                            : "theirs"
                    }">

                        <div class="message-bubble ${
                            isMaterial
                                ? "material-message"
                                : ""
                        }">

                            ${
                                isMaterial
                                    ? `
                                        <strong>
                                            📚 Tananyag
                                        </strong>

                                        <div>
                                            ${escapeHTML(
                                                message.message || ""
                                            )}
                                        </div>

                                        ${
                                            message.materialId
                                                ? `
                                                    <button
                                                        type="button"
                                                        class="text-button"
                                                        data-material-id="${Number(message.materialId)}">
                                                        Megnyitás →
                                                    </button>
                                                  `
                                                : ""
                                        }
                                      `
                                    : escapeHTML(
                                        message.message || ""
                                      )
                                        .replaceAll(
                                            "\n",
                                            "<br>"
                                        )
                            }

                            <small>
                                ${escapeHTML(
                                    formatDate(
                                        message.date
                                    )
                                )}
                            </small>

                        </div>

                    </div>
                `;
            })
            .join("");

    box.scrollTop =
        box.scrollHeight;
}


async function sendMessage() {
    if (!state.currentFriend) {
        return;
    }

    const input =
        $("chatInput");

    const message =
        input?.value.trim();

    if (!message) {
        return;
    }

    try {
        await api(
            `/api/messages/${Number(
                state.currentFriend.id
            )}`,
            {
                method: "POST",
                body: JSON.stringify({
                    message,
                    type: "text"
                })
            }
        );

        input.value = "";

        await loadMessages();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   AI TANANYAG
   ============================================================ */

function openAIModal() {
    state.generatedAI = null;
    state.aiType = "material";

    if ($("aiSubject")) {
        $("aiSubject").value = "";
    }

    if ($("aiTopic")) {
        $("aiTopic").value = "";
    }

    if ($("aiStatus")) {
        $("aiStatus").textContent = "";
    }

    document
        .querySelectorAll("[data-ai-type]")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.aiType === "material"
            );
        });

    openModal("aiModal");
}


async function generateAI() {
    const subject =
        $("aiSubject")?.value.trim();

    const topic =
        $("aiTopic")?.value.trim();

    if (!subject || !topic) {
        showToast(
            "Add meg a tantárgyat és a témát!",
            "error"
        );
        return;
    }

    try {
        if ($("aiStatus")) {
            $("aiStatus").textContent =
                "✨ Tananyag készítése...";
        }

        const data =
            await api(
                "/api/ai/generate",
                {
                    method: "POST",
                    body: JSON.stringify({
                        subject,
                        topic,
                        type: state.aiType
                    })
                }
            );

        state.generatedAI =
            data;

        closeModal("aiModal");

        showAIPreview(data);

    } catch (error) {
        console.error(
            "AI hiba:",
            error
        );

        if ($("aiStatus")) {
            $("aiStatus").textContent =
                error.message;
        }

        showToast(
            error.message,
            "error"
        );
    }
}


function showAIPreview(data) {
    if (!data) {
        return;
    }

    if ($("previewTitle")) {
        $("previewTitle").textContent =
            data.title ||
            "AI tananyag";
    }

    if ($("previewContent")) {
        let html = "";

        if (data.explanation) {
            html += `
                <h3>📖 Magyarázat</h3>
                <p>
                    ${escapeHTML(
                        data.explanation
                    )}
                </p>
            `;
        }

        if (Array.isArray(data.important)) {
            html += `
                <h3>⭐ Fontos fogalmak</h3>
                <ul>
                    ${
                        data.important
                            .map(
                                item =>
                                    `<li>${escapeHTML(item)}</li>`
                            )
                            .join("")
                    }
                </ul>
            `;
        }

        if (data.examples) {
            html += `
                <h3>💡 Példák</h3>
                <p>
                    ${escapeHTML(
                        data.examples
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>
            `;
        }

        if (data.summary) {
            html += `
                <h3>📝 Összefoglaló</h3>
                <p>
                    ${escapeHTML(
                        data.summary
                    )}
                </p>
            `;
        }

        $("previewContent").innerHTML =
            html ||
            "<p>Nincs megjeleníthető tartalom.</p>";
    }

    openModal(
        "previewModal"
    );
}


/* ============================================================
   TANANYAG KÜLDÉSE
   ============================================================ */

function renderSendFriendList() {
    const box =
        $("sendFriendList");

    if (!box) {
        return;
    }

    if (!state.friends.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">👥</div>
                <h3>Nincs még barátod</h3>
                <p>
                    Előbb jelölj valakit barátnak.
                </p>
            </div>
        `;
        return;
    }

    box.innerHTML =
        state.friends
            .map(friend => `
                <button
                    type="button"
                    class="select-friend-item"
                    data-send-friend-id="${Number(friend.id)}">

                    <span class="friend-avatar">
                        ${escapeHTML(
                            (
                                friend.name ||
                                "?"
                            )
                            .charAt(0)
                            .toUpperCase()
                        )}
                    </span>

                    <span>
                        <strong>
                            ${escapeHTML(
                                friend.name || ""
                            )}
                        </strong>

                        <small>
                            @${escapeHTML(
                                friend.username || ""
                            )}
                        </small>
                    </span>

                </button>
            `)
            .join("");
}


function approveAndSendAI() {
    if (!state.generatedAI) {
        return;
    }

    if (!state.friends.length) {
        closeModal(
            "previewModal"
        );

        showToast(
            "Nincs még barátod, akinek elküldhetnéd.",
            "info"
        );

        return;
    }

    renderSendFriendList();

    openModal(
        "sendFriendModal"
    );
}


async function sendGeneratedMaterial(friendId) {
    const data =
        state.generatedAI;

    if (!data) {
        return;
    }

    try {
        const content =
            JSON.stringify({
                explanation:
                    data.explanation || "",

                important:
                    data.important || [],

                examples:
                    data.examples || "",

                summary:
                    data.summary || ""
            });

        const saved =
            await api(
                "/api/materials",
                {
                    method: "POST",
                    body: JSON.stringify({
                        subject:
                            data.subject,

                        title:
                            data.title,

                        content,

                        type:
                            data.type ||
                            state.aiType,

                        friendId:
                            Number(friendId)
                    })
                }
            );

        /*
           Ha a server.js már létrehozta az üzenetet,
           nem küldünk még egyet.
           Ha nem, akkor létrehozzuk.
        */

        if (
            saved &&
            saved.material &&
            saved.material.id
        ) {
            try {
                await api(
                    `/api/messages/${Number(friendId)}`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            message:
                                `📚 ${data.title}`,

                            type:
                                "material",

                            materialId:
                                saved.material.id
                        })
                    }
                );
            } catch (messageError) {
                console.warn(
                    "A tananyag mentve lett, de az üzenetküldés hibázott.",
                    messageError
                );
            }
        }

        closeModal(
            "sendFriendModal"
        );

        closeModal(
            "previewModal"
        );

        state.generatedAI =
            null;

        await loadMaterials();

        if (
            state.currentFriend &&
            Number(state.currentFriend.id) ===
                Number(friendId)
        ) {
            await loadMessages();
        }

        showToast(
            "A tananyag elküldve! 📚",
            "success"
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   TANANYAGOK
   ============================================================ */

async function openMaterial(id) {
    try {
        const data =
            await api(
                `/api/materials/${Number(id)}`
            );

        const material =
            data.material;

        if (!material) {
            throw new Error(
                "A tananyag nem található."
            );
        }

        if ($("materialTitle")) {
            $("materialTitle").textContent =
                material.title || "Tananyag";
        }

        if ($("materialContent")) {
            try {
                const parsed =
                    JSON.parse(
                        material.content
                    );

                showMaterialData(
                    $("materialContent"),
                    parsed
                );

            } catch (_) {
                $("materialContent").innerHTML =
                    `<p>${escapeHTML(
                        material.content || ""
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}</p>`;
            }
        }

        openModal(
            "materialModal"
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


function showMaterialData(
    container,
    data
) {
    if (!container) {
        return;
    }

    let html = "";

    if (data.explanation) {
        html += `
            <h3>📖 Magyarázat</h3>
            <p>
                ${escapeHTML(
                    data.explanation
                )}
            </p>
        `;
    }

    if (Array.isArray(data.important)) {
        html += `
            <h3>⭐ Fontos fogalmak</h3>
            <ul>
                ${
                    data.important
                        .map(
                            item =>
                                `<li>${escapeHTML(item)}</li>`
                        )
                        .join("")
                }
            </ul>
        `;
    }

    if (data.examples) {
        html += `
            <h3>💡 Példák</h3>
            <p>
                ${escapeHTML(
                    data.examples
                ).replaceAll(
                    "\n",
                    "<br>"
                )}
            </p>
        `;
    }

    if (data.summary) {
        html += `
            <h3>📝 Összefoglaló</h3>
            <p>
                ${escapeHTML(
                    data.summary
                )}
            </p>
        `;
    }

    container.innerHTML =
        html ||
        "<p>Nincs megjeleníthető tartalom.</p>";
}


async function loadMaterials() {
    try {
        const data =
            await api(
                "/api/materials"
            );

        state.materials =
            Array.isArray(data.materials)
                ? data.materials
                : [];

        renderMaterials();
        renderHomeMaterials();

        if ($("materialCount")) {
            $("materialCount").textContent =
                state.materials.length;
        }

    } catch (error) {
        console.error(
            "Tananyag betöltési hiba:",
            error
        );
    }
}


function renderMaterials() {
    const box =
        $("materialList");

    if (!box) {
        return;
    }

    const search =
        (
            $("materialSearch")
                ?.value || ""
        )
        .trim()
        .toLowerCase();

    const filter =
        $("materialTypeFilter")
            ?.value || "all";

    const list =
        state.materials.filter(
            material => {
                const text =
                    `${material.title || ""} ${material.subject || ""}`
                        .toLowerCase();

                const matchesText =
                    !search ||
                    text.includes(search);

                const matchesType =
                    filter === "all" ||
                    (material.type || "material") ===
                        filter;

                return (
                    matchesText &&
                    matchesType
                );
            }
        );

    if (!list.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>Nincs megjeleníthető tananyag</h3>
                <p>
                    Készíts egy új anyagot
                    az AI segítségével.
                </p>

                <button
                    class="primary-button"
                    type="button"
                    data-open-ai>
                    🧙 Tananyag készítése
                </button>
            </div>
        `;

        return;
    }

    box.innerHTML =
        list
            .map(material => {
                const icon =
                    material.type === "test"
                        ? "📝"
                        : material.type === "homework"
                            ? "📋"
                            : "📖";

                return `
                    <article class="material-card">

                        <div class="material-icon">
                            ${icon}
                        </div>

                        <div>
                            <h3>
                                ${escapeHTML(
                                    material.title || ""
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    material.subject || ""
                                )}
                            </p>

                            <small>
                                ${escapeHTML(
                                    formatDate(
                                        material.date
                                    )
                                )}
                            </small>
                        </div>

                        <button
                            type="button"
                            class="secondary-button"
                            data-material-id="${Number(material.id)}">
                            Megnyitás
                        </button>

                    </article>
                `;
            })
            .join("");
}


function renderHomeMaterials() {
    const box =
        $("homeMaterialList");

    if (!box) {
        return;
    }

    const list =
        state.materials.slice(0, 4);

    if (!list.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>Még nincs tananyagod</h3>
                <p>
                    Készíts egyet a
                    TanulóBarát AI segítségével.
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        list
            .map(material => `
                <article class="material-card">

                    <div class="material-icon">
                        📖
                    </div>

                    <div>
                        <h3>
                            ${escapeHTML(
                                material.title || ""
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                material.subject || ""
                            )}
                        </p>
                    </div>

                    <button
                        type="button"
                        class="secondary-button"
                        data-material-id="${Number(material.id)}">
                        Megnyitás
                    </button>

                </article>
            `)
            .join("");
}


/* ============================================================
   JEGYEK
   ============================================================ */

async function loadGrades() {
    if (!state.user) {
        return;
    }

    try {
        const data =
            await api(
                `/api/grades/${Number(
                    state.user.id
                )}`
            );

        state.grades =
            Array.isArray(data.grades)
                ? data.grades
                : [];

        renderGrades();

    } catch (error) {
        console.error(
            "Jegyek betöltési hiba:",
            error
        );
    }
}


function renderGrades() {
    const box =
        $("gradesList");

    if (!box) {
        return;
    }

    if (!state.grades.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>Még nincsenek jegyeid</h3>
                <p>
                    A barátaid által adott jegyek
                    itt jelennek meg.
                </p>
            </div>
        `;
    } else {
        box.innerHTML =
            state.grades
                .map(grade => `
                    <div class="grade-card">

                        <div>
                            <strong>
                                ${escapeHTML(
                                    grade.subject || ""
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    grade.giverName ||
                                    "Ismeretlen"
                                )}
                            </span>

                            <small>
                                ${escapeHTML(
                                    formatDate(
                                        grade.date
                                    )
                                )}
                            </small>
                        </div>

                        <div class="grade-number">
                            ${escapeHTML(
                                grade.grade
                            )}
                        </div>

                    </div>
                `)
                .join("");
    }

    const numbers =
        state.grades
            .map(g => Number(g.grade))
            .filter(
                n => n >= 1 && n <= 5
            );

    const average =
        numbers.length
            ? numbers.reduce(
                (a, b) => a + b,
                0
            ) / numbers.length
            : 0;

    if ($("gradesAverage")) {
        $("gradesAverage").textContent =
            average
                ? average.toFixed(2)
                : "-";
    }

    if ($("averageGrade")) {
        $("averageGrade").textContent =
            average
                ? average.toFixed(2)
                : "-";
    }

    if ($("gradesStars")) {
        const rounded =
            Math.round(average);

        $("gradesStars").textContent =
            "★".repeat(rounded) +
            "☆".repeat(
                5 - rounded
            );
    }
}


/* ============================================================
   ÉRTÉKELÉS
   ============================================================ */

function openRating(
    friendId,
    friendName
) {
    const friend =
        state.friends.find(
            f =>
                Number(f.id) ===
                Number(friendId)
        );

    if (!friend) {
        return;
    }

    state.ratingTargetId =
        Number(friendId);

    state.ratingValue = 0;

    if ($("ratingFriendName")) {
        $("ratingFriendName").textContent =
            friendName ||
            friend.name;
    }

    if ($("ratingFriendAvatar")) {
        $("ratingFriendAvatar").textContent =
            (
                friend.name ||
                "?"
            )
            .charAt(0)
            .toUpperCase();
    }

    updateRatingStars();

    openModal(
        "ratingModal"
    );
}


function updateRatingStars() {
    document
        .querySelectorAll(
            "#ratingStars button"
        )
        .forEach(button => {
            const value =
                Number(
                    button.dataset.rating
                );

            button.classList.toggle(
                "selected",
                value <=
                    state.ratingValue
            );
        });

    if ($("ratingSelected")) {
        $("ratingSelected").textContent =
            state.ratingValue
                ? `${state.ratingValue} / 5 csillag`
                : "Válassz értékelést";
    }

    if ($("submitRatingButton")) {
        $("submitRatingButton").disabled =
            state.ratingValue === 0;
    }
}


async function submitRating() {
    if (
        !state.ratingTargetId ||
        !state.ratingValue
    ) {
        return;
    }

    try {
        await api(
            "/api/ratings",
            {
                method: "POST",
                body: JSON.stringify({
                    ratedUserId:
                        state.ratingTargetId,

                    stars:
                        state.ratingValue
                })
            }
        );

        closeModal(
            "ratingModal"
        );

        showToast(
            "Értékelés elküldve! ⭐",
            "success"
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   JEGY ADÁSA
   ============================================================ */

function openGrade(
    friendId,
    friendName
) {
    const friend =
        state.friends.find(
            f =>
                Number(f.id) ===
                Number(friendId)
        );

    if (!friend) {
        return;
    }

    state.gradeTargetId =
        Number(friendId);

    state.gradeValue = 0;

    if ($("gradeFriendName")) {
        $("gradeFriendName").textContent =
            friendName ||
            friend.name;
    }

    if ($("gradeFriendAvatar")) {
        $("gradeFriendAvatar").textContent =
            (
                friend.name ||
                "?"
            )
            .charAt(0)
            .toUpperCase();
    }

    if ($("gradeSubject")) {
        $("gradeSubject").value = "";
    }

    document
        .querySelectorAll(
            "#gradeOptions button"
        )
        .forEach(button => {
            button.classList.remove(
                "selected"
            );
        });

    if ($("selectedGrade")) {
        $("selectedGrade").textContent =
            "Válassz jegyet";
    }

    if ($("submitGradeButton")) {
        $("submitGradeButton").disabled =
            true;
    }

    openModal(
        "gradeModal"
    );
}


async function submitGrade() {
    const subject =
        $("gradeSubject")
            ?.value.trim();

    if (!state.gradeTargetId) {
        showToast(
            "Nincs kiválasztott barát.",
            "error"
        );
        return;
    }

    if (!subject) {
        showToast(
            "Add meg a tantárgyat!",
            "error"
        );
        return;
    }

    if (!state.gradeValue) {
        showToast(
            "Válassz egy jegyet!",
            "error"
        );
        return;
    }

    try {
        await api(
            "/api/grades",
            {
                method: "POST",
                body: JSON.stringify({
                    receiverId:
                        state.gradeTargetId,

                    subject,

                    grade:
                        state.gradeValue
                })
            }
        );

        closeModal(
            "gradeModal"
        );

        showToast(
            "Jegy elküldve! 📊",
            "success"
        );

        state.gradeTargetId =
            null;

        state.gradeValue =
            0;

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   PROFIL SZERKESZTÉS
   ============================================================ */

function defaultAvatar(name) {
    return (
        "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(
            name || "Tanuló"
        ) +
        "&background=2563eb&color=ffffff&size=256"
    );
}


function profileEditorHTML() {
    if ($("profileEditModal")) {
        return;
    }

    const modal =
        document.createElement("div");

    modal.id =
        "profileEditModal";

    modal.className =
        "modal-overlay hidden";

    modal.innerHTML = `
        <div
            class="modal-window"
            style="max-width:520px;width:calc(100% - 32px);">

            <div class="modal-header">

                <div>
                    <span class="eyebrow">
                        PROFIL
                    </span>

                    <h2>
                        ✏️ Profil szerkesztése
                    </h2>
                </div>

                <button
                    class="modal-close"
                    type="button"
                    id="closeProfileEditButton">
                    ×
                </button>

            </div>

            <div style="padding:4px 0 10px;">

                <div
                    style="
                        text-align:center;
                        margin-bottom:18px;
                    ">

                    <img
                        id="editProfileAvatarPreview"
                        src=""
                        alt="Profilkép"
                        style="
                            width:100px;
                            height:100px;
                            border-radius:50%;
                            object-fit:cover;
                            border:4px solid #e5e7eb;
                            display:block;
                            margin:0 auto 12px;
                        ">

                    <label
                        for="editProfileAvatar"
                        class="secondary-button"
                        style="
                            display:inline-flex;
                            cursor:pointer;
                        ">
                        📷 Profilkép feltöltése
                    </label>

                    <input
                        id="editProfileAvatar"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style="display:none;">

                    <div
                        id="editProfileAvatarName"
                        style="
                            font-size:12px;
                            opacity:.7;
                            margin-top:8px;
                        ">
                        Nincs új kép kiválasztva
                    </div>

                </div>

                <div class="input-group">
                    <label for="editProfileName">
                        Név
                    </label>

                    <input
                        id="editProfileName"
                        type="text"
                        maxlength="50"
                        placeholder="Név">
                </div>

                <div class="input-group">
                    <label for="editProfileUsername">
                        Felhasználónév
                    </label>

                    <input
                        id="editProfileUsername"
                        type="text"
                        maxlength="30"
                        placeholder="felhasznalonev">
                </div>

                <div class="input-group">
                    <label for="editProfileEmail">
                        E-mail
                    </label>

                    <input
                        id="editProfileEmail"
                        type="email"
                        maxlength="100"
                        placeholder="email@pelda.hu">
                </div>

                <div class="input-group">
                    <label for="editProfileGrade">
                        Évfolyam
                    </label>

                    <select id="editProfileGrade">
                        ${Array.from(
                            { length: 8 },
                            (_, i) =>
                                `<option value="${i + 5}">
                                    ${i + 5}. évfolyam
                                </option>`
                        ).join("")}
                    </select>
                </div>

                <div class="input-group">
                    <label for="editProfilePassword">
                        Új jelszó
                    </label>

                    <input
                        id="editProfilePassword"
                        type="password"
                        minlength="6"
                        placeholder="Üresen hagyható">
                </div>

                <div
                    id="profileEditMessage"
                    style="
                        display:none;
                        margin-top:10px;
                        padding:10px;
                        border-radius:10px;
                        text-align:center;
                    ">
                </div>

            </div>

            <div class="modal-footer">

                <button
                    id="cancelProfileEditButton"
                    class="secondary-button"
                    type="button">
                    Mégsem
                </button>

                <button
                    id="saveProfileButton"
                    class="primary-button"
                    type="button">
                    💾 Mentés
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    $("closeProfileEditButton")
        ?.addEventListener(
            "click",
            closeProfileEditor
        );

    $("cancelProfileEditButton")
        ?.addEventListener(
            "click",
            closeProfileEditor
        );

    $("saveProfileButton")
        ?.addEventListener(
            "click",
            saveProfile
        );

    $("editProfileAvatar")
        ?.addEventListener(
            "change",
            previewProfileImage
        );

    modal.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                modal
            ) {
                closeProfileEditor();
            }
        }
    );
}


function ensureProfileEditButton() {
    const page =
        $("page-profile");

    if (
        !page ||
        $("editProfileButton")
    ) {
        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "editProfileButton";

    button.type =
        "button";

    button.className =
        "primary-button";

    button.textContent =
        "✏️ Profil szerkesztése";

    button.style.marginTop =
        "16px";

    button.addEventListener(
        "click",
        openProfileEditor
    );

    const card =
        page.querySelector(".card") ||
        page.firstElementChild;

    if (card) {
        card.appendChild(
            button
        );
    } else {
        page.appendChild(
            button
        );
    }
}


function clearProfileMessage() {
    const box =
        $("profileEditMessage");

    if (!box) {
        return;
    }

    box.textContent = "";
    box.style.display = "none";
}


function showProfileMessage(
    text,
    type = "error"
) {
    const box =
        $("profileEditMessage");

    if (!box) {
        return;
    }

    box.textContent =
        text;

    box.style.display =
        "block";

    if (type === "success") {
        box.style.background =
            "#dcfce7";

        box.style.color =
            "#166534";
    } else {
        box.style.background =
            "#fee2e2";

        box.style.color =
            "#991b1b";
    }
}


function resizeImage(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onerror =
                reject;

            reader.onload =
                () => {
                    const image =
                        new Image();

                    image.onerror =
                        reject;

                    image.onload =
                        () => {
                            const max =
                                512;

                            const scale =
                                Math.min(
                                    1,
                                    max /
                                        Math.max(
                                            image.width,
                                            image.height
                                        )
                                );

                            const canvas =
                                document.createElement(
                                    "canvas"
                                );

                            canvas.width =
                                Math.max(
                                    1,
                                    Math.round(
                                        image.width *
                                            scale
                                    )
                                );

                            canvas.height =
                                Math.max(
                                    1,
                                    Math.round(
                                        image.height *
                                            scale
                                    )
                                );

                            const context =
                                canvas.getContext(
                                    "2d"
                                );

                            context.drawImage(
                                image,
                                0,
                                0,
                                canvas.width,
                                canvas.height
                            );

                            resolve(
                                canvas.toDataURL(
                                    "image/jpeg",
                                    0.82
                                )
                            );
                        };

                    image.src =
                        reader.result;
                };

            reader.readAsDataURL(
                file
            );
        }
    );
}


async function previewProfileImage(event) {
    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {
        event.target.value =
            "";

        showProfileMessage(
            "Csak képfájlt választhatsz."
        );

        return;
    }

    if (
        file.size >
        8 * 1024 * 1024
    ) {
        event.target.value =
            "";

        showProfileMessage(
            "A kép maximum 8 MB lehet."
        );

        return;
    }

    try {
        const data =
            await resizeImage(
                file
            );

        window.__tbSelectedAvatar =
            data;

        if (
            $("editProfileAvatarPreview")
        ) {
            $("editProfileAvatarPreview").src =
                data;
        }

        if (
            $("editProfileAvatarName")
        ) {
            $("editProfileAvatarName").textContent =
                file.name;
        }

        clearProfileMessage();

    } catch (error) {
        console.error(
            error
        );

        showProfileMessage(
            "Nem sikerült feldolgozni a képet."
        );
    }
}


async function openProfileEditor() {
    if (!state.user) {
        return;
    }

    profileEditorHTML();

    clearProfileMessage();

    window.__tbSelectedAvatar =
        null;

    if ($("editProfilePassword")) {
        $("editProfilePassword").value =
            "";
    }

    if ($("editProfileAvatar")) {
        $("editProfileAvatar").value =
            "";
    }

    if ($("editProfileAvatarName")) {
        $("editProfileAvatarName").textContent =
            "Nincs új kép kiválasztva";
    }

    if ($("editProfileAvatarPreview")) {
        $("editProfileAvatarPreview").src =
            state.user.avatar ||
            defaultAvatar(
                state.user.name
            );
    }

    if ($("editProfileName")) {
        $("editProfileName").value =
            state.user.name || "";
    }

    if ($("editProfileUsername")) {
        $("editProfileUsername").value =
            state.user.username || "";
    }

    if ($("editProfileEmail")) {
        $("editProfileEmail").value =
            state.user.email || "";
    }

    if ($("editProfileGrade")) {
        $("editProfileGrade").value =
            String(
                state.user.grade || 5
            );
    }

    openModal(
        "profileEditModal"
    );
}


function closeProfileEditor() {
    closeModal(
        "profileEditModal"
    );
}


async function saveProfile() {
    const name =
        $("editProfileName")
            ?.value.trim();

    const username =
        $("editProfileUsername")
            ?.value.trim();

    const email =
        $("editProfileEmail")
            ?.value.trim();

    const grade =
        Number(
            $("editProfileGrade")
                ?.value
        );

    const password =
        $("editProfilePassword")
            ?.value || "";

    if (
        !name ||
        !username ||
        !email ||
        !grade
    ) {
        showProfileMessage(
            "Tölts ki minden mezőt!"
        );
        return;
    }

    if (
        grade < 5 ||
        grade > 12
    ) {
        showProfileMessage(
            "Az évfolyam 5 és 12 között lehet."
        );
        return;
    }

    if (
        password &&
        password.length < 6
    ) {
        showProfileMessage(
            "Az új jelszó legalább 6 karakter legyen."
        );
        return;
    }

    const button =
        $("saveProfileButton");

    if (button) {
        button.disabled = true;
        button.textContent =
            "⏳ Mentés...";
    }

    try {
        const body = {
            name,
            username,
            email,
            grade
        };

        if (password) {
            body.password =
                password;
        }

        if (
            window.__tbSelectedAvatar
        ) {
            body.avatar =
                window.__tbSelectedAvatar;
        }

        const data =
            await api(
                "/api/profile",
                {
                    method: "PUT",
                    body:
                        JSON.stringify(
                            body
                        )
                }
            );

        if (!data.user) {
            throw new Error(
                "A szerver nem küldte vissza a profilt."
            );
        }

        state.user =
            data.user;

        updateUserUI();

        showProfileMessage(
            "Profil sikeresen frissítve!",
            "success"
        );

        window.__tbSelectedAvatar =
            null;

        setTimeout(
            closeProfileEditor,
            700
        );

    } catch (error) {
        console.error(
            "Profil mentési hiba:",
            error
        );

        showProfileMessage(
            error.message ||
            "Nem sikerült menteni a profilt."
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                "💾 Mentés";
        }
    }
}


/* ============================================================
   ÖSSZES ADAT BETÖLTÉSE
   ============================================================ */

async function loadAll() {
    setLoading(
        true,
        "Adatok betöltése..."
    );

    await Promise.allSettled([
        loadFriends(),
        loadRequests(),
        loadGrades(),
        loadMaterials()
    ]);

    updateUserUI();

    setLoading(
        false
    );
}


/* ============================================================
   ESEMÉNYEK
   ============================================================ */

function setupEvents() {

    /* ---------------- LOGIN ---------------- */

    $("loginForm")
        ?.addEventListener(
            "submit",
            event => {
                event.preventDefault();
                login();
            }
        );


    /* ---------------- REGISTER ---------------- */

    $("registerForm")
        ?.addEventListener(
            "submit",
            event => {
                event.preventDefault();
                register();
            }
        );


    /* ---------------- LOGOUT ---------------- */

    $("logoutButton")
        ?.addEventListener(
            "click",
            event => {
                event.preventDefault();
                logout();
            }
        );


    /* ---------------- LOGIN TAB ---------------- */

    $("loginTab")
        ?.addEventListener(
            "click",
            event => {
                event.preventDefault();

                $("loginTab")
                    ?.classList.add(
                        "active"
                    );

                $("registerTab")
                    ?.classList.remove(
                        "active"
                    );

                $("loginForm")
                    ?.classList.remove(
                        "hidden"
                    );

                $("registerForm")
                    ?.classList.add(
                        "hidden"
                    );

                if ($("loginForm")) {
                    $("loginForm").style.display =
                        "";
                }

                if ($("registerForm")) {
                    $("registerForm").style.display =
                        "none";
                }
            }
        );


    /* ---------------- REGISTER TAB ---------------- */

    $("registerTab")
        ?.addEventListener(
            "click",
            event => {
                event.preventDefault();

                $("registerTab")
                    ?.classList.add(
                        "active"
                    );

                $("loginTab")
                    ?.classList.remove(
                        "active"
                    );

                $("registerForm")
                    ?.classList.remove(
                        "hidden"
                    );

                $("loginForm")
                    ?.classList.add(
                        "hidden"
                    );

                if ($("registerForm")) {
                    $("registerForm").style.display =
                        "";
                }

                if ($("loginForm")) {
                    $("loginForm").style.display =
                        "none";
                }
            }
        );


    /* ---------------- PASSWORD ---------------- */

    document
        .querySelectorAll(
            "[data-password-target]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const input =
                        $(
                            button.dataset
                                .passwordTarget
                        );

                    if (!input) {
                        return;
                    }

                    input.type =
                        input.type ===
                        "password"
                            ? "text"
                            : "password";
                }
            );
        });


    /* ========================================================
       BARÁTKERESÉS
       ======================================================== */

    const searchInput =
        $("userSearch");

    const searchButton =
        $("searchUsersButton");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {
                scheduleFriendSearch();
            }
        );

        searchInput.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Enter"
                ) {
                    event.preventDefault();

                    clearTimeout(
                        friendSearchTimer
                    );

                    searchUsers();
                }
            }
        );

        searchInput.addEventListener(
            "search",
            () => {
                searchUsers();
            }
        );
    }


    if (searchButton) {
        searchButton.addEventListener(
            "click",
            event => {
                event.preventDefault();

                clearTimeout(
                    friendSearchTimer
                );

                searchUsers();
            }
        );
    }


    /* ---------------- MATERIAL SEARCH ---------------- */

    $("materialSearch")
        ?.addEventListener(
            "input",
            renderMaterials
        );

    $("materialTypeFilter")
        ?.addEventListener(
            "change",
            renderMaterials
        );


    /* ---------------- CHAT ---------------- */

    $("chatInput")
        ?.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();
                    sendMessage();
                }
            }
        );

    $("sendChatButton")
        ?.addEventListener(
            "click",
            sendMessage
        );


    /* ---------------- AI ---------------- */

    [
        "homeAIButton",
        "learningAIButton",
        "emptyLearningAIButton",
        "bottomAIButton",
        "chatAIButton"
    ].forEach(id => {
        $(id)?.addEventListener(
            "click",
            openAIModal
        );
    });

    $("generateAIButton")
        ?.addEventListener(
            "click",
            generateAI
        );

    $("approveSendButton")
        ?.addEventListener(
            "click",
            approveAndSendAI
        );

    $("cancelPreviewButton")
        ?.addEventListener(
            "click",
            () => {
                closeModal(
                    "previewModal"
                );

                state.generatedAI =
                    null;
            }
        );


    document
        .querySelectorAll(
            "[data-ai-type]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    state.aiType =
                        button.dataset.aiType ||
                        "material";

                    document
                        .querySelectorAll(
                            "[data-ai-type]"
                        )
                        .forEach(
                            other => {
                                other.classList.toggle(
                                    "active",
                                    other ===
                                        button
                                );
                            }
                        );
                }
            );
        });


    /* ---------------- RATING ---------------- */

    $("cancelRatingButton")
        ?.addEventListener(
            "click",
            () => {
                closeModal(
                    "ratingModal"
                );
            }
        );

    $("submitRatingButton")
        ?.addEventListener(
            "click",
            submitRating
        );


    document
        .querySelectorAll(
            "#ratingStars button"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    state.ratingValue =
                        Number(
                            button.dataset.rating
                        );

                    updateRatingStars();
                }
            );
        });


    /* ---------------- GRADE ---------------- */

    $("cancelGradeButton")
        ?.addEventListener(
            "click",
            () => {
                closeModal(
                    "gradeModal"
                );
            }
        );

    $("submitGradeButton")
        ?.addEventListener(
            "click",
            submitGrade
        );


    document
        .querySelectorAll(
            "#gradeOptions button"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    state.gradeValue =
                        Number(
                            button.dataset.grade
                        );

                    document
                        .querySelectorAll(
                            "#gradeOptions button"
                        )
                        .forEach(
                            other => {
                                other.classList.toggle(
                                    "selected",
                                    other ===
                                        button
                                );
                            }
                        );

                    if ($("selectedGrade")) {
                        $("selectedGrade").textContent =
                            `${state.gradeValue} / 5`;
                    }

                    if ($("submitGradeButton")) {
                        $("submitGradeButton").disabled =
                            false;
                    }
                }
            );
        });


    /* ========================================================
       DINAMIKUS GOMBOK
       ======================================================== */

    document.addEventListener(
        "click",
        event => {

            /* OLDAL */

            const nav =
                event.target.closest(
                    "[data-page]"
                );

            if (nav) {
                event.preventDefault();

                navigate(
                    nav.dataset.page
                );

                return;
            }


            /* CHAT */

            const chat =
                event.target.closest(
                    "[data-chat-id]"
                );

            if (chat) {
                openChat(
                    Number(
                        chat.dataset.chatId
                    )
                );

                return;
            }


            /* ÉRTÉKELÉS */

            const rate =
                event.target.closest(
                    "[data-rate-id]"
                );

            if (rate) {
                const friend =
                    state.friends.find(
                        f =>
                            Number(f.id) ===
                            Number(
                                rate.dataset.rateId
                            )
                    );

                if (friend) {
                    openRating(
                        friend.id,
                        friend.name
                    );
                }

                return;
            }


            /* JEGY */

            const grade =
                event.target.closest(
                    "[data-grade-id]"
                );

            if (grade) {
                const friend =
                    state.friends.find(
                        f =>
                            Number(f.id) ===
                            Number(
                                grade.dataset.gradeId
                            )
                    );

                if (friend) {
                    openGrade(
                        friend.id,
                        friend.name
                    );
                }

                return;
            }


            /* BARÁTI KÉRÉS ELFOGADÁS */

            const accept =
                event.target.closest(
                    "[data-accept-id]"
                );

            if (accept) {
                acceptFriend(
                    Number(
                        accept.dataset.acceptId
                    )
                );

                return;
            }


            /* BARÁTI KÉRÉS ELUTASÍTÁS */

            const reject =
                event.target.closest(
                    "[data-reject-id]"
                );

            if (reject) {
                rejectFriend(
                    Number(
                        reject.dataset.rejectId
                    )
                );

                return;
            }


            /* BARÁTI KÉRÉS */

            const request =
                event.target.closest(
                    "[data-request-id]"
                );

            if (request) {
                sendFriendRequest(
                    Number(
                        request.dataset.requestId
                    )
                );

                return;
            }


            /* TANANYAG */

            const material =
                event.target.closest(
                    "[data-material-id]"
                );

            if (material) {
                openMaterial(
                    Number(
                        material.dataset.materialId
                    )
                );

                return;
            }


            /* BARÁT KIVÁLASZTÁSA TANANYAGHOZ */

            const sendFriend =
                event.target.closest(
                    "[data-send-friend-id]"
                );

            if (sendFriend) {
                sendGeneratedMaterial(
                    Number(
                        sendFriend.dataset
                            .sendFriendId
                    )
                );

                return;
            }


            /* AI */

            const ai =
                event.target.closest(
                    "[data-open-ai]"
                );

            if (ai) {
                openAIModal();
                return;
            }


            /* MODAL BEZÁRÁSA */

            const close =
                event.target.closest(
                    "[data-close-modal]"
                );

            if (close) {
                closeModal(
                    close.dataset
                        .closeModal
                );

                return;
            }


            /* MODAL HÁTTÉR */

            if (
                event.target.classList
                    .contains(
                        "modal-overlay"
                    )
            ) {
                closeModal(
                    event.target.id
                );
            }
        }
    );


    /* ---------------- MOBIL MENÜ ---------------- */

    $("mobileMenuButton")
        ?.addEventListener(
            "click",
            () => {
                $("sidebar")
                    ?.classList.toggle(
                        "open"
                    );
            }
        );


    /* ---------------- TÉMA ---------------- */

    $("themeToggle")
        ?.addEventListener(
            "click",
            () => {
                document.body.classList.toggle(
                    "light-theme"
                );
            }
        );


    /* ---------------- ÉRTESÍTÉS ---------------- */

    $("notificationButton")
        ?.addEventListener(
            "click",
            () => {
                navigate(
                    "friends"
                );

                if (
                    state.requests.length
                ) {
                    showToast(
                        `${state.requests.length} új baráti kérésed van.`,
                        "info"
                    );
                }
            }
        );


    /* ---------------- ESC ---------------- */

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Escape"
            ) {
                document
                    .querySelectorAll(
                        ".modal-overlay.active"
                    )
                    .forEach(modal => {
                        closeModal(
                            modal.id
                        );
                    });
            }
        }
    );
}


/* ============================================================
   CHAT AUTOMATIKUS FRISSÍTÉS
   ============================================================ */

setInterval(
    () => {
        if (
            state.currentFriend &&
            $("chatModal") &&
            !$("chatModal")
                .classList
                .contains("hidden")
        ) {
            loadMessages();
        }
    },
    3000
);


/* ============================================================
   GLOBÁLIS FÜGGVÉNYEK
   ============================================================ */

Object.assign(
    window,
    {
        navigate,
        login,
        register,
        logout,

        openChat,
        sendMessage,

        searchUsers,
        sendFriendRequest,
        acceptFriend,
        rejectFriend,

        openAIModal,
        generateAI,
        approveAndSendAI,

        openRating,
        submitRating,

        openGrade,
        submitGrade,

        openMaterial,

        openModal,
        closeModal,

        openProfileEditor,
        closeProfileEditor,
        saveProfile
    }
);


/* ============================================================
   INDÍTÁS
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        console.log(
            "🚀 TanulóBarát betöltve"
        );

        setupEvents();

        profileEditorHTML();

        ensureProfileEditButton();

        /*
           Alapból a belépési képernyő látszik.
        */

        showAuth();

        /*
           Ha van érvényes session,
           automatikusan belépünk.
        */

        await checkLogin();
    }
);