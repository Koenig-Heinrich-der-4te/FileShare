import datetime
import os
from flask import (
    Blueprint,
    abort,
    make_response,
    redirect,
    request,
    render_template,
    url_for,
)
from hashlib import sha256
from data import (
    UserData,
    User,
    Session,
    RegisterKey,
    get_folder_size,
    get_user_files,
    sessions,
    users,
    register_keys,
)
from apscheduler.schedulers.background import BackgroundScheduler

auth_cookie_name = "mediaauth"
default_storage = 5 * 1024 * 1024 * 1024
cookie_max_days = 30


auth = Blueprint("auth", __name__)

api = Blueprint("api", __name__)

dashboard = Blueprint("dashboard", __name__)


@auth.route("/login")
def login():
    return render_template("login.html")


@api.route("/login", methods=["POST"])
def login_api():
    username = request.form.get("username")
    password = request.form.get("password")
    session = create_session(username, password)
    if session is None:
        return render_template("login_fail.html")

    resp = make_response(redirect(url_for("home")))
    resp.set_cookie(auth_cookie_name, session.session_id, expires=session.expires)
    return resp


def create_session(username, password):
    if username not in users:
        return None
    user = users[username]

    hash = sha256((password + user.salt).encode()).hexdigest()
    if hash != user.password_hash:
        return None

    session_id = sha256(os.urandom(64)).hexdigest()
    expires = datetime.datetime.now() + datetime.timedelta(days=cookie_max_days)
    session = Session(username, session_id, expires)
    sessions[session_id] = session
    return session


@auth.route("/register/<register_key>")
def register_page(register_key):
    if register_key not in register_keys:
        return render_template(
            "register_fail.html",
            reason="Invalid register URL",
            return_url=url_for("auth.register_page", register_key=register_key),
        )
    return render_template("register.html", register_key=register_key)


@api.route("/register", methods=["POST"])
def register():
    username = request.form.get("username")
    password = request.form.get("password")
    register_key = request.form.get("register-key")
    if not username or not password or not register_key:
        return render_template(
            "register_fail.html",
            reason="All fields are required",
            return_url=url_for("auth.register_page", register_key=register_key),
        )

    # Check if the register key is valid
    if register_key not in register_keys:
        return render_template(
            "register_fail.html",
            reason="Invalid register URL",
        )
    allowed_chars = "abcdefghijklmnopqrstuvwxyz0123456789_-"
    username = username.strip()
    if not all(c in allowed_chars for c in username):
        return render_template(
            "register_fail.html",
            reason="Invalid username",
            return_url=url_for("auth.register_page", register_key=register_key),
        )

    if username in users:
        return render_template(
            "register_fail.html",
            reason="Username already taken",
            return_url=url_for("auth.register_page", register_key=register_key),
        )

    salt = sha256(os.urandom(64)).hexdigest()
    password_hash = sha256((password + salt).encode()).hexdigest()
    initial_storage = register_keys[register_key].dedicated_storage
    users[username] = User(
        username, password_hash, salt, UserData(username, initial_storage)
    )
    del register_keys[register_key]
    return login_api()


def clear_expired():
    now = datetime.datetime.now()

    def clear(collection):
        for key, value in list(collection.items()):
            if value.expires < now:
                del collection[key]

    with sessions:
        clear(sessions)
    with register_keys:
        clear(register_keys)
    print("Cleared expired")


@api.route("/logout")
def logout():
    session_id = request.cookies.get(auth_cookie_name)
    if session_id in sessions:
        del sessions[session_id]
    resp = make_response(redirect(url_for("home")))
    resp.set_cookie(auth_cookie_name, "", expires=0)
    return resp


def get_user(abort_if_not_logged_in=True) -> UserData | None:
    session_id = request.cookies.get(auth_cookie_name)
    if session_id not in sessions:
        return abort(403) if abort_if_not_logged_in else None
    return users[sessions[session_id].username].data


# dashboard


def get_admin():
    user = get_user()
    if user.username != admin:
        abort(403)
    return user


@dashboard.route("/")
def dashboard_page():
    admin = get_admin()
    return render_template("dashboard.html")


@dashboard.route("/delete/<username>")
def delete_user(username):
    admin = get_admin()
    if username in users:
        del users[username]
        with sessions:
            for session in list(sessions.values()):
                if session.username == username:
                    del sessions[session.session_id]
    return "ok"


@dashboard.route("/set-allocated-storage/<username>/<storage>")
def set_allocated_storage(username, storage):
    admin = get_admin()
    if username in users:
        with users:
            user = users[username]
            user.data.dedicated_storage = int(storage)

    return "ok"


@dashboard.route("/list")
def list_users():
    admin = get_admin()
    userdata = [
        {
            "name": user.username,
            "storage": user.data.dedicated_storage,
            "used": get_folder_size(get_user_files(user.username)),
            "fileCount": len(get_user_files(user.username)),
        }
        for user in users.values()
    ]
    return userdata


@dashboard.route("/create-register-link", methods=["POST"])
def create_register_link():
    admin = get_admin()
    key = sha256(os.urandom(64)).hexdigest()
    expires = datetime.datetime.now() + datetime.timedelta(days=7)
    storage = int(request.form.get("storage"))
    register_keys[key] = RegisterKey(key, expires, storage)
    return url_for("auth.register_page", register_key=key)


auth.register_blueprint(api, url_prefix="/api")
auth.register_blueprint(dashboard, url_prefix="/dashboard")


def make_admin():
    if not os.path.exists("admin.txt"):
        admin = input("Enter the admin username: ").strip()
        with open("admin.txt", "w") as f:
            f.write(admin)
    else:
        with open("admin.txt") as f:
            admin = f.read()

    if admin not in users:
        valid = False
        while not valid:
            password = input("Enter the admin password: ")
            confirm = input("Confirm the admin password: ")
            valid = password == confirm
        salt = sha256(os.urandom(64)).hexdigest()
        password_hash = sha256((password + salt).encode()).hexdigest()
        users[admin] = User(
            admin, password_hash, salt, UserData(admin, default_storage)
        )

    return admin


admin = make_admin()

clear_expired()
scheduler = BackgroundScheduler()
scheduler.add_job(clear_expired, "interval", hours=6)
scheduler.start()
