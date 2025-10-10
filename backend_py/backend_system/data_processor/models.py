from django.db import models

# Create your models here.
class UploadedData(models.Model):
    file = models.FileField(upload_to="uploads/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    result = models.FloatField(null=True, blank=True)  # store calculation result

class DocumentUpload(models.Model):
    file = models.FileField(upload_to="uploads/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

class Module(models.Model):
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="modules/")
    extracted_data = models.JSONField()  # structured text chunks
    published_at = models.DateTimeField(auto_now_add=True)

class Comment(models.Model):
    module = models.ForeignKey(Module, related_name="comments", on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)