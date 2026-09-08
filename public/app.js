/* ============================================================
   TANULÓBARÁT - APP.JS
   Teljes kliensoldali alkalmazás
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

    searchUsers: [],
    selectedSendFriendId: null
};

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

async function api(url, options = {}) {
    const config = {
        credentials: "include",
        ...options
    };

    config.headers = {
        ...(options.body instanceof FormData
            ? {}
            : {
                "Content-Type":
                    "application/json"
            }),
        ...(options.headers || {})
    };

    const response =
        await fetch(url, config);

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

function setLoading(show, text = "Betöltés...") {
    const el = $("globalLoading");

    if (!el) return;

    if ($("loadingText")) {
        $("loadingText").textContent =
            text;
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
   AUTH / APP
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

    if (page === "friends") {
        loadFriends();
        loadRequests();
    }

    if (page === "learning") {
        loadMaterials();
    }

    if (page === "grades") {
        loadGrades();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* ============================================================
   FELHASZNÁLÓI FELÜLET
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

    [
        "profileAvatar",
        "userAvatar",
        "sidebarAvatar"
    ].forEach(id => {
        if ($(id)) {
            const el = $(id);

            if (state.user.avatar) {
                el.textContent = "";
                el.style.backgroundImage =
                    `url("${state.user.avatar}")`;
                el.style.backgroundSize =
                    "cover";
                el.style.backgroundPosition =
                    "center";
            } else {
                el.style.backgroundImage =
                    "";
                el.textContent = initial;
            }
        }
    });

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
   LOGIN
============================================================ */

async function checkLogin() {
    try {
        const data =
            await api("/api/me");

        if (data.user) {
            state.user = data.user;

            showApp();

            await loadAll();
        } else {
            showAuth();
        }
    } catch (_) {
        showAuth();
    }
}

