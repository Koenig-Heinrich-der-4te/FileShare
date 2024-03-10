import datetime
import config
from flask import (
    Flask,
    abort,
    request,
    redirect,
    send_from_directory,
    url_for,
    render_template,
)
from werkzeug.utils import secure_filename
import os
from auth import auth, get_user, is_admin
from data import File, Fileupload, get_user_files, get_folder_size, fileuploads

app = Flask(__name__, static_url_path=config.prefix + "/static")


@app.route(config.prefix + "/")
def home():
    user = get_user(abort_if_not_logged_in=False)
    if user is None:
        return redirect(url_for("auth.login"))
    return render_template(
        "index.html", username=user.username, is_admin=is_admin(user)
    )


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


def abort_fileupload(user):
    if user.username in fileuploads:
        os.remove(
            os.path.join(
                "media", user.username, "temp", fileuploads[user.username].filename
            )
        )
        del fileuploads[user.username]


@app.route(config.prefix + "/upload-chunk", methods=["POST"])
def upload_chunk():
    user = get_user()
    if user.username not in fileuploads:
        abort_fileupload(user)
        return abort(404)
    upload = fileuploads[user.username]
    id = request.args.get("id", default=-1, type=int)
    if upload.id != id:
        abort_fileupload(user)
        return abort(404)
    chunk_num = request.args.get("cn", default=-1, type=int)
    if not 0 <= chunk_num < len(upload.received_chunks):
        abort_fileupload(user)
        return abort(400)
    chunk = request.data
    if len(chunk) > config.upload_chunk_size:
        abort_fileupload(user)
        return abort(400)
    chunk_path = os.path.join("media", user.username, "temp", upload.filename)
    with open(chunk_path, "r+b") as f:
        f.seek(chunk_num * config.upload_chunk_size)
        f.write(chunk)
    upload.received_chunks[chunk_num] = True
    if all(upload.received_chunks):
        real_file_path = os.path.join("media", user.username, upload.filename)
        if os.path.exists(real_file_path):
            os.remove(real_file_path)
        os.rename(chunk_path, real_file_path)
        files = get_user_files(user.username)
        files[upload.filename] = File(
            upload.filename, datetime.datetime.now(), upload.size, upload.public
        )
        del fileuploads[user.username]
    return "ok"


next_id = 0


@app.route(config.prefix + "/init-upload", methods=["POST"])
def init_upload():
    global next_id
    user = get_user()
    upload_size = int(request.form.get("size"))
    filename = secure_filename(request.form.get("filename"))
    if len(filename) == 0 or filename == "temp":
        return abort(400, "Invalid filename")
    public = request.form.get("public") == "true"
    files = get_user_files(user.username)
    bonus = 0
    if filename in files:
        bonus = files[filename].size
    remaining_storage = user.dedicated_storage - get_folder_size(files) + bonus
    if remaining_storage < upload_size:
        return abort(413)
    # stop any previous uploads
    abort_fileupload(user)
    id = next_id = next_id + 1
    temp_path = os.path.join("media", user.username, "temp")
    os.makedirs(temp_path, exist_ok=True)
    if not os.path.exists(os.path.join(temp_path, filename)):
        open(os.path.join(temp_path, filename), "w").close()

    fileuploads[user.username] = Fileupload(
        id,
        filename,
        upload_size,
        public,
        [False]
        * ((upload_size + config.upload_chunk_size - 1) // config.upload_chunk_size),
    )
    return {"chunkSize": config.upload_chunk_size, "uploadId": id}


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
        app.config["SERVER_NAME"] = None
    host = "0.0.0.0" if config.debug else None
    app.run(host=host, port=config.port, debug=config.debug)
