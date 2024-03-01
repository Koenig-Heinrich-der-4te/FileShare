from dataclasses import dataclass
import datetime
import os
from database import DB


@dataclass
class UserData:
    username: str
    dedicated_storage: int


@dataclass
class User:
    username: str
    password_hash: str
    salt: str
    data: UserData


@dataclass
class Session:
    username: str
    session_id: str
    expires: datetime.datetime


@dataclass
class RegisterKey:
    key: str
    expires: datetime.datetime
    dedicated_storage: int


@dataclass
class File:
    filename: str
    upload_date: datetime.datetime
    size: int
    public: bool


sessions = DB("sessions")
users = DB("users")
register_keys = DB("register_keys")
files = {}

os.makedirs("files", exist_ok=True)


def get_user_files(username):
    if username not in users:
        return None
    if username not in files:
        files[username] = DB("files/" + username)
    return files[username]


def get_folder_size(files):
    return sum(f.size for f in files.values())
