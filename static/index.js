// upload
const uploadDialog = document.getElementById("upload");
// uploadDialog.showModal();
const selectFileButton = document.getElementById("select-file-button");
const fileupload = document.getElementById("fileupload");
let uploading = null;
fileupload.addEventListener("change", () => {
    let filename = fileupload.files[0].name;
    selectFileButton.textContent = truncateFilename(filename, 40);
    selectFileButton.title = filename;
});
const uploadSubmitButton = document.getElementById("upload-submit-button");
const uploadOptionsSection = document.getElementById("upload-options-section-container");
const uploadProgressInfoDiv = document.getElementById("progress-info");
const uploadProgress = document.getElementById("upload-progress");
const uploadProgressText = document.getElementById("upload-progress-text");
const uploadOptionsPublic = document.getElementById("upload-options-public-checkbox");
uploadSubmitButton.addEventListener("click", async function uploadFile(event) {
    // event.preventDefault();

    if (uploading) {
        uploading.abort();
        return;
    }

    const file = fileupload.files[0];
    if (!file) {
        selectFileButton.focus();
        return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("public", uploadOptionsPublic.checked);
    const request = new XMLHttpRequest();
    request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            uploadProgress.value = percent;
            uploadProgressText.textContent = percent + "%";
        }
    });
    uploadProgressInfoDiv.hidden = false;
    uploadOptionsSection.hidden = true;
    fileupload.disabled = true;

    function onClose() {
        uploading = null;
        uploadProgress.value = 0;
        uploadProgressText.textContent = "0%";
        uploadProgressInfoDiv.hidden = true;
        uploadOptionsSection.hidden = false;
        fileupload.disabled = false;
    }

    request.addEventListener("readystatechange", () => {
        if (request.readyState === 4) {
            uploadDialog.close();
            hydateFileList();
            onClose();
        }
    });

    request.addEventListener("error", () => {
        alert("Error uploading file");
        uploadDialog.close();
        onClose();
    });

    request.addEventListener("abort", onClose);

    request.open("POST", "upload");
    request.send(formData);
    uploading = request;
});

const cancelUploadButton = document.getElementById("cancel-upload-button");
cancelUploadButton.addEventListener("click", () => {
    uploading.abort();
});

// render file list
const fileList = document.getElementById("file-list-items");
const fileError = document.getElementById("file-error");
const fileActions = document.getElementById("file-actions");
const fileActionsFilename = document.getElementById("file-actions-filename");
const fileActionsSize = document.getElementById("file-info-size");
const fileActionsUploadedDate = document.getElementById("file-info-uploaded-date");
const fileActionsPublic = document.getElementById("file-actions-public-checkbox");
const remainingStorageInfoBlock = document.getElementById("remaining-storage-info");
const remainingStorageInfo = document.getElementById("remaining-storage");
const maxStorageInfo = document.getElementById("max-storage");
let fileActionFile = null;
async function hydateFileList() {
    fileError.hidden = true;
    console.log("fetching files");
    const data = await fetch("list")
        .then((response) => response.json())
        .catch((error) => {
            fileError.hidden = false;
            fileError.textContent = "Error loading files";
        });
    fileList.textContent = "";
    remainingStorageInfoBlock.hidden = true;
    if (!data) {
        return;
    }
    const { files, remaining_storage, max_storage } = data;
    console.log(Object.keys(files).length);
    if (Object.keys(files).length === 0) {
        fileError.hidden = false;
        fileError.textContent = "No Files";
        return;
    }

    remainingStorageInfo.textContent = filesizeToString(remaining_storage);
    maxStorageInfo.textContent = filesizeToString(max_storage);
    remainingStorageInfoBlock.hidden = false;

    files.forEach((entry) => {
        let item = fileList.appendChild(document.createElement("tr"));
        let truncatedFilename = truncateFilename(entry.name, 40);
        let filetype = entry.name.split(".").pop().slice(0, 7).toLowerCase();
        let created = new Date(entry.created * 1000).toLocaleDateString();
        item.innerHTML = `
        <td title="${name}">${truncatedFilename}</td>
        <td>${filetype}</td>
        <td>${filesizeToString(entry.size)}</td>
        <td>${created}</td>
    `;
        item.addEventListener("click", () => {
            fileActions.showModal();
            fileActionFile = entry;
            fileActionsFilename.textContent = truncatedFilename;
            fileActionsFilename.title = name;
            fileActionsSize.textContent = filesizeToString(entry.size);
            fileActionsUploadedDate.textContent = created;
            fileActionsPublic.classList.add("slider-no-transition");
            fileActionsPublic.checked = entry.public;
            // stupid shit, why won't it just cancel the animation?
            setTimeout(() => fileActionsPublic.classList.remove("slider-no-transition"));
            fileActionsCopy.classList.remove("copied");
        });
    });
}
hydateFileList();

// file actions
fileActionsPublic.addEventListener("change", async () => {
    const formData = new FormData();
    let file = fileActionFile;
    let publicValue = fileActionsPublic.checked;
    formData.append("public", publicValue);
    formData.append("filename", file.name);
    const response = await fetch("update_public", {
        method: "PUT",
        body: formData,
    });
    if (response.ok) {
        file.public = publicValue;
    } else {
        fileActionsPublic.checked = file.public;
        alert("Error updating file");
    }
});

const fileActionsDownload = document.getElementById("file-actions-download");
fileActionsDownload.addEventListener("click", () => {
    window.open(window.location.origin + fileActionFile.path);
});

const fileActionsCopy = document.getElementById("file-actions-copy");
fileActionsCopy.addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.origin + fileActionFile.path);
    if (!fileActionsCopy.classList.contains("copied")) setTimeout(() => fileActionsCopy.classList.remove("copied"), 800);
    fileActionsCopy.classList.add("copied");
});

const fileActionsDelete = document.getElementById("file-actions-delete");
fileActionsDelete.addEventListener("click", () => {
    confirmDeleteFile.textContent = fileActionFile.name;
    confirmDeleteModal.showModal();
    fileActions.close();
});
const confirmDeleteModal = document.getElementById("confirm-delete");
const confirmDeleteFile = document.getElementById("confirm-delete-file");
const confirmDelete = document.getElementById("confirm-delete-button");
confirmDelete.addEventListener("click", async () => {
    const response = await fetch("delete/" + fileActionFile.name, {
        method: "DELETE",
    });
    if (response.ok) {
        confirmDeleteModal.close();
        hydateFileList();
    } else {
        alert("Error deleting file");
    }
});

function truncateFilename(filename, maxLength) {
    if (filename.length <= maxLength) {
        return filename;
    } else {
        const start = filename.substring(0, maxLength / 2 - 2);
        const end = filename.substring(filename.length - maxLength / 2 + 1);
        return start + "..." + end;
    }
}

const postFixes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

function filesizeToString(size) {
    let i = 0;
    while (size > 1024 && i < postFixes.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(1)} ${postFixes[i]}`;
}
