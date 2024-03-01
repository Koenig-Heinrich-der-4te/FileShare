import datetime
import config
from flask import (
    Flask,
    abort,
    request,
    redirect,
    send_from_directory,
    url_for,
    make_response,
    render_template,
)
from werkzeug.utils import secure_filename
import os
from auth import auth, get_user
from data import File, get_user_files, get_folder_size

app = Flask(__name__, static_url_path=config.prefix + "/static")
app.config["MAX_CONTENT_LENGTH"] = config.max_upload_file_size_gb * 1024 * 1024 * 1024


@app.route(config.prefix + "/")
def home():
    user = get_user(abort_if_not_logged_in=False)
    if user is None:
        return redirect(url_for("auth.login"))
    return render_template("index.html", username=user.username)


@app.route(config.prefix + "/list")
def list_files():
    user = get_user()
    files = get_user_files(user.username)
    remaining_storage = user.dedicated_storage - get_folder_size(files)
    json_files = [
        {
            "name": file.filename,
            "size": file.size,
            "public": file.public,
            "created": file.upload_date.timestamp(),
            "path": url_for("get_file", owner=user.username, filename=file.filename),
        }
        for file in files.values()
    ]

    return {
        "files": json_files,
        "remaining_storage": remaining_storage,
        "max_storage": user.dedicated_storage,
    }


@app.route(config.prefix + "/delete/<filename>", methods=["DELETE"])
def delete_file(filename):
    user = get_user()
    files = get_user_files(user.username)
    if filename not in files:
        return abort(404)
    os.remove(os.path.join("media", user.username, filename))
    del files[filename]
    return "ok"


@app.route(config.prefix + "/upload", methods=["POST"])
def upload_file():
    user = get_user()
    # check if the post request has the file part
    if "file" not in request.files:
        return abort(400)
    file = request.files["file"]
    if file.filename == "":
        return abort(400)
    filename = secure_filename(file.filename)
    files = get_user_files(user.username)
    if filename in files:
        delete_file(filename)

    os.makedirs(os.path.join("media", user.username), exist_ok=True)
    file_path = os.path.join("media", user.username, filename)
    file.save(file_path)
    # check if the file is too large
    size = os.path.getsize(file_path)
    if user.dedicated_storage < get_folder_size(files) + size:
        os.remove(file_path)
        return abort(413)
    # store file info
    url_path = url_for("get_file", owner=user.username, filename=filename)[1:]
    public = request.form.get("public") == "true"
    files[filename] = File(filename, datetime.datetime.now(), size, public)
    return "ok"


@app.route(config.prefix + "/update_public", methods=["PUT"])
def set_public():
    user = get_user()
    files = get_user_files(user.username)
    filename = request.form.get("filename")
    public = request.form.get("public") == "true"
    if filename not in files:
        return abort(404)
    with files:
        files[filename].public = public
    return "ok"


@app.route(config.prefix + "/file/<owner>/<filename>")
def get_file(owner, filename):
    files = get_user_files(owner)
    if files is None:
        return abort(404)
    filename = secure_filename(filename)
    if filename not in files:
        return abort(404)
    file = files[filename]
    # pretend the file does not exist if it is not public and the user is not the owner
    if not file.public:
        user = get_user(abort_if_not_logged_in=False)
        if user is None or user.username != owner:
            return abort(404)
    return send_from_directory(
        os.path.join("media", owner), filename, as_attachment=True
    )


app.register_blueprint(auth, url_prefix=config.prefix + "/auth")

if __name__ == "__main__":
    if config.debug:
        app.config["SERVER_NAME"] = f"localhost:{config.port}"
        with app.app_context():
            print(url_for("home"))
            print(url_for("auth.dashboard.dashboard_page"))

    app.run(port=config.port, debug=config.debug)
