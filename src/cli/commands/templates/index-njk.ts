/**
 * Homepage template with post listing and pagination
 */
export const indexNjk = String.raw`{% extends "base.njk" %}

{% block content %}
  <h1>Latest Posts</h1>

  {% if posts.length > 0 %}
    <div class="posts">
      {% for post in posts %}
        <article class="post-card">
          <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
          <div class="post-meta">
            <time datetime="{{ post.date }}">{{ post.date | date("MMMM D, YYYY") }}</time>
            {% if post.tags.length > 0 %}
              <span class="tags">
                {% for tag in post.tags %}
                  <a href="/tags/{{ post.tagSlugs[tag] }}/">{{ tag }}</a>{% if not loop.last %}, {% endif %}
                {% endfor %}
              </span>
            {% endif %}
          </div>
          <div class="post-excerpt">{{ post.excerpt }}</div>
          <a href="{{ post.url }}" class="read-more">Read more →</a>
        </article>
      {% endfor %}
    </div>

    {% if pagination.totalPages > 1 %}
      <nav class="pagination">
        {% if pagination.hasPrevPage %}
          <a href="{{ pagination.pagePath }}{% if pagination.prevPage > 1 %}page/{{ pagination.prevPage }}/{% endif %}" class="prev">← Previous</a>
        {% endif %}

        {% if pagination.hasNextPage %}
          <a href="{{ pagination.pagePath }}page/{{ pagination.nextPage }}/" class="next">Next →</a>
        {% endif %}

        <span class="page-info">Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span>
      </nav>
    {% endif %}
  {% else %}
    <p>No posts yet!</p>
  {% endif %}
{% endblock %}`;
