/* ============================================================
   TANULÓBARÁT - APP.JS
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
    selectedSendFriendId: null,
    searchUsers: []
};

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

    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleString("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

async function api(url, options = {}) {
    const config = {
        credentials: "include",
        ...options
    };

    config.headers = {
        ...(options.body instanceof FormData
            ? {}
            : {
                "Content-Type": "application/json"
            }),
        ...(options.headers || {})
    };

    const response = await fetch(url, config);

    let data = {};

    try {
        data = await response.json();
    } catch (_) {}

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Hiba (${response.status})`
        );
    }

    return data;
}


/* ============================================================
   TOAST
============================================================ */

function showToast(message, type = "info") {
    const container =
        $("toastContainer") ||
        document.body;

    const toast =
        document.createElement("div");

    toast.className =
        `toast toast-${type}`;

    toast.textContent = message;

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
   LOADING
============================================================ */

function setLoading(
    show,
    text = "Betöltés..."
) {
    const el = $("globalLoading");

    if (!el) return;

    if ($("loadingText")) {
        $("loadingText").textContent = text;
    }

    el.classList.toggle(
        "hidden",
        !show
    );
}


/* ============================================================
   MODAL
============================================================ */

function openModal(id) {
    const modal = $(id);

    if (!modal) return;

    modal.classList.remove("hidden");
    modal.classList.add("active");
    modal.style.display = "flex";
}

function closeModal(id) {
    const modal = $(id);

    if (!modal) return;

    modal.classList.remove("active");
    modal.classList.add("hidden");
    modal.style.display = "none";
}


/* ============================================================
   AUTH / APP NÉZET
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
   NAVIGÁCIÓ
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
                section.id ===
                `page-${page}`;

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

    const sidebar = $("sidebar");

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ============================================================
   FELHASZNÁLÓ UI
============================================================ */

function updateUserUI() {
    if (!state.user) return;

    const name =
        state.user.name ||
        state.user.username ||
        "Tanuló";

    const username =
        state.user.username || "";

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

    if ($("profileAvatar")) {
        if (state.user.avatar) {
            $("profileAvatar").innerHTML =
                `<img src="${escapeHTML(state.user.avatar)}"
                      alt="Profilkép"
                      style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            $("profileAvatar").textContent =
                initial;
        }
    }

    if ($("userAvatar")) {
        if (state.user.avatar) {
            $("userAvatar").innerHTML =
                `<img src="${escapeHTML(state.user.avatar)}"
                      alt="Profilkép"
                      style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            $("userAvatar").textContent =
                initial;
        }
    }

    if ($("sidebarAvatar")) {
        if (state.user.avatar) {
            $("sidebarAvatar").innerHTML =
                `<img src="${escapeHTML(state.user.avatar)}"
                      alt="Profilkép"
                      style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            $("sidebarAvatar").textContent =
                initial;
        }
    }

    if ($("profileJoined")) {
        $("profileJoined").textContent =
            state.user.createdAt
                ? formatDate(
                    state.user.createdAt
                ).split(",")[0]
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

        if (data.user) {
            state.user =
                data.user;

            showApp();

            await loadAll();
        } else {
            showAuth();
        }
    } catch (_) {
        showAuth();
    }
}


/* ============================================================
   LOGIN
============================================================ */

async function login() {
    const username =
        $("loginUsername")
            ?.value
            .trim();

    const password =
        $("loginPassword")
            ?.value || "";

    if (!username || !password) {
        return showToast(
            "Add meg a felhasználónevet és a jelszót!",
            "error"
        );
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

        state.user =
            data.user;

        showApp();

        await loadAll();

        showToast(
            "Sikeres bejelentkezés! 👋",
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
   REGISZTRÁCIÓ
============================================================ */

async function register() {
    const name =
        $("registerName")
            ?.value
            .trim();

    const username =
        $("registerUsername")
            ?.value
            .trim();

    const email =
        $("registerEmail")
            ?.value
            .trim();

    const password =
        $("registerPassword")
            ?.value || "";

    const grade =
        Number(
            $("registerGrade")
                ?.value
        );

    if (
        !name ||
        !username ||
        !email ||
        !password ||
        !grade
    ) {
        return showToast(
            "Tölts ki minden mezőt!",
            "error"
        );
    }

    if (grade < 5 || grade > 12) {
        return showToast(
            "Az évfolyam 5 és 12 között lehet.",
            "error"
        );
    }

    if (password.length < 6) {
        return showToast(
            "A jelszó legalább 6 karakter legyen.",
            "error"
        );
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

        state.user =
            data.user;

        showApp();

        await loadAll();

        showToast(
            "Sikeres regisztráció! 🎉",
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
   LOGOUT
============================================================ */

async function logout() {
    try {
        await api(
            "/api/logout",
            {
                method: "POST"
            }
        );
    } catch (_) {}

    state.user = null;
    state.friends = [];
    state.requests = [];
    state.materials = [];
    state.grades = [];
    state.currentFriend = null;

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
            await api(
                "/api/friends"
            );

        state.friends =
            data.friends || [];

        renderFriends();
        renderSendFriendList();

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
        console.error(error);
    }
}


/* ============================================================
   BARÁTOK MEGJELENÍTÉSE
============================================================ */

function renderFriends() {
    const box =
        $("friendsList");

    if (!box) return;

    if (!state.friends.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">👥</div>
                <h3>Még nincsenek barátaid</h3>
                <p>
                    Keress rá valakire,
                    és küldj neki baráti kérést.
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.friends
            .map(friend => {
                const initial =
                    (
                        friend.name ||
                        friend.username ||
                        "?"
                    )
                        .charAt(0)
                        .toUpperCase();

                const avatar =
                    friend.avatar
                        ? `
                            <img
                                src="${escapeHTML(friend.avatar)}"
                                alt="Profilkép"
                                style="
                                    width:100%;
                                    height:100%;
                                    object-fit:cover;
                                    border-radius:50%;
                                "
                            >
                        `
                        : escapeHTML(initial);

                return `
                    <div class="friend-card">

                        <div class="friend-avatar">
                            ${avatar}
                        </div>

                        <div class="friend-info">
                            <strong>
                                ${escapeHTML(friend.name)}
                            </strong>

                            <span>
                                @${escapeHTML(friend.username)}
                            </span>
                        </div>

                        <div class="friend-actions">

                            <button
                                type="button"
                                class="secondary-button"
                                data-chat-id="${friend.id}"
                            >
                                💬 Chat
                            </button>

                            <button
                                type="button"
                                class="secondary-button"
                                data-rate-id="${friend.id}"
                            >
                                ⭐ Értékelés
                            </button>

                            <button
                                type="button"
                                class="secondary-button"
                                data-grade-id="${friend.id}"
                            >
                                📊 Jegy
                            </button>

                        </div>

                    </div>
                `;
            })
            .join("");
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
            data.requests || [];

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
        console.error(error);
    }
}


/* ============================================================
   KÉRÉSEK MEGJELENÍTÉSE
============================================================ */

function renderRequests() {
    const box =
        $("friendRequests");

    if (!box) return;

    if (!state.requests.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">📭</div>
                <h3>Nincs új baráti kérés</h3>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.requests
            .map(request => {
                const initial =
                    (
                        request.name ||
                        request.username ||
                        "?"
                    )
                        .charAt(0)
                        .toUpperCase();

                const avatar =
                    request.avatar
                        ? `
                            <img
                                src="${escapeHTML(request.avatar)}"
                                alt="Profilkép"
                                style="
                                    width:100%;
                                    height:100%;
                                    object-fit:cover;
                                    border-radius:50%;
                                "
                            >
                        `
                        : escapeHTML(initial);

                return `
                    <div class="friend-request-card">

                        <div class="friend-avatar">
                            ${avatar}
                        </div>

                        <div class="friend-info">
                            <strong>
                                ${escapeHTML(request.name)}
                            </strong>

                            <span>
                                @${escapeHTML(request.username)}
                            </span>
                        </div>

                        <div class="friend-actions">

                            <button
                                type="button"
                                class="primary-button"
                                data-accept-id="${request.id}"
                            >
                                ✓ Elfogad
                            </button>

                            <button
                                type="button"
                                class="secondary-button"
                                data-reject-id="${request.id}"
                            >
                                ✕ Elutasít
                            </button>

                        </div>

                    </div>
                `;
            })
            .join("");
}


/* ============================================================
   BARÁTI KÉRÉS KÜLDÉSE
============================================================ */

async function sendFriendRequest(userId) {
    try {
        await api(
            "/api/friends/request",
            {
                method: "POST",
                body: JSON.stringify({
                    userId
                })
            }
        );

        showToast(
            "Baráti kérés elküldve! 👥",
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
   BARÁTI KÉRÉS ELFOGADÁSA
============================================================ */

async function acceptFriend(userId) {
    try {
        await api(
            `/api/friends/${userId}/accept`,
            {
                method: "POST"
            }
        );

        showToast(
            "Baráti kérés elfogadva! 🎉",
            "success"
        );

        await Promise.all([
            loadFriends(),
            loadRequests()
        ]);

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   BARÁTI KÉRÉS ELUTASÍTÁSA
============================================================ */

async function rejectFriend(userId) {
    try {
        await api(
            `/api/friends/${userId}/reject`,
            {
                method: "POST"
            }
        );

        showToast(
            "Baráti kérés elutasítva.",
            "info"
        );

        await loadRequests();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   FELHASZNÁLÓK KERESÉSE
============================================================ */

async function searchUsers() {
    const input =
        $("userSearch");

    const q =
        input
            ? input.value.trim()
            : "";

    if (!q) {
        if ($("searchResults")) {
            $("searchResults").innerHTML = "";
        }

        return;
    }

    try {
        const data =
            await api(
                `/api/users?q=${encodeURIComponent(q)}`
            );

        state.searchUsers =
            data.users || [];

        renderSearchResults();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   KERESÉSI TALÁLATOK
============================================================ */

function renderSearchResults() {
    const box =
        $("searchResults");

    if (!box) return;

    if (!state.searchUsers.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">🔎</div>
                <h3>Nincs találat</h3>
                <p>Próbálj másik nevet vagy felhasználónevet.</p>
            </div>
        `;

        return;
    }

    const friendIds =
        new Set(
            state.friends.map(
                friend => Number(friend.id)
            )
        );

    const requestIds =
        new Set(
            state.requests.map(
                request => Number(request.id)
            )
        );

    box.innerHTML =
        state.searchUsers
            .map(user => {
                const initial =
                    (
                        user.name ||
                        user.username ||
                        "?"
                    )
                        .charAt(0)
                        .toUpperCase();

                let action = "";

                if (
                    friendIds.has(
                        Number(user.id)
                    )
                ) {
                    action = `
                        <span class="status-badge">
                            ✓ Barát
                        </span>
                    `;
                } else if (
                    requestIds.has(
                        Number(user.id)
                    )
                ) {
                    action = `
                        <span class="status-badge">
                            ⏳ Kérés
                        </span>
                    `;
                } else {
                    action = `
                        <button
                            type="button"
                            class="primary-button"
                            data-request-id="${user.id}"
                        >
                            ➕ Barátnak jelöl
                        </button>
                    `;
                }

                return `
                    <div class="search-user-card">

                        <div class="friend-avatar">
                            ${
                                user.avatar
                                    ? `
                                        <img
                                            src="${escapeHTML(user.avatar)}"
                                            alt="Profilkép"
                                            style="
                                                width:100%;
                                                height:100%;
                                                object-fit:cover;
                                                border-radius:50%;
                                            "
                                        >
                                    `
                                    : escapeHTML(initial)
                            }
                        </div>

                        <div class="friend-info">
                            <strong>
                                ${escapeHTML(user.name)}
                            </strong>

                            <span>
                                @${escapeHTML(user.username)}
                            </span>

                            <small>
                                ${user.grade || ""}. osztály
                            </small>
                        </div>

                        <div class="friend-actions">
                            ${action}
                        </div>

                    </div>
                `;
            })
            .join("");
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
        return showToast(
            "A barát nem található.",
            "error"
        );
    }

    state.currentFriend =
        friend;

    if ($("chatTitle")) {
        $("chatTitle").textContent =
            friend.name;
    }

    if ($("chatStatus")) {
        $("chatStatus").textContent =
            "● Online";
    }

    if ($("chatAvatar")) {
        if (friend.avatar) {
            $("chatAvatar").innerHTML =
                `<img
                    src="${escapeHTML(friend.avatar)}"
                    alt="Profilkép"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:50%;
                    "
                >`;
        } else {
            $("chatAvatar").textContent =
                (
                    friend.name ||
                    friend.username ||
                    "?"
                )
                    .charAt(0)
                    .toUpperCase();
        }
    }

    openModal("chatModal");

    await loadMessages();

    setTimeout(() => {
        $("chatInput")?.focus();
    }, 100);
}


/* ============================================================
   ÜZENETEK BETÖLTÉSE
============================================================ */

async function loadMessages() {
    if (!state.currentFriend) return;

    try {
        const data =
            await api(
                `/api/messages/${state.currentFriend.id}`
            );

        state.currentMessages =
            data.messages || [];

        renderMessages();

    } catch (error) {
        console.error(error);
    }
}


/* ============================================================
   ÜZENETEK MEGJELENÍTÉSE
============================================================ */

function renderMessages() {
    const box =
        $("chatMessages");

    if (!box) return;

    if (!state.currentMessages.length) {
        box.innerHTML = `
            <div class="empty-chat">
                <div>💬</div>
                <p>
                    Még nincs üzenet.
                    Írj valamit!
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.currentMessages
            .map(message => {
                const own =
                    Number(message.sender) ===
                    Number(state.user.id);

                const material =
                    message.type === "material";

                return `
                    <div class="chat-message ${
                        own
                            ? "message-own"
                            : "message-other"
                    }">

                        <div class="message-bubble">

                            ${
                                material
                                    ? `
                                        <div class="material-message">
                                            📚
                                            ${escapeHTML(message.message)}

                                            ${
                                                message.materialId
                                                    ? `
                                                        <button
                                                            type="button"
                                                            class="material-open-button"
                                                            data-material-id="${message.materialId}"
                                                        >
                                                            Megnyitás
                                                        </button>
                                                    `
                                                    : ""
                                            }
                                        </div>
                                    `
                                    : `
                                        <div>
                                            ${escapeHTML(message.message)}
                                        </div>
                                    `
                            }

                            <small>
                                ${formatDate(message.date)}
                            </small>

                        </div>

                    </div>
                `;
            })
            .join("");

    box.scrollTop =
        box.scrollHeight;
}


/* ============================================================
   ÜZENET KÜLDÉSE
============================================================ */

async function sendMessage() {
    if (!state.currentFriend) {
        return;
    }

    const input =
        $("chatInput");

    if (!input) return;

    const message =
        input.value.trim();

    if (!message) return;

    try {
        await api(
            `/api/messages/${state.currentFriend.id}`,
            {
                method: "POST",
                body: JSON.stringify({
                    message
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
   TANANYAGOK
============================================================ */

async function loadMaterials() {
    try {
        const data =
            await api(
                "/api/materials"
            );

        state.materials =
            data.materials || [];

        renderMaterials();

        if ($("materialCount")) {
            $("materialCount").textContent =
                state.materials.length;
        }

    } catch (error) {
        console.error(error);
    }
}


/* ============================================================
   TANANYAGOK MEGJELENÍTÉSE
============================================================ */

function renderMaterials() {
    const box =
        $("materialList");

    if (!box) return;

    const search =
        (
            $("materialSearch")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const type =
        $("materialTypeFilter")
            ?.value || "";

    let materials =
        [...state.materials];

    if (search) {
        materials =
            materials.filter(material =>
                String(material.title)
                    .toLowerCase()
                    .includes(search) ||
                String(material.subject)
                    .toLowerCase()
                    .includes(search) ||
                String(material.content)
                    .toLowerCase()
                    .includes(search)
            );
    }

    if (type) {
        materials =
            materials.filter(
                material =>
                    material.type === type
            );
    }

    if (!materials.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>Nincs tananyag</h3>
                <p>
                    Generálj egyet a TanulóBarát AI segítségével.
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        materials
            .map(material => `
                <div
                    class="material-card"
                    data-material-id="${material.id}"
                >

                    <div class="material-card-icon">
                        ${
                            material.type === "test"
                                ? "📝"
                                : material.type === "homework"
                                    ? "📚"
                                    : "📖"
                        }
                    </div>

                    <div class="material-card-content">

                        <h3>
                            ${escapeHTML(material.title)}
                        </h3>

                        <div class="material-meta">
                            ${escapeHTML(material.subject)}
                            •
                            ${formatDate(material.date)}
                        </div>

                        <p>
                            ${escapeHTML(
                                String(material.content)
                                    .slice(0, 180)
                            )}${
                                String(material.content).length > 180
                                    ? "..."
                                    : ""
                            }
                        </p>

                    </div>

                    <button
                        type="button"
                        class="secondary-button"
                        data-material-id="${material.id}"
                    >
                        Megnyitás
                    </button>

                </div>
            `)
            .join("");
}


/* ============================================================
   TANANYAG MEGNYITÁSA
============================================================ */

async function openMaterial(materialId) {
    try {
        const data =
            await api(
                `/api/materials/${materialId}`
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
                material.title;
        }

        if ($("materialContent")) {
            $("materialContent").innerHTML =
                escapeHTML(
                    material.content
                )
                    .replaceAll(
                        "\n",
                        "<br>"
                    );
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


/* ============================================================
   AI MODAL
============================================================ */

function openAIModal() {
    state.generatedAI = null;

    if ($("aiSubject")) {
        $("aiSubject").value = "";
    }

    if ($("aiTopic")) {
        $("aiTopic").value = "";
    }

    if ($("aiStatus")) {
        $("aiStatus").textContent = "";
    }

    state.aiType = "material";

    document
        .querySelectorAll(
            "[data-ai-type]"
        )
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.aiType ===
                    "material"
            );
        });

    openModal("aiModal");
}


/* ============================================================
   AI GENERÁLÁS
============================================================ */

async function generateAI() {
    const subject =
        $("aiSubject")
            ?.value
            .trim();

    const topic =
        $("aiTopic")
            ?.value
            .trim();

    if (!subject || !topic) {
        return showToast(
            "Add meg a tantárgyat és a témát!",
            "error"
        );
    }

    const button =
        $("generateAIButton");

    if (button) {
        button.disabled = true;
        button.textContent =
            "⏳ Generálás...";
    }

    if ($("aiStatus")) {
        $("aiStatus").textContent =
            "Az anyag elkészítése...";
    }

    try {
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

        if ($("previewTitle")) {
            $("previewTitle").textContent =
                data.title ||
                "AI tananyag";
        }

        if ($("previewContent")) {
            $("previewContent").innerHTML =
                escapeHTML(
                    data.content || ""
                )
                    .replaceAll(
                        "\n",
                        "<br>"
                    );
        }

        openModal(
            "previewModal"
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                "✨ Generálás";
        }

        if ($("aiStatus")) {
            $("aiStatus").textContent = "";
        }
    }
}


/* ============================================================
   AI TANANYAG KÜLDÉS ELŐKÉSZÍTÉSE
============================================================ */

function approveAndSendAI() {
    if (!state.generatedAI) {
        return showToast(
            "Nincs elkészült tananyag.",
            "error"
        );
    }

    closeModal("previewModal");

    renderSendFriendList();

    openModal(
        "sendFriendModal"
    );
}


/* ============================================================
   BARÁT LISTA KÜLDÉSHEZ
============================================================ */

function renderSendFriendList() {
    const box =
        $("sendFriendList");

    if (!box) return;

    if (!state.friends.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">👥</div>
                <h3>Nincsenek barátaid</h3>
                <p>
                    Először adj hozzá valakit barátként.
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
                    class="send-friend-item"
                    data-send-friend-id="${friend.id}"
                >

                    <span class="send-friend-avatar">
                        ${
                            friend.avatar
                                ? `
                                    <img
                                        src="${escapeHTML(friend.avatar)}"
                                        alt="Profilkép"
                                    >
                                `
                                : escapeHTML(
                                    (
                                        friend.name ||
                                        friend.username ||
                                        "?"
                                    )
                                        .charAt(0)
                                        .toUpperCase()
                                )
                        }
                    </span>

                    <span>
                        ${escapeHTML(friend.name)}
                    </span>

                    <span>
                        ➜
                    </span>

                </button>
            `)
            .join("");
}