async function login() {
    const username =
        $("loginUsername")?.value.trim();

    const password =
        $("loginPassword")?.value || "";

    if (!username || !password) {
        return showToast(
            "Add meg a felhasználónevet és a jelszót!",
            "error"
        );
    }

    try {
        const data =
            await api("/api/login", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password
                })
            });

        state.user = data.user;

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
            await api("/api/register", {
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
    state.currentMessages = [];

    showAuth();

    showToast(
        "Kijelentkeztél.",
        "info"
    );
}

/* ============================================================
   BARÁTOK
============================================================ */

async function loadFriends() {
    try {
        const data =
            await api("/api/friends");

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
                        ${
                            friend.avatar
                                ? `<img src="${escapeHTML(friend.avatar)}">`
                                : escapeHTML(initial)
                        }
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
                            data-chat-id="${friend.id}">
                            💬 Chat
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-rate-id="${friend.id}">
                            ⭐ Értékelés
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-grade-id="${friend.id}">
                            📊 Jegy
                        </button>

                    </div>

                </div>
            `;
        }).join("");
}

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

function renderRequests() {
    const box =
        $("friendRequests");

    if (!box) return;

    if (!state.requests.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <div class="empty-icon">📭</div>
                <p>Nincs új barátkérelmed.</p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.requests.map(request => `
            <div class="request-card">

                <div>
                    <strong>
                        ${escapeHTML(request.name)}
                    </strong>

                    <span>
                        @${escapeHTML(request.username)}
                    </span>
                </div>

                <div class="request-actions">

                    <button
                        type="button"
                        class="primary-button"
                        data-accept-id="${request.id}">
                        ✓ Elfogadás
                    </button>

                    <button
                        type="button"
                        class="secondary-button"
                        data-reject-id="${request.id}">
                        ✕ Elutasítás
                    </button>

                </div>

            </div>
        `).join("");
}

async function searchUsers() {
    const input =
        $("userSearch");

    if (!input) return;

    const q =
        input.value.trim();

    if (!q) {
        return showToast(
            "Írj be egy nevet vagy felhasználónevet!",
            "error"
        );
    }

    try {
        const data =
            await api(
                `/api/users?q=${encodeURIComponent(q)}`
            );

        state.searchUsers =
            data.users || [];

        renderSearchUsers();
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

function renderSearchUsers() {
    const box =
        $("userSearchResults");

    if (!box) return;

    if (!state.searchUsers.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔎</div>
                <p>Nem található felhasználó.</p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.searchUsers.map(user => `
            <div class="user-search-card">

                <div class="friend-avatar">
                    ${
                        user.avatar
                            ? `<img src="${escapeHTML(user.avatar)}">`
                            : escapeHTML(
                                (
                                    user.name ||
                                    user.username ||
                                    "?"
                                )
                                    .charAt(0)
                                    .toUpperCase()
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
                </div>

                <button
                    type="button"
                    class="primary-button"
                    data-request-id="${user.id}">
                    👥 Barát hozzáadása
                </button>

            </div>
        `).join("");
}

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
            "Barátkérelem elküldve! 📩",
            "success"
        );

        searchUsers();
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

async function acceptFriend(userId) {
    try {
        await api(
            `/api/friends/${userId}/accept`,
            {
                method: "POST"
            }
        );

        showToast(
            "Barátkérelem elfogadva! 🎉",
            "success"
        );

        await loadFriends();
        await loadRequests();
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

async function rejectFriend(userId) {
    try {
        await api(
            `/api/friends/${userId}/reject`,
            {
                method: "POST"
            }
        );

        showToast(
            "Barátkérelem elutasítva.",
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
   CHAT
============================================================ */

async function openChat(friendId) {
    const friend =
        state.friends.find(
            f =>
                Number(f.id) ===
                Number(friendId)
        );

    if (!friend) return;

    state.currentFriend =
        friend;

    const modal =
        $("chatModal");

    if (modal) {
        openModal("chatModal");
    }

    if ($("chatFriendName")) {
        $("chatFriendName").textContent =
            friend.name;
    }

    if ($("chatFriendUsername")) {
        $("chatFriendUsername").textContent =
            `@${friend.username}`;
    }

    await loadMessages();

    const input =
        $("chatInput");

    if (input) {
        setTimeout(
            () => input.focus(),
            100
        );
    }
}

async function loadMessages() {
    if (!state.currentFriend) {
        return;
    }

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

function renderMessages() {
    const box =
        $("chatMessages");

    if (!box) return;

    if (!state.currentMessages.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <h3>Még nincs üzenet</h3>
                <p>
                    Kezdd el a beszélgetést!
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.currentMessages.map(message => {
            const own =
                Number(message.sender) ===
                Number(state.user?.id);

            const isMaterial =
                message.type ===
                "material" &&
                message.materialId;

            return `
                <div class="chat-message ${
                    own ? "own" : "other"
                }">

                    <div class="message-bubble">

                        ${
                            isMaterial
                                ? `
                                    <div class="material-message">

                                        <div class="material-message-icon">
                                            📚
                                        </div>

                                        <div class="material-message-info">
                                            <strong>
                                                ${escapeHTML(message.message)}
                                            </strong>

                                            <span>
                                                Tananyag
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            class="primary-button"
                                            data-material-id="${message.materialId}">
                                            📖 Megnyitás
                                        </button>

                                    </div>
                                `
                                : `
                                    <div class="message-text">
                                        ${escapeHTML(message.message)}
                                    </div>
                                `
                        }

                        <small>
                            ${escapeHTML(
                                formatDate(message.date)
                            )}
                        </small>

                    </div>

                </div>
            `;
        }).join("");

    box.scrollTop =
        box.scrollHeight;
}

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

    input.disabled = true;

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
    } finally {
        input.disabled = false;
        input.focus();
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
    } catch (error) {
        console.error(error);
    }
}

function renderMaterials() {
    const box =
        $("materialsList");

    if (!box) return;

    let materials =
        [...state.materials];

    const search =
        $("materialSearch")
            ?.value
            .trim()
            .toLowerCase() || "";

    const filter =
        $("materialTypeFilter")
            ?.value || "";

    if (search) {
        materials =
            materials.filter(
                material =>
                    String(
                        material.title
                    )
                        .toLowerCase()
                        .includes(search) ||
                    String(
                        material.subject
                    )
                        .toLowerCase()
                        .includes(search) ||
                    String(
                        material.content
                    )
                        .toLowerCase()
                        .includes(search)
            );
    }

    if (filter) {
        materials =
            materials.filter(
                material =>
                    material.type ===
                    filter
            );
    }

    if (!materials.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>Nincs tananyag</h3>
                <p>
                    Készíts egyet az AI segítségével.
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        materials.map(material => `
            <div
                class="material-card"
                data-material-id="${material.id}">

                <div class="material-icon">
                    ${
                        material.type === "test"
                            ? "📝"
                            : material.type === "homework"
                                ? "✏️"
                                : "📚"
                    }
                </div>

                <div class="material-info">

                    <span class="material-subject">
                        ${escapeHTML(
                            material.subject
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(
                            material.title
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            String(
                                material.content
                            ).slice(0, 150)
                        )}
                        ${
                            String(
                                material.content
                            ).length > 150
                                ? "..."
                                : ""
                        }
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
                    class="primary-button"
                    data-material-id="${material.id}">
                    📖 Megnyitás
                </button>

            </div>
        `).join("");
}

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

        showMaterialModal(
            material
        );
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

function showMaterialModal(material) {
    let modal =
        $("materialViewerModal");

    if (!modal) {
        modal =
            document.createElement("div");

        modal.id =
            "materialViewerModal";

        modal.className =
            "modal-overlay hidden";

        document.body.appendChild(
            modal
        );
    }

    const typeName =
        material.type === "test"
            ? "📝 Teszt"
            : material.type === "homework"
                ? "✏️ Házi feladat"
                : "📚 Tananyag";

    modal.innerHTML = `
        <div class="modal-card material-viewer-card">

            <button
                type="button"
                class="modal-close"
                data-close-material-viewer>
                ✕
            </button>

            <div class="material-viewer-header">

                <span>
                    ${typeName}
                </span>

                <h2>
                    ${escapeHTML(
                        material.title
                    )}
                </h2>

                <p>
                    ${escapeHTML(
                        material.subject
                    )}
                </p>

            </div>

            <div class="material-viewer-content">
                ${escapeHTML(
                    material.content
                )
                    .replaceAll(
                        "\n",
                        "<br>"
                    )}
            </div>

            <div class="material-viewer-footer">

                <small>
                    Készítette:
                    ${
                        Number(material.creator) ===
                        Number(state.user?.id)
                            ? "Te"
                            : "barát"
                    }
                </small>

                <button
                    type="button"
                    class="primary-button"
                    data-close-material-viewer>
                    Bezárás
                </button>

            </div>

        </div>
    `;

    modal.classList.remove(
        "hidden"
    );

    modal.classList.add(
        "active"
    );

    modal.style.display =
        "flex";
}

/* ============================================================
   AI
============================================================ */

function openAIModal() {
    state.generatedAI = null;

    if ($("aiSubject")) {
        $("aiSubject").value = "";
    }

    if ($("aiTopic")) {
        $("aiTopic").value = "";
    }

    if ($("aiPreview")) {
        $("aiPreview").innerHTML = "";
    }

    document
        .querySelectorAll("[data-ai-type]")
        .forEach(button => {
            button.classList.toggle(
                "active",
                (
                    button.dataset.aiType ||
                    "material"
                ) === state.aiType
            );
        });

    openModal("aiModal");
}

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

    try {
        const data =
            await api(
                "/api/ai/generate",
                {
                    method: "POST",
                    body: JSON.stringify({
                        subject,
                        topic,
                        type:
                            state.aiType
                    })
                }
            );

        state.generatedAI =
            data;

        showAIPreview(data);
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
    }
}

function showAIPreview(data) {
    const box =
        $("aiPreview");

    if (box) {
        box.innerHTML = `
            <div class="ai-result">

                <div class="ai-result-type">
                    ${
                        data.type === "test"
                            ? "📝 TESZT"
                            : data.type === "homework"
                                ? "✏️ HÁZI FELADAT"
                                : "📚 TANANYAG"
                    }
                </div>

                <h2>
                    ${escapeHTML(
                        data.title
                    )}
                </h2>

                <h3>
                    📖 Magyarázat
                </h3>

                <p>
                    ${escapeHTML(
                        data.explanation
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

                <h3>
                    ⭐ Fontos
                </h3>

                <p>
                    ${escapeHTML(
                        data.important
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

                <h3>
                    💡 Példák
                </h3>

                <p>
                    ${escapeHTML(
                        data.examples
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

                <h3>
                    📌 Összefoglaló
                </h3>

                <p>
                    ${escapeHTML(
                        data.summary
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

            </div>
        `;
    }

    closeModal("aiModal");

    openModal("previewModal");

    if ($("previewContent")) {
        $("previewContent").innerHTML =
            `
            <div class="ai-result">

                <div class="ai-result-type">
                    ${
                        data.type === "test"
                            ? "📝 TESZT"
                            : data.type === "homework"
                                ? "✏️ HÁZI FELADAT"
                                : "📚 TANANYAG"
                    }
                </div>

                <h2>
                    ${escapeHTML(
                        data.title
                    )}
                </h2>

                <h3>📖 Magyarázat</h3>
                <p>
                    ${escapeHTML(
                        data.explanation
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

                <h3>⭐ Fontos</h3>
                <p>
                    ${escapeHTML(
                        data.important
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

                <h3>💡 Példák</h3>
                <p>
                    ${escapeHTML(
                        data.examples
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

                <h3>📌 Összefoglaló</h3>
                <p>
                    ${escapeHTML(
                        data.summary
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

            </div>
            `;
    }

    renderSendFriendList();
}

function renderSendFriendList() {
    const box =
        $("sendFriendList");

    if (!box) return;

    if (!state.friends.length) {
        box.innerHTML = `
            <div class="empty-state compact-empty">
                <p>
                    Először szerezz egy barátot,
                    akinek elküldheted.
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.friends.map(friend => `
            <button
                type="button"
                class="send-friend-option ${
                    Number(
                        state.selectedSendFriendId
                    ) === Number(friend.id)
                        ? "selected"
                        : ""
                }"
                data-send-friend-id="${friend.id}">

                <span>
                    ${
                        friend.avatar
                            ? `<img src="${escapeHTML(friend.avatar)}">`
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

                <strong>
                    ${escapeHTML(
                        friend.name
                    )}
                </strong>

                ${
                    Number(
                        state.selectedSendFriendId
                    ) === Number(friend.id)
                        ? "✓"
                        : ""
                }

            </button>
        `).join("");
}

function sendGeneratedMaterial(friendId) {
    state.selectedSendFriendId =
        Number(friendId);

    renderSendFriendList();

    approveAndSendAI();
}

async function approveAndSendAI() {
    if (!state.generatedAI) {
        return showToast(
            "Nincs elkészített tananyag.",
            "error"
        );
    }

    if (!state.selectedSendFriendId) {
        return showToast(
            "Válaszd ki, kinek szeretnéd elküldeni!",
            "error"
        );
    }

    const data =
        state.generatedAI;

    const button =
        $("approveSendButton");

    if (button) {
        button.disabled = true;
        button.textContent =
            "⏳ Küldés...";
    }

    try {
        await api(
            "/api/materials",
            {
                method: "POST",
                body: JSON.stringify({
                    subject:
                        data.subject,
                    title:
                        data.title,
                    content:
                        data.content,
                    type:
                        data.type,
                    friendId:
                        state.selectedSendFriendId
                })
            }
        );

        await loadMaterials();

        showToast(
            "A tananyag elküldve! 📚",
            "success"
        );

        closeModal("previewModal");

        state.generatedAI = null;
        state.selectedSendFriendId =
            null;

        if (
            state.currentFriend &&
            Number(
                state.currentFriend.id
            ) === Number(
                data.friendId
            )
        ) {
            await loadMessages();
        }
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                "📤 Jóváhagyás és küldés";
        }
    }
}

/* ============================================================
   ÉRTÉKELÉS
============================================================ */

function openRating(userId, name) {
    state.ratingTargetId =
        Number(userId);

    state.ratingValue = 0;

    if ($("ratingFriendName")) {
        $("ratingFriendName").textContent =
            name;
    }

    updateRatingStars();

    openModal("ratingModal");
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
}

async function submitRating() {
    if (!state.ratingTargetId) {
        return;
    }

    if (!state.ratingValue) {
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
            "Értékelés mentve! ⭐",
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
   JEGY
============================================================ */

function openGrade(userId, name) {
    state.gradeTargetId =
        Number(userId);

    state.gradeValue = 0;

    if ($("gradeFriendName")) {
        $("gradeFriendName").textContent =
            name;
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
            "Nincs kiválasztva";
    }

    if ($("submitGradeButton")) {
        $("submitGradeButton").disabled =
            true;
    }

    openModal("gradeModal");
}

async function submitGrade() {
    if (!state.gradeTargetId) {
        return;
    }

    if (!state.gradeValue) {
        return showToast(
            "Válassz jegyet!",
            "error"
        );
    }

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

        if ($("gradeSubject")) {
            $("gradeSubject").value =
                "";
        }
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

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

function renderGrades() {
    const box =
        $("gradesList");

    if (!box) return;

    if (!state.grades.length) {
        box.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>Még nincs jegyed</h3>
                <p>
                    A barátaidtól kapott jegyek itt jelennek meg.
                </p>
            </div>
        `;

        return;
    }

    box.innerHTML =
        state.grades.map(grade => `
            <div class="grade-card">

                <div class="grade-value">
                    ${escapeHTML(
                        grade.grade
                    )}
                </div>

                <div class="grade-info">

                    <strong>
                        ${escapeHTML(
                            grade.subject
                        )}
                    </strong>

                    <span>
                        Adta:
                        ${escapeHTML(
                            grade.giverName
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

            </div>
        `).join("");
}

/* ============================================================
   PROFIL SZERKESZTÉS
============================================================ */

function ensureProfileEditButton() {
    if (!$("profilePage") &&
        !$("page-profile")) {
        return;
    }

    if ($("editProfileButton")) {
        return;
    }

    const profile =
        $("page-profile") ||
        $("profilePage");

    if (!profile) return;

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

    const header =
        profile.querySelector(
            ".page-header"
        ) ||
        profile.firstElementChild;

    if (header) {
        header.appendChild(
            button
        );
    } else {
        profile.prepend(
            button
        );
    }
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
        <div class="modal-card profile-editor-card">

            <button
                type="button"
                class="modal-close"
                data-close-modal="profileEditModal">
                ✕
            </button>

            <h2>
                ✏️ Profil szerkesztése
            </h2>

            <div
                id="profileEditMessage"
                style="display:none;">
            </div>

            <div class="profile-edit-avatar">

                <img
                    id="editProfileAvatarPreview"
                    alt="Profilkép"
                    style="
                        width:100px;
                        height:100px;
                        border-radius:50%;
                        object-fit:cover;
                    ">

                <label
                    class="secondary-button"
                    for="editProfileAvatar">
                    🖼️ Profilkép választása
                </label>

                <input
                    id="editProfileAvatar"
                    type="file"
                    accept="image/*"
                    style="display:none;">

                <small
                    id="editProfileAvatarName">
                </small>

            </div>

            <label>
                Név
                <input
                    id="editProfileName"
                    type="text">
            </label>

            <label>
                Felhasználónév
                <input
                    id="editProfileUsername"
                    type="text">
            </label>

            <label>
                E-mail
                <input
                    id="editProfileEmail"
                    type="email">
            </label>

            <label>
                Évfolyam
                <select
                    id="editProfileGrade">

                    <option value="5">5. osztály</option>
                    <option value="6">6. osztály</option>
                    <option value="7">7. osztály</option>
                    <option value="8">8. osztály</option>
                    <option value="9">9. osztály</option>
                    <option value="10">10. osztály</option>
                    <option value="11">11. osztály</option>
                    <option value="12">12. osztály</option>

                </select>
            </label>

            <label>
                Új jelszó
                <input
                    id="editProfilePassword"
                    type="password"
                    placeholder="Üresen hagyva nem változik">
            </label>

            <div class="modal-actions">

                <button
                    type="button"
                    class="secondary-button"
                    data-close-modal="profileEditModal">
                    Mégse
                </button>

                <button
                    type="button"
                    id="saveProfileButton"
                    class="primary-button">
                    💾 Mentés
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

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

function openProfileEditor() {
    if (!state.user) return;

    profileEditorHTML();

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
            state.user.grade || 5;
    }

    if ($("editProfilePassword")) {
        $("editProfilePassword").value =
            "";
    }

    window.__tbSelectedAvatar =
        null;

    if ($("editProfileAvatarPreview")) {
        if (state.user.avatar) {
            $("editProfileAvatarPreview")
                .src =
                state.user.avatar;
        } else {
            $("editProfileAvatarPreview")
                .removeAttribute("src");
        }
    }

    clearProfileMessage();

    openModal(
        "profileEditModal"
    );
}

function closeProfileEditor() {
    closeModal(
        "profileEditModal"
    );
}

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

    box.style.padding =
        "10px";

    box.style.borderRadius =
        "8px";

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

function clearProfileMessage() {
    const box =
        $("profileEditMessage");

    if (!box) return;

    box.textContent =
        "";

    box.style.display =
        "none";
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
                    const img =
                        new Image();

                    img.onerror =
                        reject;

                    img.onload =
                        () => {
                            const max =
                                512;

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

                            const ctx =
                                canvas.getContext(
                                    "2d"
                                );

                            ctx.drawImage(
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

        if ($("editProfileAvatarPreview")) {
            $("editProfileAvatarPreview")
                .src = data;
        }

        if ($("editProfileAvatarName")) {
            $("editProfileAvatarName")
                .textContent =
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
                        JSON.stringify(
                            body
                        )
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
            closeProfileEditor,
            700
        );
    } catch (error) {
        console.error(error);

        showProfileMessage(
            error.message ||
            "Nem sikerült menteni a profilt."
        );
    } finally {
        if (button) {
            button.disabled =
                false;

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

    setLoading(false);
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

    /* REGISTER */

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

    /* AUTH TABS */

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
                    $("loginForm")
                        .style.display = "";
                }

                if ($("registerForm")) {
                    $("registerForm")
                        .style.display =
                        "none";
                }
            }
        );

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
                    $("registerForm")
                        .style.display = "";
                }

                if ($("loginForm")) {
                    $("loginForm")
                        .style.display =
                        "none";
                }
            }
        );

    /* PASSWORD SHOW/HIDE */

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

    /* USER SEARCH */

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

    /* MATERIAL SEARCH */

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

    /* CHAT */

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

    /* AI BUTTONS */

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

                state.selectedSendFriendId =
                    null;
            }
        );

    /* AI TYPE */

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
                        .forEach(
                            b => {
                                b.classList.toggle(
                                    "active",
                                    b ===
                                    button
                                );
                            }
                        );
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
                            button.dataset
                                .rating
                        );

                    updateRatingStars();
                }
            );
        });

    /* GRADE */

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
                            button.dataset
                                .grade
                        );

                    document
                        .querySelectorAll(
                            "#gradeOptions button"
                        )
                        .forEach(
                            b => {
                                b.classList.toggle(
                                    "selected",
                                    b ===
                                    button
                                );
                            }
                        );

                    if ($("selectedGrade")) {
                        $("selectedGrade")
                            .textContent =
                            `${state.gradeValue} / 5`;
                    }

                    if (
                        $("submitGradeButton")
                    ) {
                        $("submitGradeButton")
                            .disabled =
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

            /* NAVIGATION */

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
                        chat.dataset
                            .chatId
                    )
                );
            }

            /* RATING */

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
                                rate.dataset
                                    .rateId
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

            /* GRADE */

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
                                grade.dataset
                                    .gradeId
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

            /* ACCEPT */

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

            /* REJECT */

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

            /* REQUEST */

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

            /* MATERIAL */

            const material =
                event.target.closest(
                    "[data-material-id]"
                );

            if (
                material &&
                !event.target.closest(
                    "[data-send-friend-id]"
                )
            ) {
                return openMaterial(
                    Number(
                        material.dataset
                            .materialId
                    )
                );
            }

            /* SEND FRIEND */

            const sendFriend =
                event.target.closest(
                    "[data-send-friend-id]"
                );

            if (sendFriend) {
                state.selectedSendFriendId =
                    Number(
                        sendFriend.dataset
                            .sendFriendId
                    );

                renderSendFriendList();

                return;
            }

            /* AI */

            const ai =
                event.target.closest(
                    "[data-open-ai]"
                );

            if (ai) {
                return openAIModal();
            }

            /* CLOSE NORMAL MODAL */

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

            /* MATERIAL VIEWER */

            const closeMaterial =
                event.target.closest(
                    "[data-close-material-viewer]"
                );

            if (closeMaterial) {
                return closeModal(
                    "materialViewerModal"
                );
            }

            /* MODAL BACKGROUND */

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

    /* MOBILE MENU */

    $("mobileMenuButton")
        ?.addEventListener(
            "click",
            () => {
                $("sidebar")
                    ?.classList
                    .toggle("open");
            }
        );

    /* THEME */

    $("themeToggle")
        ?.addEventListener(
            "click",
            () => {
                document.body.classList
                    .toggle(
                        "light-theme"
                    );
            }
        );

    /* NOTIFICATIONS */

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

    /* ESCAPE */

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
                    .forEach(
                        modal =>
                            closeModal(
                                modal.id
                            )
                    );
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

        showAuth();

        await checkLogin();
    }
);