"use strict";

/* ============================================================
   TANULÓBARÁT - APP.JS
   ============================================================ */

const state = {
    user: null,
    friends: [],
    requests: [],
    searchUsers: [],
    currentFriend: null,
    messages: [],
    materials: [],
    grades: [],
    stats: null
};

const $ = id => document.getElementById(id);

/* ============================================================
   API
   ============================================================ */

async function api(url, options = {}) {
    const config = {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    };

    const response = await fetch(url, config);

    let data = {};

    try {
        data = await response.json();
    } catch (_) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.error || `Hiba történt (${response.status}).`);
    }

    return data;
}

/* ============================================================
   SEGÉDFÜGGVÉNYEK
   ============================================================ */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
    let container = $("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("hide");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function showProfileMessage(message, type = "error") {
    const box = $("profileMessage");

    if (!box) {
        showToast(message, type);
        return;
    }

    box.textContent = message;
    box.className = `profile-message ${type}`;
}

function formatDate(date) {
    if (!date) return "";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return date;
    }

    return d.toLocaleString("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getInitial(name) {
    return String(name || "?")
        .trim()
        .charAt(0)
        .toUpperCase();
}

/* ============================================================
   NÉZETEK
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
        app.style.display = "";
    }

    navigate("homePage");
}

function navigate(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
        page.style.display = "none";
    });

    const page = $(pageId);

    if (!page) return;

    page.classList.remove("hidden");
    page.style.display = "";

    document.querySelectorAll("[data-page]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageId
        );
    });

    if (pageId === "friendsPage") {
        loadFriends();
        loadRequests();
    }

    if (pageId === "gradesPage") {
        loadGrades();
    }

    if (pageId === "homePage") {
        loadStats();
    }

    if (pageId === "learningPage") {
        loadMaterials();
    }
}

/* ============================================================
   FELHASZNÁLÓ UI
   ============================================================ */

function updateUserUI() {
    if (!state.user) return;

    const user = state.user;

    document.querySelectorAll("[data-user-name]").forEach(element => {
        element.textContent = user.name || user.username || "";
    });

    document.querySelectorAll("[data-user-username]").forEach(element => {
        element.textContent = user.username || "";
    });

    document.querySelectorAll("[data-user-grade]").forEach(element => {
        element.textContent = user.grade ? `${user.grade}. évfolyam` : "";
    });

    const avatarElements = document.querySelectorAll(
        "[data-user-avatar]"
    );

    avatarElements.forEach(element => {
        if (user.avatar) {
            element.innerHTML = `
                <img
                    src="${escapeHTML(user.avatar)}"
                    alt="Profilkép"
                >
            `;
        } else {
            element.textContent = getInitial(user.name);
        }
    });
}

/* ============================================================
   SESSION
   ============================================================ */

async function checkSession() {
    try {
        const data = await api("/api/me");

        if (data.user) {
            state.user = data.user;
            updateUserUI();
            showApp();

            await Promise.all([
                loadFriends(),
                loadRequests(),
                loadStats()
            ]);
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
    const username = $("loginUsername")?.value.trim();
    const password = $("loginPassword")?.value || "";

    if (!username || !password) {
        showToast("Töltsd ki a felhasználónevet és a jelszót!", "error");
        return;
    }

    const button = $("loginButton");

    if (button) {
        button.disabled = true;
        button.textContent = "⏳ Belépés...";
    }

    try {
        const data = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        state.user = data.user;

        updateUserUI();
        showApp();

        await Promise.all([
            loadFriends(),
            loadRequests(),
            loadStats()
        ]);

        showToast("Sikeres bejelentkezés! 👋", "success");

    } catch (error) {
        showToast(error.message, "error");

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Belépés";
        }
    }
}

/* ============================================================
   REGISZTRÁCIÓ
   ============================================================ */

async function register() {
    const name = $("registerName")?.value.trim();
    const username = $("registerUsername")?.value.trim();
    const email = $("registerEmail")?.value.trim();
    const password = $("registerPassword")?.value || "";
    const grade = Number($("registerGrade")?.value);

    if (!name || !username || !email || !password || !grade) {
        showToast("Tölts ki minden mezőt!", "error");
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
            "A jelszónak legalább 6 karakteresnek kell lennie.",
            "error"
        );
        return;
    }

    const button = $("registerButton");

    if (button) {
        button.disabled = true;
        button.textContent = "⏳ Regisztráció...";
    }

    try {
        const data = await api("/api/register", {
            method: "POST",
            body: JSON.stringify({
                name,
                username,
                email,
                password,
                grade
            })
        });

        state.user = data.user;

        updateUserUI();
        showApp();

        showToast(
            "Sikeres regisztráció! 🎉",
            "success"
        );

    } catch (error) {
        showToast(error.message, "error");

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Regisztráció";
        }
    }
}

