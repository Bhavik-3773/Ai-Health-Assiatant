"""
Shared slowapi Limiter instance.

Kept in its own module (rather than defined in main.py) so router modules
can import and apply @limiter.limit(...) decorators without creating a
circular import with app.main (which itself imports the routers).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
