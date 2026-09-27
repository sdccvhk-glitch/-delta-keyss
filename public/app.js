let token = localStorage.getItem("wfn_token");
let me = null;

const $ = id => document.getElementById(id);

async function api(url, opt = {}) {
  opt.headers = {
    ...(opt.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {})
  };

  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(d.error || "Request failed");
  }

  return d;
}

function toast(msg) {
  $("toast").textContent = msg;
  $("toast").className = "show";

  setTimeout(() => {
    $("toast").className = "";
  }, 2400);
}

function showPanel() {
  $("auth").classList.add("hidden");
  $("panel").classList.remove("hidden");
  $("logout").classList.remove("hidden");

  $("who").textContent =
    me.username + " • " + me.role.toUpperCase();

  document
    .querySelectorAll("#usersNav,#settingsNav,.ownerOnly")
    .forEach(x => {
      if (x.id === "usersNav") {
        x.classList.toggle(
          "hidden",
          !["owner", "admin"].includes(me.role)
        );
      } else if (
        x.id === "settingsNav" ||
        x.classList.contains("ownerOnly")
      ) {
        x.classList.toggle("hidden", me.role !== "owner");
      }
    });

  loadAll();
}

async function loadAll() {
  try {
    const d = await api("/api/me");
    me = d.user;

    $("who").textContent =
      me.username + " • " + me.role.toUpperCase();

    $("stBalance").textContent =
      "₹" + Number(me.balance).toFixed(2);

    $("accountInfo").innerHTML = `
      <p><b>${me.username}</b></p>
      <p class="muted">Role: ${me.role}</p>
      <p class="muted">Balance: ₹${Number(me.balance).toFixed(2)}</p>
      <p class="muted">Referral: ${me.referral_code || "—"}</p>
    `;

    await loadLicenses();
    await loadRefs();

    if (["owner", "admin"].includes(me.role)) {
      await loadUsers();
    }

    if (me.role === "owner") {
      await loadSettings();
    }

  } catch (e) {
    toast(e.message);
  }
}

function go(page) {
  document
    .querySelectorAll(".page")
    .forEach(x => x.classList.add("hidden"));

  $(page).classList.remove("hidden");

  document
    .querySelectorAll(".nav")
    .forEach(x =>
      x.classList.toggle(
        "active",
        x.dataset.page === page
      )
    );

  $("pageTitle").textContent =
    page[0].toUpperCase() + page.slice(1);

  if (
    page === "users" &&
    ["owner", "admin"].includes(me.role)
  ) {
    loadUsers();
  }

  if (page === "licenses") {
    loadLicenses();
  }

  if (page === "referrals") {
    loadRefs();
  }
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-page]");
  if (b) {
    go(b.dataset.page);
  }
});

document.querySelectorAll(".tab").forEach(b => {
  b.onclick = () => {
    document
      .querySelectorAll(".tab")
      .forEach(x => x.classList.remove("active"));

    b.classList.add("active");

    $("loginBox").classList.toggle(
      "hidden",
      b.dataset.tab !== "login"
    );

    $("registerBox").classList.toggle(
      "hidden",
      b.dataset.tab !== "register"
    );
  };
});


/* =========================
   LOGIN
========================= */

$("loginBtn").onclick = async () => {
  try {
    const d = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("loginUser").value,
        password: $("loginPass").value
      })
    });

    token = d.token;

    localStorage.setItem("wfn_token", token);

    me = d.user;

    showPanel();

  } catch (e) {
    toast(e.message);
  }
};


/* =========================
   REGISTER
========================= */

$("regBtn").onclick = async () => {
  try {
    const d = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: $("regUser").value,
        password: $("regPass").value,
        referral_code: $("regRef").value
      })
    });

    token = d.token;

    localStorage.setItem("wfn_token", token);

    me = d.user;

    toast("Account created successfully");

    showPanel();

  } catch (e) {
    toast(e.message);
  }
};


