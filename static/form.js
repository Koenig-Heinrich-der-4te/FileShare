function usernameInput(id) {
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
        const allowed = "abcdefghijklmnopqrstuvwxyz0123456789_-";
        const value = input.value.toLowerCase();
        const newValue = value
            .split("")
            .filter((char) => allowed.includes(char))
            .join("");
        if (input.value !== newValue) {
            const selection = [input.selectionStart, input.selectionEnd];
            input.value = newValue;
            input.setSelectionRange(selection[0] - 1, selection[1] - 1);
        }
    });
    return requiredInput(id);
}

function requiredInput(id) {
    const input = document.getElementById(id);
    let errorEnabled = false;
    function update() {
        if (errorEnabled && !input.value) {
            input.parentElement.classList.add("error");
        } else {
            input.parentElement.classList.remove("error");
        }
    }
    input.addEventListener("focusout", () => {
        errorEnabled = true;
        update();
    });
    input.addEventListener("input", (event) => {
        update();
        report.update();
    });
    const report = {
        valid: () => !!input.value,
        update: () => {},
    };
    return report;
}

function confirmPasswordInput(passwordId, confirmId) {
    const password = document.getElementById(passwordId);
    const confirm = document.getElementById(confirmId);
    let errorEnabled = false;
    function update() {
        if (errorEnabled && password.value !== confirm.value) {
            confirm.parentElement.classList.add("error");
        } else {
            confirm.parentElement.classList.remove("error");
        }
    }
    confirm.addEventListener("focusout", () => {
        errorEnabled = true;
        update();
    });
    [password, confirm].forEach((input) =>
        input.addEventListener("input", () => {
            update();
            report.update();
        })
    );
    requiredInput(passwordId);
    const report = {
        valid: () => !!password.value && password.value === confirm.value,
        update: () => {},
    };
    return report;
}

function submitButton(id, ...validators) {
    const button = document.getElementById(id);
    function update() {
        if (validators.every((validator) => validator.valid())) {
            button.disabled = false;
        } else {
            button.disabled = true;
        }
    }
    validators.forEach((validator) => (validator.update = update));
    update();
    return button;
}