/* ============================================================
   KIJELENTKEZÉS
   ============================================================ */

async function logout() {
    try {
        await api("/api/logout", {
            method: "POST",
            body: JSON.stringify({})
        });
    } catch (_) {
        // Ha a szerver már kijelentkeztetett, akkor is folytatjuk.
    }

    state.user = null;
    state.friends = [];
    state.requests = [];
    state.searchUsers = [];
    state.currentFriend = null;
    state.messages = [];

    showAuth();

    showToast(
        "Sikeresen kijelentkeztél.",
        "success"
    );
}

/* ============================================================
   BARÁTOK BETÖLTÉSE
   ============================================================ */

async function loadFriends() {
    try {
        const data = await api("/api/friends");

        state.friends = data.friends || [];

        renderFriends();
        renderChatFriends();

    } catch (error) {
        console.error("Barátok betöltése:", error);
    }
}

function renderFriends() {
    const box = $("friendsList");

    if (!box) return;

    if (!state.friends.length) {
        box.innerHTML = `
            <div class="empty-inline">
                Még nincs barátod.
            </div>
        `;
        return;
    }

    box.innerHTML = state.friends.map(friend => `
        <div class="friend-card">
            <div class="friend-avatar">
                ${
                    friend.avatar
                        ? `<img src="${escapeHTML(friend.avatar)}" alt="Profilkép">`
                        : escapeHTML(getInitial(friend.name))
                }
            </div>

            <div class="friend-info">
                <strong>${escapeHTML(friend.name)}</strong>
                <span>@${escapeHTML(friend.username)}</span>
                ${
                    friend.grade
                        ? `<small>${escapeHTML(friend.grade)}. évfolyam</small>`
                        : ""
                }
            </div>

            <div class="friend-actions">
                <button
                    type="button"
                    class="primary-button"
                    data-chat-friend="${friend.id}"
                >
                    💬 Chat
                </button>
            </div>
        </div>
    `).join("");
}

function renderChatFriends() {
    const box = $("chatFriendsList");

    if (!box) return;

    if (!state.friends.length) {
        box.innerHTML = `
            <div class="empty-inline">
                Nincsenek barátaid.
            </div>
        `;
        return;
    }

    box.innerHTML = state.friends.map(friend => `
        <button
            type="button"
            class="chat-friend"
            data-chat-friend="${friend.id}"
        >
            <span class="friend-avatar">
                ${
                    friend.avatar
                        ? `<img src="${escapeHTML(friend.avatar)}" alt="">`
                        : escapeHTML(getInitial(friend.name))
                }
            </span>

            <span>
                <strong>${escapeHTML(friend.name)}</strong>
                <small>@${escapeHTML(friend.username)}</small>
            </span>
        </button>
    `).join("");
}

/* ============================================================
   ⭐ ITT KEZDŐDIK A JAVÍTOTT BARÁTKERESÉS
   ============================================================ */

let friendSearchTimer = null;