/* =========================
   LOGOUT
========================= */

$("logout").onclick = () => {
  localStorage.removeItem("wfn_token");
  token = null;
  me = null;
  location.reload();
};


/* =========================
   LICENSES
========================= */

async function loadLicenses() {
  if (!token) return;

  try {
    const d = await api("/api/licenses");

    const ls = d.licenses || d;

    $("licenseRows").innerHTML = ls.map(l => `
      <tr>
        <td><b>${l.license_key}</b></td>
        <td>${l.license_type}</td>
        <td>₹${Number(l.price).toFixed(2)}</td>
        <td class="${l.status}">${l.status}</td>
        <td>${l.device_id || "Unbound"}</td>
        <td>${new Date(l.expires_at).toLocaleString()}</td>
        <td>
          <button onclick="extendKey(${l.id})">+30d</button>
          <button onclick="resetDevice(${l.id})">Reset</button>
          <button onclick="deleteKey(${l.id})">Delete</button>
        </td>
      </tr>
    `).join("");

    $("stLicenses").textContent = ls.length;

    $("stActive").textContent =
      ls.filter(x => x.status === "active").length;

  } catch (e) {
    toast(e.message);
  }
}

window.extendKey = async id => {
  try {
    await api("/api/licenses/" + id + "/extend", {
      method: "POST",
      body: JSON.stringify({ days: 30 })
    });

    loadLicenses();
    toast("License extended");

  } catch (e) {
    toast(e.message);
  }
};

window.resetDevice = async id => {
  try {
    await api("/api/licenses/" + id + "/reset-device", {
      method: "POST"
    });

    loadLicenses();
    toast("Device reset");

  } catch (e) {
    toast(e.message);
  }
};

window.deleteKey = async id => {
  if (!confirm("Delete this key?")) return;

  try {
    await api("/api/licenses/" + id, {
      method: "DELETE"
    });

    loadLicenses();
    toast("Key deleted");

  } catch (e) {
    toast(e.message);
  }
};

$("refreshLicenses").onclick = loadLicenses;


/* =========================
   GENERATE KEYS
========================= */

$("generateBtn").onclick = async () => {
  try {
    const d = await api("/api/licenses/generate", {
      method: "POST",
      body: JSON.stringify({
        custom: $("customKey").value,
        count: Number($("keyCount").value),
        days: Number($("keyDays").value),
        license_type: $("keyType").value,
        price: Number($("keyPrice").value)
      })
    });

    const licenses = d.licenses || [];

    $("generated").textContent =
      licenses.map(x => x.license_key).join("\n");

    $("customKey").value = "";

    await loadLicenses();

    toast(licenses.length + " key(s) generated");

  } catch (e) {
    toast(e.message);
  }
};


/* =========================
   BULK LICENSE CONTROLS
========================= */

$("extendAll").onclick = async () => {
  try {
    const d = await api("/api/licenses/extend-all", {
      method: "POST",
      body: JSON.stringify({
        days: Number($("extendAllDays").value)
      })
    });

    loadLicenses();

    toast("Extended " + d.count + " keys");

  } catch (e) {
    toast(e.message);
  }
};

$("resetAll").onclick = async () => {
  if (!confirm("Reset all device bindings?")) return;

  try {
    await api("/api/licenses/reset-all", {
      method: "POST"
    });

    loadLicenses();

    toast("All devices reset");

  } catch (e) {
    toast(e.message);
  }
};

$("deleteAll").onclick = async () => {
  if (!confirm("Delete ALL keys permanently?")) return;

  try {
    await api("/api/licenses/all", {
      method: "DELETE"
    });

    loadLicenses();

    toast("All keys deleted");

  } catch (e) {
    toast(e.message);
  }
};


/* =========================
   USERS
========================= */

