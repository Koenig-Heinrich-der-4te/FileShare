const userList = document.getElementById("user-list-items");

async function updateUsers(users) {
    const userdata = await fetch("list")
        .then((res) => res.json())
        .catch((err) => console.error(err));
    if (!userdata) {
        // whatever
        return;
    }
    console.log(userdata);
    userList.textContent = "";
    userdata.forEach((user) => {
        const entry = document.createElement("tr");
        entry.innerHTML = `
        <td>${user.name}</td>
        <td>${user.fileCount}</td>
        <td>${filesizeToString(user.used)}</td>
        <td>${filesizeToString(user.storage)}</td>
        `;
        entry.addEventListener("click", () => {
            selectedUser = user;
            userOptionsName.textContent = user.name;
            userOptionsAllocated.value = filesizeToString(user.storage);
            userOptionsDialog.showModal();
        });
        userList.appendChild(entry);
    });
}

let selectedUser = null;
const userOptionsDialog = document.getElementById("user-options-dialog");
const userOptionsName = document.getElementById("user-options-name");
const userOptionsAllocated = document.getElementById("user-options-allocated");
userOptionsAllocated.addEventListener("change", async () => {
    const newValue = stringToFilesize(userOptionsAllocated.value);
    await fetch(`set-allocated-storage/${selectedUser.name}/${newValue}`);
    await updateUsers();
});
const userOptionsDelete = document.getElementById("user-options-delete");
userOptionsDelete.addEventListener("click", async () => {
    confimDeleteName.textContent = selectedUser.name;
    confirmDeleteDialog.showModal();
});
const confirmDeleteDialog = document.getElementById("confirm-delete-dialog");
const confimDeleteName = document.getElementById("confirm-delete-name");
const confirmDeleteYes = document.getElementById("confirm-delete-yes");
confirmDeleteYes.addEventListener("click", async () => {
    await fetch(`delete/${selectedUser.name}`);
    confirmDeleteDialog.close();
    userOptionsDialog.close();
    await updateUsers();
});
const userOptionsResetPassword = document.getElementById("user-options-reset-password");

const copyResetPasswordDialog = document.getElementById("copy-reset-password-link-dialog");
const resetPasswordLink = document.getElementById("reset-link-display");
const copyResetPasswordLink = document.getElementById("reset-link-copy");
userOptionsResetPassword.addEventListener("click", async () => {
    const data = new FormData();
    data.append("username", selectedUser.name);
    const res = await fetch("create-reset-password-link", { method: "POST", body: data });
    if (!res.ok) {
        return;
    }
    const link = await res.text();
    resetPasswordLink.textContent = window.location.origin + link;
    copyResetPasswordDialog.showModal();
});
copyResetPasswordLink.addEventListener("click", () => {
    navigator.clipboard.writeText(resetPasswordLink.textContent);
    if (!copyResetPasswordLink.classList.contains("copied")) setTimeout(() => copyResetPasswordLink.classList.remove("copied"), 800);
    copyResetPasswordLink.classList.add("copied");
});

const createRegisterLinkDialog = document.getElementById("create-register-link-dialog");
const createRegisterLinkButton = document.getElementById("register-link-create");
const createRegisterAllocated = document.getElementById("register-link-allocated");
const registerLinkSection = document.getElementById("register-link-section");
const registerLink = document.getElementById("register-link-display");
const registerLinkCopy = document.getElementById("register-link-copy");
createRegisterLinkButton.addEventListener("click", async () => {
    const form = new FormData();
    form.append("storage", stringToFilesize(createRegisterAllocated.value));
    const res = await fetch(`create-register-link`, { method: "POST", body: form });
    if (!res.ok) {
        return;
    }
    const link = await res.text();
    registerLink.textContent = window.location.origin + link;
    registerLinkSection.hidden = false;
});

registerLinkCopy.addEventListener("click", () => {
    navigator.clipboard.writeText(registerLink.textContent);
    if (!registerLinkCopy.classList.contains("copied")) setTimeout(() => registerLinkCopy.classList.remove("copied"), 800);
    registerLinkCopy.classList.add("copied");
});

const postFixes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

function filesizeToString(size) {
    let i = 0;
    while (size > 1000 && i < postFixes.length - 1) {
        size /= 1000;
        i++;
    }
    return `${size.toFixed(1)} ${postFixes[i]}`;
}

function stringToFilesize(str) {
    str = str.toUpperCase();
    const num = parseFloat(str);
    for (let i = postFixes.length - 1; i >= 0; i--) {
        if (str.endsWith(postFixes[i])) {
            return num * Math.pow(1000, i);
        }
    }
    return num;
}

updateUsers();