async function searchUsers() {
    const input = $("userSearch");
    const box = $("searchResults");

    if (!input || !box) {
        console.error(
            "A userSearch vagy searchResults elem nem található."
        );
        return;
    }

    const query = input.value.trim();

    clearTimeout(friendSearchTimer);

    if (!query) {
        box.innerHTML = `
            <div class="empty-inline">
                Írj be egy nevet vagy felhasználónevet.
            </div>
        `;

        state.searchUsers = [];
        return;
    }

    box.innerHTML = `
        <div class="empty-inline">
            🔎 Keresés...
        </div>
    `;

    try {
        const data = await api(
            `/api/users?q=${encodeURIComponent(query)}`
        );

        state.searchUsers = Array.isArray(data.users)
            ? data.users
            : [];

        renderSearchResults();

    } catch (error) {
        console.error("Barátkeresési hiba:", error);

        box.innerHTML = `
            <div class="empty-inline error">
                ❌ ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderSearchResults() {
    const box = $("searchResults");

    if (!box) return;

    if (!state.searchUsers.length) {
        box.innerHTML = `
            <div class="empty-inline">
                🔍 Nem található ilyen felhasználó.
            </div>
        `;
        return;
    }

    box.innerHTML = state.searchUsers.map(user => `
        <div class="search-user-card">

            <div class="friend-avatar">
                ${
                    user.avatar
                        ? `
                            <img
                                src="${escapeHTML(user.avatar)}"
                                alt="Profilkép"
                            >
                        `
                        : escapeHTML(
                            getInitial(user.name)
                        )
                }
            </div>

            <div class="friend-info">
                <strong>
                    ${escapeHTML(user.name)}
                </strong>

                <span>
                    @${escapeHTML(user.username)}
                </span>

                ${
                    user.grade
                        ? `
                            <small>
                                ${escapeHTML(user.grade)}. évfolyam
                            </small>
                        `
                        : ""
                }
            </div>

            <button
                type="button"
                class="primary-button"
                data-add-friend="${user.id}"
            >
                ➕ Barátnak jelölés
            </button>

        </div>
    `).join("");
}

async function sendFriendRequest(userId) {
    if (!userId) return;

    try {
        await api("/api/friends/request", {
            method: "POST",
            body: JSON.stringify({
                userId: Number(userId)
            })
        });

        showToast(
            "Barátkérelem elküldve! 👥",
            "success"
        );

        await searchUsers();

    } catch (error) {
        showToast(error.message, "error");
    }
}

/* ============================================================
   BEÉRKEZŐ BARÁTKÉRELMEK
   ============================================================ */

async function loadRequests() {
    try {
        const data = await api(
            "/api/friends/requests"
        );

        state.requests = data.requests || [];

        renderRequests();

        const badge = $("friendRequestBadge");

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
            "Barátkérelmek betöltése:",
            error
        );
    }
}

function renderRequests() {
    const box = $("friendRequests");

    if (!box) return;

    if (!state.requests.length) {
        box.innerHTML = `
            <div class="empty-inline">
                Nincs új baráti kérés.
            </div>
        `;
        return;
    }

    box.innerHTML = state.requests.map(request => `
        <div class="request-card">

            <div class="friend-avatar">
                ${escapeHTML(
                    getInitial(request.name)
                )}
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
    `).join("");
}

async function acceptFriend(id) {
    try {
        await api(
            `/api/friends/${id}/accept`,
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
            `/api/friends/${id}/reject`,
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
   CHAT
   ============================================================ */

async function openChat(friendId) {
    const friend = state.friends.find(
        item => Number(item.id) === Number(friendId)
    );

    if (!friend) {
        showToast("A barát nem található.", "error");
        return;
    }

    state.currentFriend = friend;

    const chatTitle = $("chatTitle");
    const chatSubtitle = $("chatSubtitle");

    if (chatTitle) {
        chatTitle.textContent = friend.name;
    }

    if (chatSubtitle) {
        chatSubtitle.textContent =
            `@${friend.username}`;
    }

    navigate("chatPage");

    await loadMessages(friend.id);
}

async function loadMessages(friendId) {
    try {
        const data = await api(
            `/api/messages/${friendId}`
        );

        state.messages = data.messages || [];

        renderMessages();

    } catch (error) {
        console.error(
            "Üzenetek betöltése:",
            error
        );

        showToast(
            error.message,
            "error"
        );
    }
}

function renderMessages() {
    const box = $("messages");

    if (!box) return;

    if (!state.messages.length) {
        box.innerHTML = `
            <div class="empty-inline">
                Még nincs üzenet.
            </div>
        `;
        return;
    }

    box.innerHTML = state.messages.map(message => {
        const own =
            Number(message.sender) ===
            Number(state.user?.id);

        if (message.type === "material") {
            return `
                <div class="message-row ${own ? "own" : "other"}">
                    <div class="message material-message">

                        <div class="material-icon">
                            📖
                        </div>

                        <div class="material-content">
                            <strong>
                                Tananyag érkezett
                            </strong>

                            <span>
                                ${escapeHTML(
                                    message.message || "Új tananyag"
                                )}
                            </span>

                            ${
                                message.materialId
                                    ? `
                                        <button
                                            type="button"
                                            class="primary-button"
                                            data-open-material="${message.materialId}"
                                        >
                                            📖 Megnyitás
                                        </button>
                                    `
                                    : ""
                            }
                        </div>

                        <small>
                            ${formatDate(message.date)}
                        </small>

                    </div>
                </div>
            `;
        }

        return `
            <div class="message-row ${own ? "own" : "other"}">
                <div class="message">

                    <div class="message-text">
                        ${escapeHTML(message.message)}
                    </div>

                    <small>
                        ${formatDate(message.date)}
                    </small>

                </div>
            </div>
        `;
    }).join("");

    box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
    if (!state.currentFriend) {
        showToast(
            "Előbb válassz ki egy barátot.",
            "error"
        );
        return;
    }

    const input = $("messageInput");

    if (!input) return;

    const message = input.value.trim();

    if (!message) return;

    const button = $("sendMessageButton");

    if (button) {
        button.disabled = true;
    }

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

        await loadMessages(
            state.currentFriend.id
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );

    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

let chatRefreshTimer = null;

function startChatRefresh() {
    clearInterval(chatRefreshTimer);

    chatRefreshTimer = setInterval(() => {
        if (
            state.currentFriend &&
            !$("chatPage")?.classList.contains("hidden")
        ) {
            loadMessages(
                state.currentFriend.id
            );
        }
    }, 3000);
}

/* ============================================================
   TANANYAGOK
   ============================================================ */

async function loadMaterials() {
    try {
        const data = await api(
            "/api/materials"
        );

        state.materials =
            data.materials || [];

        renderMaterials();

    } catch (error) {
        console.error(
            "Tananyagok betöltése:",
            error
        );
    }
}

function renderMaterials() {
    const box = $("materialsList");

    if (!box) return;

    if (!state.materials.length) {
        box.innerHTML = `
            <div class="empty-inline">
                Még nincs tananyagod.
            </div>
        `;
        return;
    }

    box.innerHTML = state.materials.map(material => `
        <div class="material-card">

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

                <span>
                    ${escapeHTML(material.subject)}
                </span>

                <small>
                    ${formatDate(material.date)}
                </small>

            </div>

            <button
                type="button"
                class="primary-button"
                data-open-material="${material.id}"
            >
                Megnyitás
            </button>

        </div>
    `).join("");
}

async function openMaterial(materialId) {
    try {
        const data = await api(
            `/api/materials/${materialId}`
        );

        const material = data.material;

        if (!material) {
            throw new Error(
                "A tananyag nem található."
            );
        }

        showMaterialViewer(material);

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

function showMaterialViewer(material) {
    closeDynamicModal();

    const modal =
        document.createElement("div");

    modal.id = "dynamicMaterialModal";
    modal.className = "modal-overlay";

    modal.innerHTML = `
        <div class="modal-card material-viewer">

            <button
                type="button"
                class="modal-close"
                data-close-modal
            >
                ×
            </button>

            <div class="material-viewer-header">

                <div>
                    <span class="material-label">
                        ${escapeHTML(material.subject)}
                    </span>

                    <h2>
                        ${escapeHTML(material.title)}
                    </h2>
                </div>

                <div class="material-type">
                    ${escapeHTML(material.type || "material")}
                </div>

            </div>

            <div class="material-viewer-content">
                ${formatMaterialContent(material.content)}
            </div>

        </div>
    `;

    document.body.appendChild(modal);
}

function formatMaterialContent(content) {
    return escapeHTML(content || "")
        .replace(/\n/g, "<br>");
}

function closeDynamicModal() {
    const modal =
        $("dynamicMaterialModal");

    if (modal) {
        modal.remove();
    }
}

/* ============================================================
   AI TANULÁSI ANYAG
   ============================================================ */

function openAIModal() {
    const modal = $("aiModal");

    if (!modal) {
        createAIModal();
        return;
    }

    modal.classList.remove("hidden");
    modal.style.display = "flex";
}

function closeAIModal() {
    const modal = $("aiModal");

    if (!modal) return;

    modal.classList.add("hidden");
    modal.style.display = "none";
}

function createAIModal() {
    const modal =
        document.createElement("div");

    modal.id = "aiModal";
    modal.className = "modal-overlay";

    modal.innerHTML = `
        <div class="modal-card">

            <button
                type="button"
                class="modal-close"
                data-close-modal
            >
                ×
            </button>

            <h2>🧙 AI tanulási anyag</h2>

            <p>
                Add meg, miből szeretnél tanulni.
            </p>

            <label>
                Tantárgy
            </label>

            <input
                id="aiSubject"
                type="text"
                placeholder="Pl. matematika"
            >

            <label>
                Téma
            </label>

            <input
                id="aiTopic"
                type="text"
                placeholder="Pl. másodfokú egyenlet"
            >

            <label>
                Típus
            </label>

            <select id="aiType">
                <option value="material">
                    📖 Tananyag
                </option>

                <option value="test">
                    📝 Teszt
                </option>

                <option value="homework">
                    📚 Házi feladat
                </option>
            </select>

            <div class="modal-actions">

                <button
                    type="button"
                    class="secondary-button"
                    data-close-modal
                >
                    Mégse
                </button>

                <button
                    type="button"
                    class="primary-button"
                    id="generateAIButton"
                >
                    🧙 Létrehozás
                </button>

            </div>

            <div id="aiResult"></div>

        </div>
    `;

    document.body.appendChild(modal);
}

async function generateAI() {
    const subject =
        $("aiSubject")?.value.trim();

    const topic =
        $("aiTopic")?.value.trim();

    const type =
        $("aiType")?.value || "material";

    const result =
        $("aiResult");

    if (!subject || !topic) {
        showToast(
            "Add meg a tantárgyat és a témát!",
            "error"
        );
        return;
    }

    const button =
        $("generateAIButton");

    if (button) {
        button.disabled = true;
        button.textContent =
            "⏳ Létrehozás...";
    }

    if (result) {
        result.innerHTML = `
            <div class="empty-inline">
                🧙 Az AI elkészíti a tananyagot...
            </div>
        `;
    }

    try {
        const data = await api(
            "/api/ai/generate",
            {
                method: "POST",
                body: JSON.stringify({
                    subject,
                    topic,
                    type
                })
            }
        );

        showAIPreview(data);

    } catch (error) {
        if (result) {
            result.innerHTML = `
                <div class="empty-inline error">
                    ❌ ${escapeHTML(error.message)}
                </div>
            `;
        }

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                "🧙 Létrehozás";
        }
    }
}

function showAIPreview(data) {
    const result =
        $("aiResult");

    if (!result) return;

    result.innerHTML = `
        <div class="ai-preview">

            <h3>
                ${escapeHTML(data.title || "Tananyag")}
            </h3>

            <div class="ai-section">
                <strong>📖 Magyarázat</strong>
                <p>
                    ${escapeHTML(data.explanation || "")}
                </p>
            </div>

            <div class="ai-section">
                <strong>⭐ Fontos</strong>
                <p>
                    ${escapeHTML(data.important || "")}
                </p>
            </div>

            <div class="ai-section">
                <strong>💡 Példák</strong>
                <p>
                    ${escapeHTML(data.examples || "")}
                </p>
            </div>

            <div class="ai-section">
                <strong>📌 Összefoglalás</strong>
                <p>
                    ${escapeHTML(data.summary || "")}
                </p>
            </div>

            <div class="modal-actions">

                <button
                    type="button"
                    class="secondary-button"
                    data-close-modal
                >
                    Mégse
                </button>

                <button
                    type="button"
                    class="primary-button"
                    id="approveAIButton"
                >
                    ✓ Tananyag mentése
                </button>

            </div>

        </div>
    `;

    window.__tbLastAI = data;
}

async function approveAI() {
    const data =
        window.__tbLastAI;

    if (!data) {
        showToast(
            "Nincs menthető AI tananyag.",
            "error"
        );
        return;
    }

    const friends = state.friends || [];

    if (!friends.length) {
        try {
            await saveGeneratedMaterial(
                data,
                null
            );

            showToast(
                "Tananyag elmentve! 📖",
                "success"
            );

            closeAIModal();
            await loadMaterials();

        } catch (error) {
            showToast(
                error.message,
                "error"
            );
        }

        return;
    }

    showFriendSelectForMaterial(data);
}

async function saveGeneratedMaterial(
    data,
    friendId = null
) {
    const material = {
        subject: data.subject,
        title: data.title,
        content: data.content ||
            [
                data.explanation,
                data.important,
                data.examples,
                data.summary
            ].filter(Boolean).join("\n\n"),
        type: data.type || "material"
    };

    if (friendId) {
        material.friendId =
            Number(friendId);
    }

    return await api(
        "/api/materials",
        {
            method: "POST",
            body: JSON.stringify(material)
        }
    );
}

function showFriendSelectForMaterial(data) {
    const modal =
        document.createElement("div");

    modal.id = "materialFriendModal";
    modal.className = "modal-overlay";

    modal.innerHTML = `
        <div class="modal-card">

            <button
                type="button"
                class="modal-close"
                data-close-material-friend
            >
                ×
            </button>

            <h2>
                📤 Tananyag küldése
            </h2>

            <p>
                Válaszd ki, melyik barátodnak
                szeretnéd elküldeni.
            </p>

            <div class="friend-select-list">

                ${state.friends.map(friend => `
                    <button
                        type="button"
                        class="friend-select-item"
                        data-send-material-friend="${friend.id}"
                    >
                        <span class="friend-avatar">
                            ${escapeHTML(
                                getInitial(friend.name)
                            )}
                        </span>

                        <span>
                            <strong>
                                ${escapeHTML(friend.name)}
                            </strong>

                            <small>
                                @${escapeHTML(friend.username)}
                            </small>
                        </span>

                    </button>
                `).join("")}

            </div>

            <button
                type="button"
                class="secondary-button"
                data-save-material-only
            >
                💾 Csak mentés
            </button>

        </div>
    `;

    document.body.appendChild(modal);

    window.__tbMaterialForSend = data;
}

async function sendMaterialToFriend(friendId) {
    const data =
        window.__tbMaterialForSend;

    if (!data) return;

    try {
        await saveGeneratedMaterial(
            data,
            friendId
        );

        showToast(
            "Tananyag elküldve! 📤",
            "success"
        );

        const modal =
            $("materialFriendModal");

        if (modal) {
            modal.remove();
        }

        closeAIModal();

        await loadMaterials();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}
/* =========================================================
   TANULÓBARÁT – BARÁTKERESÉS JAVÍTÁS
   Ezt a kódot az app.js VÉGÉRE kell tenni.
   ========================================================= */

(function () {
    let searchTimer = null;

    async function fixedFriendSearch() {
        const input = document.getElementById("userSearch");
        const results = document.getElementById("searchResults");

        if (!input || !results) {
            console.error("TanulóBarát: nem található a barátkeresés HTML eleme.");
            return;
        }

        const query = input.value.trim();

        if (!query) {
            results.innerHTML =
                '<div class="empty-inline">Írj be egy nevet vagy felhasználónevet.</div>';

            if (typeof state !== "undefined") {
                state.searchUsers = [];
            }

            return;
        }

        results.innerHTML =
            '<div class="empty-inline">🔎 Keresés folyamatban...</div>';

        try {
            const response = await fetch(
                "/api/users?q=" + encodeURIComponent(query),
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "A keresés sikertelen."
                );
            }

            const users = Array.isArray(data.users)
                ? data.users
                : [];

            if (typeof state !== "undefined") {
                state.searchUsers = users;
            }

            if (users.length === 0) {
                results.innerHTML =
                    '<div class="empty-inline">😕 Nem található ilyen felhasználó.</div>';
                return;
            }

            results.innerHTML = users.map(function (user) {
                const name = escapeHTML(
                    user.name || user.username || "Ismeretlen"
                );

                const username = escapeHTML(
                    user.username || ""
                );

                const grade = user.grade
                    ? `${user.grade}. évfolyam`
                    : "";

                return `
                    <div class="search-user-card">
                        <div class="search-user-info">
                            <div class="search-user-avatar">
                                ${user.avatar
                                    ? `<img src="${escapeHTML(user.avatar)}" alt="">`
                                    : "👤"
                                }
                            </div>

                            <div>
                                <strong>${name}</strong>
                                <div class="muted">
                                    @${username}
                                    ${grade ? " • " + grade : ""}
                                </div>
                            </div>
                        </div>

                        <button
                            class="primary-button"
                            type="button"
                            data-action="send-friend-request"
                            data-user-id="${escapeHTML(String(user.id))}"
                        >
                            ➕ Barátnak jelölés
                        </button>
                    </div>
                `;
            }).join("");

        } catch (error) {
            console.error(
                "TanulóBarát barátkeresési hiba:",
                error
            );

            results.innerHTML = `
                <div class="empty-inline">
                    ❌ ${escapeHTML(
                        error.message || "Hiba történt a keresés közben."
                    )}
                </div>
            `;
        }
    }


    function startFriendSearch() {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(function () {
            fixedFriendSearch();
        }, 250);
    }


    function connectFriendSearch() {
        const input = document.getElementById("userSearch");
        const button = document.getElementById("searchUsersButton");

        if (input) {
            input.addEventListener("input", function () {
                startFriendSearch();
            });

            input.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();

                    clearTimeout(searchTimer);

                    fixedFriendSearch();
                }
            });

            input.addEventListener("search", function () {
                fixedFriendSearch();
            });
        }

        if (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();

                clearTimeout(searchTimer);

                fixedFriendSearch();
            });
        }

        console.log("✅ TanulóBarát: barátkeresés javító modul betöltve.");
    }


    /*
       Megvárjuk, hogy az oldal teljesen betöltődjön.
    */
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            connectFriendSearch
        );
    } else {
        connectFriendSearch();
    }


    /*
       Globálisan is elérhetővé tesszük.
    */
    window.fixedFriendSearch = fixedFriendSearch;

})();