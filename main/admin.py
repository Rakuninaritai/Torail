from django.contrib import admin
from .models import User, Subject, Task, Record, Language

admin.site.register(User)
admin.site.register(Subject)
admin.site.register(Task)
admin.site.register(Record)
admin.site.register(Language)