async function loadUsers() {
  try {
    const d = await api("/api/admin/users");

    const us = d.users || d;

    $("userRows").innerHTML = us.map(u => `
      <tr>
        <td>
          ${u.username}
          <small>#${u.id}</small>
        </td>

        <td>${u.role}</td>

        <td>
          ₹${Number(u.balance).toFixed(2)}
        </td>

        <td>
          ${u.referral_code || "—"}
        </td>

        <td>
          <button onclick="changeRole(${u.id},'admin')">
            Admin
          </button>

          <button onclick="changeRole(${u.id},'reseller')">
            Reseller
          </button>

          <button
            onclick="deleteUser(${u.id})"
            class="danger">
            Delete
          </button>
        </td>
      </tr>
    `).join("");

    $("stUsers").textContent = us.length;

  } catch (e) {
    toast(e.message);
  }
}

window.changeRole = async (id, role) => {
  try {
    await api("/api/users/" + id + "/role", {
      method: "POST",
      body: JSON.stringify({ role })
    });

    loadUsers();

    toast("Role updated");

  } catch (e) {
    toast(e.message);
  }
};

window.deleteUser = async id => {
  if (!confirm("Delete this user?")) return;

  try {
    await api("/api/users/" + id, {
      method: "DELETE"
    });

    loadUsers();

    toast("User deleted");

  } catch (e) {
    toast(e.message);
  }
};

$("refreshUsers").onclick = loadUsers;


/* =========================
   BALANCE
========================= */

$("balBtn").onclick = async () => {
  try {
    await api(
      "/api/admin/users/" +
      $("balUser").value +
      "/balance",
      {
        method: "POST",
        body: JSON.stringify({
          amount: Number($("balAmount").value),
          note: $("balNote").value
        })
      }
    );

    toast("Balance updated");

    loadUsers();

  } catch (e) {
    toast(e.message);
  }
};


/* =========================
   REFERRALS
========================= */

async function loadRefs() {
  try {
    const d = await api("/api/referrals");

    $("refCode").textContent =
      d.code || me.referral_code || "—";

    $("refReward").textContent =
      "₹" + Number(d.reward || 0).toFixed(2);

    const items = d.items || [];

    $("refRows").innerHTML = items.map(x => `
      <tr>
        <td>${x.referred_username}</td>
        <td>₹${Number(x.reward).toFixed(2)}</td>
        <td>${new Date(x.created_at).toLocaleString()}</td>
      </tr>
    `).join("");

  } catch (e) {
    toast(e.message);
  }
}


/* =========================
   PROFILE
========================= */

$("usernameBtn").onclick = async () => {
  try {
    await api("/api/profile/username", {
      method: "POST",
      body: JSON.stringify({
        username: $("newUsername").value
      })
    });

    toast("Username changed");

    loadAll();

  } catch (e) {
    toast(e.message);
  }
};

$("passwordBtn").onclick = async () => {
  try {
    await api("/api/profile/password", {
      method: "POST",
      body: JSON.stringify({
        password: $("newPassword").value
      })
    });

    toast("Password changed");

  } catch (e) {
    toast(e.message);
  }
};


/* =========================
   SETTINGS
========================= */

async function loadSettings() {
  try {
    const s = await api("/api/settings");

    $("setPanel").value = s.panel_name || "";
    $("setLicense").value = s.license_name || "";
    $("setPrice").value = s.license_price || 0;
    $("setReward").value = s.referral_reward || 0;

  } catch (e) {
    toast(e.message);
  }
}

$("saveSettings").onclick = async () => {
  try {
    await api("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        panel_name: $("setPanel").value,
        license_name: $("setLicense").value,
        license_price: Number($("setPrice").value),
        referral_reward: Number($("setReward").value)
      })
    });

    toast("Settings saved");

  } catch (e) {
    toast(e.message);
  }
};


/* =========================
   EXISTING SESSION
========================= */

if (token) {
  api("/api/me")
    .then(d => {
      me = d.user;
      showPanel();
    })
    .catch(() => {
      localStorage.removeItem("wfn_token");
      token = null;
      me = null;
    });
}
