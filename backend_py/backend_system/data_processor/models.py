from django.db import models

class Module(models.Model):
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="modules/")
    extracted_data = models.JSONField(default=list)  # structured text chunks
    published_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Comment(models.Model):
    module = models.ForeignKey(Module, related_name="comments", on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment on {self.module.title} at {self.created_at}"
