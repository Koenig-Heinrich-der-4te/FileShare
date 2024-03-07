# Filesharing Website

A simple website for filesharing with managed user registration

## Dashboard

Url: `[prefix]/auth/dashboard`  
Can only by accessed by the admin account and is used to manage user accounts.  
For useres to create an account they need to be handed a registration link, which can be created here.

## Insallation Instructions

1. clone this repo
2. Install required packages by running `pip install flask apscheduler`
3. configure `config.py`
4. Launch the server by running `server.py`
5. create an admin account by entering and confirming the admin password if requested
6. install a production WSGI server such as gunicorn (or ignore flask's complaints)
