import os
import pickle


class DB:
    def __init__(self, name):
        self.name = name
        self.filename = name + ".pickle"
        if os.path.exists(self.filename):
            with open(self.filename, "rb") as f:
                self.data = pickle.load(f)
        else:
            self.data = {}
        self.defer_save = False

    def save(self):
        if self.defer_save:
            return
        with open(self.filename, "wb") as f:
            pickle.dump(self.data, f)

    def get(self, __key, __default=None):
        return self.data.get(__key, __default)

    def items(self):
        return self.data.items()

    def keys(self):
        return self.data.keys()

    def values(self):
        return self.data.values()

    def __len__(self):
        return len(self.data)

    def __contains__(self, key):
        return key in self.data

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value
        self.save()

    def __delitem__(self, key):
        del self.data[key]
        self.save()

    def __enter__(self):
        self.defer_save = True
        return self

    def __exit__(self, *args):
        self.defer_save = False
        self.save()
