# serializers.py
from rest_framework import serializers
from .models import Module, Comment

class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = "__all__"

class ModuleSerializer(serializers.ModelSerializer):
    comments = CommentSerializer(many=True, read_only=True)
    class Meta:
        model = Module
        fields = ["id", "title", "extracted_data", "comments", "published_at"]