/* ============================================================
   AI TANANYAG KÜLDÉSE
============================================================ */

async function sendGeneratedMaterial(friendId) {
    if (!state.generatedAI) {
        return showToast(
            "Nincs elkészült tananyag.",
            "error"
        );
    }

    try {
        const data =
            await api(
                "/api/materials",
                {
                    method: "POST",
                    body: JSON.stringify({
                        subject:
                            state.generatedAI.subject,
                        title:
                            state.generatedAI.title,
                        content:
                            state.generatedAI.content,
                        type:
                            state.generatedAI.type ||
                            "material",
                        friendId
                    })
                }
            );

        closeModal(
            "sendFriendModal"
        );

        showToast(
            "Tananyag elküldve! 📚",
            "success"
        );

        state.generatedAI = null;

        await loadMaterials();

        const friend =
            state.friends.find(
                f =>
                    Number(f.id) ===
                    Number(friendId)
            );

        if (friend) {
            await openChat(friend.id);
        }

    } catch (error) {
        showToast(
            error.message,
            "error"
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
    state.ratingTargetId =
        Number(friendId);

    state.ratingValue = 0;

    if ($("ratingFriendName")) {
        $("ratingFriendName").textContent =
            friendName;
    }

    if ($("ratingSelected")) {
        $("ratingSelected").textContent =
            "0 / 5";
    }

    if ($("ratingFriendAvatar")) {
        const friend =
            state.friends.find(
                f =>
                    Number(f.id) ===
                    Number(friendId)
            );

        if (friend?.avatar) {
            $("ratingFriendAvatar").innerHTML =
                `<img
                    src="${escapeHTML(friend.avatar)}"
                    alt="Profilkép"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:50%;
                    "
                >`;
        } else {
            $("ratingFriendAvatar").textContent =
                (
                    friendName ||
                    "?"
                )
                    .charAt(0)
                    .toUpperCase();
        }
    }

    updateRatingStars();

    openModal(
        "ratingModal"
    );
}


/* ============================================================
   CSILLAGOK
============================================================ */

function updateRatingStars() {
    document
        .querySelectorAll(
            "#ratingStars button"
        )
        .forEach(button => {
            const rating =
                Number(
                    button.dataset.rating
                );

            button.classList.toggle(
                "selected",
                rating <=
                    state.ratingValue
            );
        });

    if ($("ratingSelected")) {
        $("ratingSelected").textContent =
            `${state.ratingValue} / 5`;
    }

    if ($("submitRatingButton")) {
        $("submitRatingButton").disabled =
            state.ratingValue < 1;
    }
}


/* ============================================================
   ÉRTÉKELÉS MENTÉSE
============================================================ */

async function submitRating() {
    if (
        !state.ratingTargetId ||
        !state.ratingValue
    ) {
        return showToast(
            "Válassz csillagot!",
            "error"
        );
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
            "Értékelés elmentve! ⭐",
            "success"
        );

        state.ratingTargetId = null;
        state.ratingValue = 0;

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   JEGY MODAL
============================================================ */

function openGrade(
    friendId,
    friendName
) {
    state.gradeTargetId =
        Number(friendId);

    state.gradeValue = 0;

    if ($("gradeFriendName")) {
        $("gradeFriendName").textContent =
            friendName;
    }

    if ($("gradeSubject")) {
        $("gradeSubject").value = "";
    }

    if ($("selectedGrade")) {
        $("selectedGrade").textContent =
            "Nincs kiválasztva";
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

    if ($("submitGradeButton")) {
        $("submitGradeButton").disabled =
            true;
    }

    if ($("gradeFriendAvatar")) {
        const friend =
            state.friends.find(
                f =>
                    Number(f.id) ===
                    Number(friendId)
            );

        if (friend?.avatar) {
            $("gradeFriendAvatar").innerHTML =
                `<img
                    src="${escapeHTML(friend.avatar)}"
                    alt="Profilkép"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:50%;
                    "
                >`;
        } else {
            $("gradeFriendAvatar").textContent =
                (
                    friendName ||
                    "?"
                )
                    .charAt(0)
                    .toUpperCase();
        }
    }

    openModal(
        "gradeModal"
    );
}


/* ============================================================
   JEGY MENTÉSE
============================================================ */

async function submitGrade() {
    const subject =
        $("gradeSubject")
            ?.value
            .trim();

    if (!subject) {
        return showToast(
            "Add meg a tantárgyat!",
            "error"
        );
    }

    if (
        !state.gradeTargetId ||
        !state.gradeValue
    ) {
        return showToast(
            "Válassz jegyet!",
            "error"
        );
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
            "Jegy elmentve! 📊",
            "success"
        );

        state.gradeTargetId = null;
        state.gradeValue = 0;

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   JEGYEK BETÖLTÉSE
============================================================ */

async function loadGrades() {
    if (!state.user) return;

    try {
        const data =
            await api(
                `/api/grades/${state.user.id}`
            );

        state.grades =
            data.grades || [];

        renderGrades();

    } catch (error) {
        console.error(error);
    }
}


/* ============================================================
   JEGYEK MEGJELENÍTÉSE
============================================================ */

function renderGrades() {
    const box =
        $("gradesList");

    if (!box) return;

    const grades =
        state.grades;

    if (!grades.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>Még nincs jegyed</h3>
                <p>
                    A barátaid által adott jegyek itt jelennek meg.
                </p>
            </div>
        `;

        if ($("gradesAverage")) {
            $("gradesAverage").textContent =
                "–";
        }

        if ($("gradesStars")) {
            $("gradesStars").textContent =
                "☆☆☆☆☆";
        }

        return;
    }

    const average =
        grades.reduce(
            (sum, item) =>
                sum + Number(item.grade),
            0
        ) / grades.length;

    if ($("gradesAverage")) {
        $("gradesAverage").textContent =
            average.toFixed(2);
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

    box.innerHTML =
        grades
            .slice()
            .reverse()
            .map(grade => `
                <div class="grade-card">

                    <div class="grade-value">
                        ${escapeHTML(grade.grade)}
                    </div>

                    <div class="grade-info">
                        <strong>
                            ${escapeHTML(grade.subject)}
                        </strong>

                        <span>
                            Adta:
                            ${escapeHTML(
                                grade.giverName ||
                                "Ismeretlen"
                            )}
                        </span>

                        <small>
                            ${formatDate(grade.date)}
                        </small>
                    </div>

                </div>
            `)
            .join("");
}


/* ============================================================
   STATISZTIKÁK
============================================================ */

async function loadStats() {
    try {
        const data =
            await api(
                "/api/stats"
            );

        if ($("friendCount")) {
            $("friendCount").textContent =
                data.friends || 0;
        }

        if ($("materialCount")) {
            $("materialCount").textContent =
                data.materials || 0;
        }

        if ($("profileFriendCount")) {
            $("profileFriendCount").textContent =
                data.friends || 0;
        }

    } catch (error) {
        console.error(error);
    }
}


/* ============================================================
   PROFIL SZERKESZTŐ HTML
============================================================ */

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

    modal.style.display =
        "none";

    modal.innerHTML = `
        <div
            class="modal-card profile-edit-modal-card"
            style="max-width:600px;"
        >

            <div class="modal-header">

                <div>
                    <h2>✏️ Profil szerkesztése</h2>
                    <p>
                        Módosítsd a TanulóBarát profilodat.
                    </p>
                </div>

                <button
                    type="button"
                    class="modal-close"
                    data-close-modal="profileEditModal"
                >
                    ✕
                </button>

            </div>

            <div class="modal-body">

                <div
                    id="profileEditMessage"
                    style="
                        display:none;
                        padding:12px;
                        border-radius:10px;
                        margin-bottom:15px;
                    "
                ></div>

                <div
                    style="
                        display:flex;
                        justify-content:center;
                        margin-bottom:20px;
                    "
                >

                    <div
                        style="
                            width:100px;
                            height:100px;
                            border-radius:50%;
                            overflow:hidden;
                            background:#e5e7eb;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                        "
                    >
                        <img
                            id="editProfileAvatarPreview"
                            src=""
                            alt="Profilkép"
                            style="
                                width:100%;
                                height:100%;
                                object-fit:cover;
                                display:none;
                            "
                        >

                        <span
                            id="editProfileAvatarInitial"
                            style="
                                font-size:36px;
                                font-weight:bold;
                            "
                        >
                            👤
                        </span>
                    </div>

                </div>

                <label>
                    Profilkép
                </label>

                <input
                    id="editProfileAvatar"
                    type="file"
                    accept="image/*"
                    style="margin-bottom:8px;"
                >

                <small
                    id="editProfileAvatarName"
                    style="
                        display:block;
                        margin-bottom:15px;
                    "
                >
                    Nincs új kép kiválasztva
                </small>


                <label>
                    Név
                </label>

                <input
                    id="editProfileName"
                    type="text"
                    autocomplete="name"
                    placeholder="Teljes név"
                >


                <label>
                    Felhasználónév
                </label>

                <input
                    id="editProfileUsername"
                    type="text"
                    autocomplete="username"
                    placeholder="Felhasználónév"
                >


                <label>
                    E-mail
                </label>

                <input
                    id="editProfileEmail"
                    type="email"
                    autocomplete="email"
                    placeholder="E-mail cím"
                >


                <label>
                    Évfolyam
                </label>

                <select
                    id="editProfileGrade"
                >
                    <option value="5">5. osztály</option>
                    <option value="6">6. osztály</option>
                    <option value="7">7. osztály</option>
                    <option value="8">8. osztály</option>
                    <option value="9">9. osztály</option>
                    <option value="10">10. osztály</option>
                    <option value="11">11. osztály</option>
                    <option value="12">12. osztály</option>
                </select>


                <label>
                    Új jelszó
                </label>

                <input
                    id="editProfilePassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Üresen hagyva nem változik"
                >

            </div>

            <div class="modal-footer">

                <button
                    type="button"
                    class="secondary-button"
                    data-close-modal="profileEditModal"
                >
                    Mégse
                </button>

                <button
                    type="button"
                    id="saveProfileButton"
                    class="primary-button"
                >
                    💾 Mentés
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    $("editProfileAvatar")
        ?.addEventListener(
            "change",
            previewProfileImage
        );

    $("saveProfileButton")
        ?.addEventListener(
            "click",
            saveProfile
        );
}


/* ============================================================
   PROFIL SZERKESZTÉS GOMB
============================================================ */

function ensureProfileEditButton() {
    profileEditorHTML();

    const page =
        $("page-profile");

    if (!page) return;

    if ($("editProfileButton")) {
        return;
    }

    const button =
        document.createElement("button");

    button.id =
        "editProfileButton";

    button.type =
        "button";

    button.className =
        "primary-button";

    button.textContent =
        "✏️ Profil szerkesztése";

    button.addEventListener(
        "click",
        openProfileEditor
    );

    const possibleContainers =
        page.querySelectorAll(
            ".profile-header, .profile-actions, .page-header, .card-header"
        );

    if (possibleContainers.length) {
        possibleContainers[0]
            .appendChild(button);
    } else {
        page.prepend(button);
    }
}


/* ============================================================
   PROFIL SZERKESZTŐ MEGNYITÁSA
============================================================ */

function openProfileEditor() {
    if (!state.user) return;

    profileEditorHTML();

    clearProfileMessage();

    $("editProfileName").value =
        state.user.name || "";

    $("editProfileUsername").value =
        state.user.username || "";

    $("editProfileEmail").value =
        state.user.email || "";

    $("editProfileGrade").value =
        state.user.grade || 5;

    $("editProfilePassword").value =
        "";

    window.__tbSelectedAvatar =
        null;

    const preview =
        $("editProfileAvatarPreview");

    const initial =
        $("editProfileAvatarInitial");

    if (state.user.avatar) {
        if (preview) {
            preview.src =
                state.user.avatar;

            preview.style.display =
                "block";
        }

        if (initial) {
            initial.style.display =
                "none";
        }
    } else {
        if (preview) {
            preview.src = "";
            preview.style.display =
                "none";
        }

        if (initial) {
            initial.style.display =
                "block";

            initial.textContent =
                (
                    state.user.name ||
                    state.user.username ||
                    "?"
                )
                    .charAt(0)
                    .toUpperCase();
        }
    }

    if ($("editProfileAvatarName")) {
        $("editProfileAvatarName").textContent =
            "Nincs új kép kiválasztva";
    }

    if ($("editProfileAvatar")) {
        $("editProfileAvatar").value =
            "";
    }

    openModal(
        "profileEditModal"
    );
}


/* ============================================================
   PROFIL ÜZENET
============================================================ */

function showProfileMessage(
    text,
    type = "error"
) {
    const box =
        $("profileEditMessage");

    if (!box) return;

    box.textContent =
        text;

    box.style.display =
        "block";

    box.style.background =
        type === "success"
            ? "#dcfce7"
            : "#fee2e2";

    box.style.color =
        type === "success"
            ? "#166534"
            : "#991b1b";
}

function clearProfileMessage() {
    const box =
        $("profileEditMessage");

    if (!box) return;

    box.textContent = "";

    box.style.display =
        "none";
}


/* ============================================================
   KÉP ÁTMÉRETEZÉSE
============================================================ */

function resizeImage(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onerror =
                reject;

            reader.onload = () => {
                const img =
                    new Image();

                img.onerror =
                    reject;

                img.onload = () => {
                    const max = 512;

                    const scale =
                        Math.min(
                            1,
                            max /
                                Math.max(
                                    img.width,
                                    img.height
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
                                img.width *
                                    scale
                            )
                        );

                    canvas.height =
                        Math.max(
                            1,
                            Math.round(
                                img.height *
                                    scale
                            )
                        );

                    const context =
                        canvas.getContext(
                            "2d"
                        );

                    context.drawImage(
                        img,
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

                img.src =
                    reader.result;
            };

            reader.readAsDataURL(
                file
            );
        }
    );
}


/* ============================================================
   PROFILKÉP ELŐNÉZET
============================================================ */

async function previewProfileImage(event) {
    const file =
        event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        event.target.value = "";

        return showProfileMessage(
            "Csak képfájlt választhatsz."
        );
    }

    if (file.size > 8 * 1024 * 1024) {
        event.target.value = "";

        return showProfileMessage(
            "A kép maximum 8 MB lehet."
        );
    }

    try {
        const data =
            await resizeImage(file);

        window.__tbSelectedAvatar =
            data;

        const preview =
            $("editProfileAvatarPreview");

        if (preview) {
            preview.src =
                data;

            preview.style.display =
                "block";
        }

        const initial =
            $("editProfileAvatarInitial");

        if (initial) {
            initial.style.display =
                "none";
        }

        if ($("editProfileAvatarName")) {
            $("editProfileAvatarName").textContent =
                file.name;
        }

        clearProfileMessage();

    } catch (error) {
        console.error(error);

        showProfileMessage(
            "Nem sikerült feldolgozni a képet."
        );
    }
}


/* ============================================================
   PROFIL MENTÉSE
============================================================ */

async function saveProfile() {
    const name =
        $("editProfileName")
            ?.value
            .trim();

    const username =
        $("editProfileUsername")
            ?.value
            .trim();

    const email =
        $("editProfileEmail")
            ?.value
            .trim();

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
        return showProfileMessage(
            "Tölts ki minden mezőt!"
        );
    }

    if (
        grade < 5 ||
        grade > 12
    ) {
        return showProfileMessage(
            "Az évfolyam 5 és 12 között lehet."
        );
    }

    if (
        password &&
        password.length < 6
    ) {
        return showProfileMessage(
            "Az új jelszó legalább 6 karakter legyen."
        );
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
                        JSON.stringify(body)
                }
            );

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
            () => {
                closeModal(
                    "profileEditModal"
                );
            },
            700
        );

    } catch (error) {
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
        loadMaterials(),
        loadStats()
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

    /* LOGIN */

    $("loginForm")
        ?.addEventListener(
            "submit",
            event => {
                event.preventDefault();
                login();
            }
        );


    /* REGISZTRÁCIÓ */

    $("registerForm")
        ?.addEventListener(
            "submit",
            event => {
                event.preventDefault();
                register();
            }
        );


    /* LOGOUT */

    $("logoutButton")
        ?.addEventListener(
            "click",
            logout
        );


    /* LOGIN TAB */

    $("loginTab")
        ?.addEventListener(
            "click",
            () => {
                $("loginTab")
                    ?.classList
                    .add("active");

                $("registerTab")
                    ?.classList
                    .remove("active");

                $("loginForm")
                    ?.classList
                    .remove("hidden");

                $("registerForm")
                    ?.classList
                    .add("hidden");

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


    /* REGISTER TAB */

    $("registerTab")
        ?.addEventListener(
            "click",
            () => {
                $("registerTab")
                    ?.classList
                    .add("active");

                $("loginTab")
                    ?.classList
                    .remove("active");

                $("registerForm")
                    ?.classList
                    .remove("hidden");

                $("loginForm")
                    ?.classList
                    .add("hidden");

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


    /* PASSWORD MEGJELENÍTÉS */

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

                    if (!input) return;

                    input.type =
                        input.type ===
                        "password"
                            ? "text"
                            : "password";
                }
            );
        });


    /* FELHASZNÁLÓ KERESÉS */

    $("searchUsersButton")
        ?.addEventListener(
            "click",
            searchUsers
        );

    $("userSearch")
        ?.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Enter"
                ) {
                    event.preventDefault();
                    searchUsers();
                }
            }
        );


    /* TANANYAG KERESÉS */

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


    /* CHAT ENTER */

    $("chatInput")
        ?.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();
                    sendMessage();
                }
            }
        );


    /* CHAT KÜLDÉS */

    $("sendChatButton")
        ?.addEventListener(
            "click",
            sendMessage
        );


    /* AI GOMBOK */

    [
        "homeAIButton",
        "learningAIButton",
        "emptyLearningAIButton",
        "bottomAIButton"
    ].forEach(id => {
        $(id)?.addEventListener(
            "click",
            openAIModal
        );
    });


    $("chatAIButton")
        ?.addEventListener(
            "click",
            openAIModal
        );


    /* AI GENERÁLÁS */

    $("generateAIButton")
        ?.addEventListener(
            "click",
            generateAI
        );


    /* AI ELKÜLDÉS */

    $("approveSendButton")
        ?.addEventListener(
            "click",
            approveAndSendAI
        );


    /* PREVIEW MÉGSE */

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


    /* AI TÍPUS */

    document
        .querySelectorAll(
            "[data-ai-type]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    state.aiType =
                        button.dataset
                            .aiType ||
                        "material";

                    document
                        .querySelectorAll(
                            "[data-ai-type]"
                        )
                        .forEach(b => {
                            b.classList.toggle(
                                "active",
                                b === button
                            );
                        });
                }
            );
        });


    /* RATING */

    $("cancelRatingButton")
        ?.addEventListener(
            "click",
            () =>
                closeModal(
                    "ratingModal"
                )
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


    /* JEGY */

    $("cancelGradeButton")
        ?.addEventListener(
            "click",
            () =>
                closeModal(
                    "gradeModal"
                )
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
                        .forEach(b => {
                            b.classList.toggle(
                                "selected",
                                b === button
                            );
                        });

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
       EGYETLEN GLOBÁLIS CLICK KEZELŐ
    ======================================================== */

    document.addEventListener(
        "click",
        event => {

            /* NAVIGÁCIÓ */

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
                return openChat(
                    Number(
                        chat.dataset.chatId
                    )
                );
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


            /* ELFOGADÁS */

            const accept =
                event.target.closest(
                    "[data-accept-id]"
                );

            if (accept) {
                return acceptFriend(
                    Number(
                        accept.dataset
                            .acceptId
                    )
                );
            }


            /* ELUTASÍTÁS */

            const reject =
                event.target.closest(
                    "[data-reject-id]"
                );

            if (reject) {
                return rejectFriend(
                    Number(
                        reject.dataset
                            .rejectId
                    )
                );
            }


            /* BARÁTI KÉRÉS */

            const request =
                event.target.closest(
                    "[data-request-id]"
                );

            if (request) {
                return sendFriendRequest(
                    Number(
                        request.dataset
                            .requestId
                    )
                );
            }


            /* TANANYAG */

            const material =
                event.target.closest(
                    "[data-material-id]"
                );

            if (material) {
                return openMaterial(
                    Number(
                        material.dataset
                            .materialId
                    )
                );
            }


            /* TANANYAG KÜLDÉSE */

            const sendFriend =
                event.target.closest(
                    "[data-send-friend-id]"
                );

            if (sendFriend) {
                return sendGeneratedMaterial(
                    Number(
                        sendFriend.dataset
                            .sendFriendId
                    )
                );
            }


            /* AI */

            const ai =
                event.target.closest(
                    "[data-open-ai]"
                );

            if (ai) {
                return openAIModal();
            }


            /* MODAL BEZÁRÁS */

            const close =
                event.target.closest(
                    "[data-close-modal]"
                );

            if (close) {
                return closeModal(
                    close.dataset
                        .closeModal
                );
            }


            /* MODAL HÁTTÉR */

            const modal =
                event.target.classList
                    .contains(
                        "modal-overlay"
                    )
                    ? event.target
                    : null;

            if (modal) {
                closeModal(
                    modal.id
                );
            }
        }
    );


    /* MOBIL MENÜ */

    $("mobileMenuButton")
        ?.addEventListener(
            "click",
            () =>
                $("sidebar")
                    ?.classList
                    .toggle("open")
        );


    /* TÉMA */

    $("themeToggle")
        ?.addEventListener(
            "click",
            () => {
                document.body.classList.toggle(
                    "light-theme"
                );
            }
        );


    /* ÉRTESÍTÉSEK */

    $("notificationButton")
        ?.addEventListener(
            "click",
            () => {
                navigate("friends");

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


    /* ESC MODAL */

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
   PROFIL SZERKESZTŐ BEZÁRÁSA
============================================================ */

function closeProfileEditor() {
    closeModal(
        "profileEditModal"
    );
}


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

        showAuth();

        await checkLogin();
    }
);