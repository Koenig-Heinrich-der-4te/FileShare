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
uploadSubmitButton.addEventListener("click", async function uploadFile() {
    if (uploading) return;

    const onClose = () => {
        uploading = null;
        uploadProgress.value = 0;
        uploadProgressText.textContent = "0%";
        uploadProgressInfoDiv.hidden = true;
        uploadOptionsSection.hidden = false;
        fileupload.disabled = false;
    };
    uploading = { abort: onClose };

    const file = fileupload.files[0];
    const fileData = new FormData();
    fileData.append("filename", file.name);
    fileData.append("public", uploadOptionsPublic.checked);
    fileData.append("size", file.size);
    const response = await fetch("init-upload", {
        method: "POST",
        body: fileData,
    });

    if (!response.ok) {
        alert("Error uploading file");
        return;
    }

    const { chunkSize, uploadId } = await response.json();
    uploadProgressInfoDiv.hidden = false;
    uploadOptionsSection.hidden = true;
    fileupload.disabled = true;

    const uploadChunk = async (chunkNum) => {
        const chunk = file.slice(chunkNum * chunkSize, (chunkNum + 1) * chunkSize);
        const response = await fetch("upload-chunk?" + new URLSearchParams({ id: uploadId, cn: chunkNum }), {
            method: "POST",
            body: chunk,
        });
        return response.ok;
    };

    const chunkCount = Math.ceil(file.size / chunkSize);
    let chunks = Array(chunkCount).fill(false);
    const uploadChunks = async () => {
        for (let i = 0; i < chunkCount && uploading; i++) {
            if (chunks[i]) {
                continue;
            }
            chunks[i] = true;
            const success = await uploadChunk(i);
            if (!success) {
                alert("Error uploading file");
                onClose();
                return;
            }

            uploadProgress.value = Math.round((chunks.filter(Boolean).length / chunkCount) * 100);
            uploadProgressText.textContent = uploadProgress.value + "%";
        }
    };
    // upload in parallel
    const uploaders = Array.from({ length: 4 }, () => uploadChunks());
    await Promise.all(uploaders);

    onClose();
    uploadDialog.close();
    hydateFileList();
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
        <td title="${entry.name}">${truncatedFilename}</td>
        <td>${filetype}</td>
        <td>${filesizeToString(entry.size)}</td>
        <td>${created}</td>
    `;
        item.addEventListener("click", () => {
            fileActions.showModal();
            fileActionFile = entry;
            fileActionsFilename.textContent = truncatedFilename;
            fileActionsFilename.title = entry.name;
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
